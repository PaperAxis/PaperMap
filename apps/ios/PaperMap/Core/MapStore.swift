// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

/// Map overlays and live map events: geofences, saved places, meetings, trips,
/// SOS and location requests. Owned by the app so socket events land even when
/// the map tab is not on screen.
@MainActor
final class MapStore: ObservableObject {
    @Published private(set) var geofences: [Geofence] = []
    @Published private(set) var places: [SavedPlace] = []
    @Published private(set) var meetings: [Meeting] = []
    @Published private(set) var myTrip: MyTrip?
    @Published private(set) var peerTrips: [String: TripUpdate] = [:]

    @Published var sosAlert: SOSEvent?
    @Published var locationRequest: LocationRequestEvent?
    @Published var history: LocationHistory?

    /// Layer visibility (layers menu).
    @Published var showPeople = true
    @Published var showGeofences = true
    @Published var showPlaces = true
    @Published var showMeetings = true

    /// Camera move request and the chat location pin.
    @Published var focus: MapFocus?
    @Published var pin: MapPin?

    weak var session: Session?

    func reset() {
        geofences = []
        places = []
        meetings = []
        myTrip = nil
        peerTrips = [:]
        sosAlert = nil
        locationRequest = nil
        history = nil
        focus = nil
        pin = nil
    }

    func loadAll() async {
        async let g: Void = loadGeofences()
        async let p: Void = loadPlaces()
        async let m: Void = loadMeetings()
        async let t: Void = loadMyTrip()
        _ = await (g, p, m, t)
    }

    // MARK: Focus

    func flyTo(lat: Double, lng: Double, zoom: Double = 16) {
        focus = MapFocus(lat: lat, lng: lng, zoom: zoom)
    }

    /// Chat location message: drop a pin and fly there.
    func show(lat: Double, lng: Double, label: String) {
        pin = MapPin(lat: lat, lng: lng, label: label)
        flyTo(lat: lat, lng: lng)
    }

    // MARK: Geofences

    func loadGeofences() async {
        guard let session else { return }
        if let res: GeofencesResponse = try? await session.api("GET", "/api/geofences") {
            geofences = res.geofences
        }
    }

    func createGeofence(name: String, lat: Double, lng: Double, radius: Double) async throws {
        guard let session else { return }
        struct Body: Encodable { let name: String; let lat: Double; let lng: Double; let radius: Double }
        let res: GeofenceResponse = try await session.api(
            "POST", "/api/geofences",
            body: Body(name: name.trimmingCharacters(in: .whitespaces), lat: lat, lng: lng, radius: radius)
        )
        geofences.insert(res.geofence, at: 0)
    }

    func updateGeofence(_ id: String, name: String, radius: Double, notifyOnEnter: Bool, notifyOnExit: Bool) async throws {
        guard let session else { return }
        struct Body: Encodable {
            let name: String; let radius: Double; let notifyOnEnter: Bool; let notifyOnExit: Bool
        }
        let res: GeofenceResponse = try await session.api(
            "PATCH", "/api/geofences/\(id)",
            body: Body(
                name: name.trimmingCharacters(in: .whitespaces), radius: radius,
                notifyOnEnter: notifyOnEnter, notifyOnExit: notifyOnExit
            )
        )
        replace(res.geofence)
    }

    func deleteGeofence(_ id: String) async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("DELETE", "/api/geofences/\(id)")
        geofences.removeAll { $0.id == id }
    }

    func addWatches(_ geofenceId: String, userIds: [String]) async throws {
        guard let session else { return }
        struct Body: Encodable { let userIds: [String] }
        let _: EmptyResponse = try await session.api(
            "POST", "/api/geofences/\(geofenceId)/watches", body: Body(userIds: userIds)
        )
        await loadGeofences()
    }

    func removeWatch(_ geofenceId: String, userId: String) async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("DELETE", "/api/geofences/\(geofenceId)/watches/\(userId)")
        await loadGeofences()
    }

    func candidates() async throws -> CandidatesResponse {
        guard let session else { return CandidatesResponse(friends: [], family: nil) }
        return try await session.api("GET", "/api/geofences/candidates")
    }

    private func replace(_ g: Geofence) {
        if let idx = geofences.firstIndex(where: { $0.id == g.id }) { geofences[idx] = g }
    }

    // MARK: Places

    func loadPlaces() async {
        guard let session else { return }
        if let res: PlacesResponse = try? await session.api("GET", "/api/places") {
            places = res.places
        }
    }

    func createPlace(name: String, lat: Double, lng: Double, color: String) async throws {
        guard let session else { return }
        struct Body: Encodable { let name: String; let lat: Double; let lng: Double; let color: String }
        let res: PlaceResponse = try await session.api(
            "POST", "/api/places",
            body: Body(name: name.trimmingCharacters(in: .whitespaces), lat: lat, lng: lng, color: color)
        )
        places.insert(res.place, at: 0)
    }

    func updatePlace(_ id: String, name: String, color: String) async throws {
        guard let session else { return }
        struct Body: Encodable { let name: String; let color: String }
        let res: PlaceResponse = try await session.api(
            "PATCH", "/api/places/\(id)", body: Body(name: name.trimmingCharacters(in: .whitespaces), color: color)
        )
        if let idx = places.firstIndex(where: { $0.id == id }) { places[idx] = res.place }
    }

    func deletePlace(_ id: String) async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("DELETE", "/api/places/\(id)")
        places.removeAll { $0.id == id }
    }

    // MARK: Trips

    func loadMyTrip() async {
        guard let session else { return }
        if let res: MyTripResponse = try? await session.api("GET", "/api/trips/mine") {
            if let trip = res.trip {
                // Keep a known ETA when the same trip is reloaded.
                if myTrip?.destLabel != trip.destLabel { myTrip = MyTrip(destLabel: trip.destLabel, etaMinutes: nil) }
            } else {
                myTrip = nil
            }
        }
    }

    func startTrip(to place: SavedPlace) async throws {
        guard let session else { return }
        struct Body: Encodable { let destLat: Double; let destLng: Double; let destLabel: String }
        let _: EmptyResponse = try await session.api(
            "POST", "/api/trips", body: Body(destLat: place.lat, destLng: place.lng, destLabel: place.name)
        )
        myTrip = MyTrip(destLabel: place.name, etaMinutes: nil)
    }

    func cancelTrip() async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("DELETE", "/api/trips")
        myTrip = nil
    }

    func handleTripUpdate(_ t: TripUpdate, myId: String?) {
        if t.userId == myId {
            myTrip = MyTrip(destLabel: t.destLabel, etaMinutes: t.etaMinutes)
        } else {
            peerTrips[t.userId] = t
        }
    }

    func handleTripEnded(_ userId: String, myId: String?) {
        if userId == myId {
            myTrip = nil
        } else {
            peerTrips[userId] = nil
        }
    }

    // MARK: Meetings

    func loadMeetings() async {
        guard let session else { return }
        if let res: MeetingsResponse = try? await session.api("GET", "/api/meetings") {
            meetings = res.meetings
        }
    }

    func createMeeting(label: String, lat: Double, lng: Double, memberIds: [String]) async throws {
        guard let session else { return }
        struct Body: Encodable { let label: String; let lat: Double; let lng: Double; let memberIds: [String] }
        let _: MeetingResponse = try await session.api(
            "POST", "/api/meetings",
            body: Body(label: label.trimmingCharacters(in: .whitespaces), lat: lat, lng: lng, memberIds: memberIds)
        )
        await loadMeetings()
    }

    func meetingDetail(_ id: String) async throws -> MeetingDetailResponse {
        guard let session else { throw APIError(status: 0, message: "Oturum yok") }
        return try await session.api("GET", "/api/meetings/\(id)")
    }

    func deleteMeeting(_ id: String) async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("DELETE", "/api/meetings/\(id)")
        meetings.removeAll { $0.id == id }
    }

    func leaveMeeting(_ id: String) async throws {
        guard let session else { return }
        let _: EmptyResponse = try await session.api("POST", "/api/meetings/\(id)/leave")
        meetings.removeAll { $0.id == id }
    }

    // MARK: History, SOS, location request

    func showHistory(userId: String, name: String) async throws {
        guard let session else { return }
        let res: HistoryResponse = try await session.api("GET", "/api/location/history/\(userId)")
        history = LocationHistory(userId: userId, name: name, points: res.points)
    }

    /// Returns how many people were notified.
    func sendSOS() async throws -> Int {
        guard let session else { return 0 }
        let res: SOSResponse = try await session.api("POST", "/api/sos")
        return res.notified ?? 0
    }
}
