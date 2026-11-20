// Copyright (c) 2026 PaperAxis. All rights reserved.
// Map feature models: history, geofences, saved places, trips, meetings and
// live events (server/src/routes/*.js, socket.js).

import CoreLocation
import Foundation

struct HistoryPoint: Decodable, Equatable {
    let lat: Double
    let lng: Double
    var accuracy: Double?
    var recordedAt: String?

    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lng) }
}

struct HistoryResponse: Decodable {
    let points: [HistoryPoint]
}

/// Location trail shown on the map with playback.
struct LocationHistory: Equatable {
    let id = UUID()
    let userId: String
    let name: String
    let points: [HistoryPoint]
}

struct GeofenceWatch: Decodable, Equatable, Identifiable {
    let userId: String
    let displayName: String
    var avatarColor: String?
    var avatarPath: String?
    /// nil until the person's first location after being added.
    var inside: Bool?

    var id: String { userId }
}

struct Geofence: Decodable, Equatable, Identifiable {
    let id: String
    var name: String
    var lat: Double
    var lng: Double
    var radius: Double
    var notifyOnEnter: Bool
    var notifyOnExit: Bool
    var watches: [GeofenceWatch]
}

struct GeofencesResponse: Decodable {
    let geofences: [Geofence]
}

struct GeofenceResponse: Decodable {
    let geofence: Geofence
}

/// Friend or family member that can be watched in a geofence or invited to a meeting.
struct CandidatePerson: Decodable, Identifiable, Hashable {
    let id: String
    let displayName: String
    var avatarColor: String?
    var avatarPath: String?
}

struct CandidateFamily: Decodable {
    let id: String
    let name: String
    let members: [CandidatePerson]
}

struct CandidatesResponse: Decodable {
    let friends: [CandidatePerson]
    let family: CandidateFamily?
}

struct SavedPlace: Decodable, Equatable, Identifiable {
    let id: String
    var name: String
    var lat: Double
    var lng: Double
    var color: String?
}

struct PlacesResponse: Decodable {
    let places: [SavedPlace]
}

struct PlaceResponse: Decodable {
    let place: SavedPlace
}

struct TripInfo: Decodable {
    let destLat: Double
    let destLng: Double
    let destLabel: String
    var startedAt: String?
}

struct MyTripResponse: Decodable {
    let trip: TripInfo?
}

/// Socket `trip:update`: someone's (or my own) trip with the server's ETA.
struct TripUpdate: Decodable, Equatable {
    let userId: String
    var displayName: String?
    let destLat: Double
    let destLng: Double
    let destLabel: String
    var distanceMeters: Double?
    var etaMinutes: Int?
}

struct UserIdEvent: Decodable {
    let userId: String
}

/// My active trip; the ETA arrives with the first `trip:update`.
struct MyTrip: Equatable {
    let destLabel: String
    var etaMinutes: Int?
}

struct Meeting: Decodable, Equatable, Identifiable {
    let id: String
    var label: String
    var lat: Double
    var lng: Double
    var isOwner: Bool
    var memberCount: Int?
    var createdAt: String?
}

struct MeetingsResponse: Decodable {
    let meetings: [Meeting]
}

struct MeetingResponse: Decodable {
    let meeting: Meeting
}

struct MeetingMember: Decodable, Identifiable {
    let userId: String
    let displayName: String
    var avatarColor: String?
    var avatarPath: String?
    var isOwner: Bool
    var distanceMeters: Double?
    var etaMinutes: Int?
    var arrived: Bool
    var locationOff: Bool
    var updatedAt: String?

    var id: String { userId }

    /// Same wording as the web meetings panel.
    var etaText: String {
        if locationOff { return "konum paylaşımı kapalı" }
        guard let eta = etaMinutes else { return "konum bilinmiyor" }
        if arrived { return "buluşma noktasında" }
        return "~\(eta) dk · \(Format.distance(distanceMeters ?? 0))"
    }
}

struct MeetingDetailResponse: Decodable {
    let meeting: Meeting
    let members: [MeetingMember]
}

/// Socket `sos`: a related person raised an emergency call.
struct SOSEvent: Decodable, Equatable {
    let userId: String
    let displayName: String
    var avatarColor: String?
    var avatarPath: String?
    var lat: Double?
    var lng: Double?
    var message: String?
    var at: String?
}

struct SOSResponse: Decodable {
    var notified: Int?
}

/// Socket `location:request`: someone asked me to share my location.
struct LocationRequestEvent: Decodable, Equatable {
    let fromId: String
    let fromName: String
}

/// One-off camera move; a new id re-triggers even for the same point.
struct MapFocus: Equatable {
    let id = UUID()
    let lat: Double
    let lng: Double
    var zoom: Double = 16
}

/// Temporary marker for a point opened from a chat location message.
struct MapPin: Equatable {
    let lat: Double
    let lng: Double
    let label: String
}

/// What the map is currently waiting for a tap to create.
enum PlacingMode: Equatable {
    case geofence, place, meeting

    var prompt: String {
        switch self {
        case .geofence: return "Alanın merkezi için haritada bir noktaya dokunun…"
        case .place: return "Yeni yer için haritada bir noktaya dokunun…"
        case .meeting: return "Buluşma noktası için haritada bir noktaya dokunun…"
        }
    }
}

/// Map point picked while placing, with the form to show for it.
struct PendingPoint: Identifiable, Equatable {
    let id = UUID()
    let mode: PlacingMode
    let lat: Double
    let lng: Double
}

/// Colors offered for saved places (web: PlacesPanel.jsx PLACE_COLORS).
let placeColors = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#ea580c", "#0891b2"]
