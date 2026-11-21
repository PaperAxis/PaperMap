// Copyright (c) 2026 PaperAxis. All rights reserved.

import Combine
import CoreLocation
import SwiftUI

/// Sheets presented from the map; one at a time.
enum MapSheet: Identifiable {
    case peer(Peer)
    case people
    case notifications
    case geofences
    case places
    case meetings
    case create(PendingPoint)

    var id: String {
        switch self {
        case .peer(let p): return "peer-\(p.userId)"
        case .people: return "people"
        case .notifications: return "notifications"
        case .geofences: return "geofences"
        case .places: return "places"
        case .meetings: return "meetings"
        case .create(let p): return "create-\(p.id)"
        }
    }
}

struct MapScreen: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @EnvironmentObject private var location: LocationService
    @EnvironmentObject private var notifications: NotificationStore
    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.colorScheme) private var colorScheme

    @State private var sheet: MapSheet?
    @State private var recenter = 0
    @State private var busy = false
    @State private var error: String?
    @State private var notice: String?
    @State private var askDuration = false
    @State private var confirmSOS = false
    @State private var sosBusy = false
    @State private var placing: PlacingMode?
    @State private var playIndex = 0
    @State private var playing = false
    @AppStorage(MapStyleChoice.storageKey) private var mapStyle = MapStyleChoice.auto.rawValue
    @State private var bearing = 0.0
    @State private var resetNorth = 0

    private var styleVariant: String {
        (MapStyleChoice(rawValue: mapStyle) ?? .auto).variant(dark: colorScheme == .dark)
    }

    private let playTimer = Timer.publish(every: 0.6, on: .main, in: .common).autoconnect()

    private var sharing: Bool { session.user?.sharingEnabled == true }

    private var historyPoints: [HistoryPoint] { mapStore.history?.points ?? [] }

    var body: some View {
        ZStack(alignment: .top) {
            MapLibreView(
                peers: mapStore.showPeople ? realtime.sortedPeers : [],
                geofences: mapStore.showGeofences ? mapStore.geofences : [],
                places: mapStore.showPlaces ? mapStore.places : [],
                meetings: mapStore.showMeetings ? mapStore.meetings : [],
                history: mapStore.history,
                playbackIndex: playIndex,
                pin: mapStore.pin,
                styleVariant: styleVariant,
                resetNorthRequest: resetNorth,
                onBearingChange: { bearing = $0 },
                recenterRequest: recenter,
                focus: mapStore.focus,
                placing: placing != nil,
                onSelect: { sheet = .peer($0) },
                onTapMap: { coordinate in
                    guard let mode = placing else { return }
                    placing = nil
                    sheet = .create(PendingPoint(mode: mode, lat: coordinate.latitude, lng: coordinate.longitude))
                }
            )
            .ignoresSafeArea(edges: .top)

            VStack(spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    sharingBar
                    bellButton
                }
                banners
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            VStack(spacing: 8) {
                Spacer()
                if historyPoints.count > 1 { playbackBar }
                // Map style picker and compass, right above the SOS button.
                HStack(spacing: 8) {
                    MapStylePicker(selection: $mapStyle)
                    CompassButton(bearing: bearing) { resetNorth += 1 }
                    Spacer()
                }
                HStack(spacing: 12) {
                    sosButton
                    Spacer()
                    layersMenu
                    mapButton("person.2", label: "Kişiler") { sheet = .people }
                    mapButton("location", label: "Konumuma git") { recenter += 1 }
                }
            }
            .padding(16)
        }
        .sheet(item: $sheet) { item in
            sheetContent(item)
        }
        .sharingDurationDialog(isPresented: $askDuration) { minutes in
            Task { await setSharing(true, minutes: minutes) }
        }
        .alert("Acil durum çağrısı", isPresented: $confirmSOS) {
            Button("Vazgeç", role: .cancel) {}
            Button("Acil durum gönder", role: .destructive) { Task { await sendSOS() } }
        } message: {
            Text("Tüm arkadaşlarına ve aile üyelerine acil durum bildirimi ve son konumun gönderilecek. Onaylıyor musun?")
        }
        .onReceive(playTimer) { _ in
            guard playing else { return }
            if playIndex < historyPoints.count - 1 {
                playIndex += 1
            } else {
                playing = false
            }
        }
        .onChange(of: mapStore.history) { _ in
            playIndex = 0
            playing = false
        }
        .task { await mapStore.loadAll() }
    }

    // MARK: Sheets

    @ViewBuilder
    private func sheetContent(_ item: MapSheet) -> some View {
        switch item {
        case .peer(let peer):
            PeerDetailSheet(
                peer: peer,
                trip: mapStore.peerTrips[peer.userId],
                onHistory: { showHistory(userId: peer.userId, name: peer.displayName) }
            )
            .presentationDetents([.medium, .large])
        case .people:
            PeopleSheet(
                peers: realtime.sortedPeers,
                trips: mapStore.peerTrips,
                onPick: { peer in
                    sheet = nil
                    mapStore.flyTo(lat: peer.lat, lng: peer.lng)
                },
                onHistory: { userId, name in showHistory(userId: userId, name: name) }
            )
            .presentationDetents([.medium, .large])
        case .notifications:
            NotificationsView()
        case .geofences:
            GeofencesSheet(onStartPlacing: { startPlacing(.geofence) })
        case .places:
            PlacesSheet(onStartPlacing: { startPlacing(.place) })
        case .meetings:
            MeetingsSheet(onStartPlacing: { startPlacing(.meeting) })
        case .create(let point):
            CreateAtPointSheet(point: point)
        }
    }

    private func startPlacing(_ mode: PlacingMode) {
        sheet = nil
        placing = mode
    }

    private func showHistory(userId: String, name: String) {
        sheet = nil
        Task {
            do {
                try await mapStore.showHistory(userId: userId, name: name)
                error = nil
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    // MARK: Top bar and banners

    private var sharingBar: some View {
        HStack(spacing: 12) {
            PaSymbol(sharing ? "location.fill" : "location.slash")
                .foregroundColor(sharing ? Pa.primary : Pa.muted)
            VStack(alignment: .leading, spacing: 2) {
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    Text(SharingText.label(for: session.user, now: context.date))
                        .paFont(.subheadline, weight: .semibold)
                        .foregroundColor(Pa.text)
                }
                Text(sharing ? "Arkadaşların ve ailen seni görebilir." : "Şu an kimse konumunu göremez.")
                    .paFont(.caption)
                    .foregroundColor(Pa.muted)
            }
            Spacer()
            Toggle("Konum paylaşımı", isOn: Binding(
                get: { sharing },
                set: { value in
                    if value { askDuration = true } else { Task { await setSharing(false, minutes: nil) } }
                }
            ))
            .labelsHidden()
            .disabled(busy || session.user == nil)
        }
        .padding(12)
        .background(Pa.bg)
        .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }

    @ViewBuilder
    private var banners: some View {
        if let error {
            MapBanner(icon: "exclamationmark.circle", text: error, tint: Pa.danger) {
                Button("Kapat") { self.error = nil }
            }
        }
        if location.authorization == .denied || location.authorization == .restricted {
            MapBanner(icon: "location.slash", text: "Konum izni kapalı. Ayarlar'dan PaperMap için konuma izin ver.") {
                Button("Ayarları aç") { openAppSettings() }
            }
        }
        if let notice {
            MapBanner(icon: "checkmark.circle", text: notice) {
                Button("Kapat") { self.notice = nil }
            }
        }
        if let sos = mapStore.sosAlert {
            MapBanner(icon: "exclamationmark.triangle.fill", text: sosText(sos), tint: Pa.danger, emphasized: true) {
                if let lat = sos.lat, let lng = sos.lng {
                    Button("Haritada gör") { mapStore.flyTo(lat: lat, lng: lng) }
                }
                Button("Kapat") { mapStore.sosAlert = nil }
            }
        }
        if let request = mapStore.locationRequest {
            MapBanner(icon: "mappin.and.ellipse", text: "\(request.fromName) konumunu istiyor.") {
                if !sharing {
                    Button("Paylaşımı aç") {
                        mapStore.locationRequest = nil
                        Task { await setSharing(true, minutes: nil) }
                    }
                }
                Button("Kapat") { mapStore.locationRequest = nil }
            }
        }
        if let trip = mapStore.myTrip {
            MapBanner(
                icon: "car",
                text: "\(trip.destLabel) hedefine gidiyorsun" + (trip.etaMinutes.map { " · ~\($0) dk" } ?? "")
            ) {
                Button("İptal") { Task { await cancelTrip() } }
            }
        }
        if let history = mapStore.history {
            MapBanner(
                icon: "clock.arrow.circlepath",
                text: "\(history.name) · son 30 günlük konum geçmişi"
                    + (history.points.isEmpty ? " — kayıt yok" : " (\(history.points.count) nokta)")
            ) {
                Button("Kapat") { mapStore.history = nil }
            }
        }
        if let placing {
            MapBanner(icon: "hand.tap", text: placing.prompt) {
                Button("İptal") { self.placing = nil }
            }
        }
        if mapStore.pin != nil {
            MapBanner(icon: "mappin", text: mapStore.pin?.label ?? "Konum") {
                Button("Kapat") { mapStore.pin = nil }
            }
        }
    }

    private func sosText(_ sos: SOSEvent) -> String {
        let note = sos.message?.trimmingCharacters(in: .whitespaces) ?? ""
        return note.isEmpty
            ? "\(sos.displayName) acil durum bildirdi."
            : "\(sos.displayName) acil durum bildirdi: \(note)"
    }

    private var playbackBar: some View {
        let points = historyPoints
        let idx = min(playIndex, points.count - 1)
        return HStack(spacing: 12) {
            Button {
                if !playing && playIndex >= points.count - 1 { playIndex = 0 }
                playing.toggle()
            } label: {
                PaSymbol(playing ? "pause.fill" : "play.fill")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(playing ? "Duraklat" : "Oynat")
            Slider(
                value: Binding(
                    get: { Double(idx) },
                    set: { value in
                        playing = false
                        playIndex = Int(value.rounded())
                    }
                ),
                in: 0...Double(max(points.count - 1, 1)),
                step: 1
            )
            .accessibilityLabel("Geçmişte konum")
            Text(Format.dayTime(points[idx].recordedAt) ?? "")
                .paFont(.caption, monospacedDigit: true)
                .foregroundColor(Pa.text)
                .frame(minWidth: 84, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(Pa.bg)
        .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }

    // MARK: Buttons

    private var bellButton: some View {
        Button { sheet = .notifications } label: {
            PaSymbol("bell")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .overlay(alignment: .topTrailing) {
                    if notifications.unread > 0 {
                        Circle()
                            .fill(Pa.danger)
                            .frame(width: 10, height: 10)
                            .padding(10)
                    }
                }
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel(Text(bellLabel))
    }

    private var bellLabel: String {
        notifications.unread > 0 ? "Bildirimler, \(notifications.unread) okunmamış" : "Bildirimler"
    }

    private var sosButton: some View {
        Button { confirmSOS = true } label: {
            Label("SOS", symbol: "exclamationmark.triangle.fill")
                .paFont(.subheadline, weight: .bold)
                .foregroundColor(.white)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(Pa.danger)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
        }
        .disabled(sosBusy)
        .accessibilityLabel("Acil durum çağrısı")
    }

    private var layersMenu: some View {
        Menu {
            Section {
                Button { sheet = .people } label: {
                    Label("Kişiler (\(realtime.peers.count))", symbol: "person.2")
                }
                Button { sheet = .geofences } label: {
                    Label("Alanlar (\(mapStore.geofences.count))", symbol: "flag")
                }
                Button { sheet = .places } label: {
                    Label("Yerler (\(mapStore.places.count))", symbol: "bookmark")
                }
                Button { sheet = .meetings } label: {
                    Label("Buluşmalar (\(mapStore.meetings.count))", symbol: "person.3")
                }
            }
            Section("Haritada göster") {
                Toggle("Kişiler", isOn: $mapStore.showPeople)
                Toggle("Alanlar", isOn: $mapStore.showGeofences)
                Toggle("Yerler", isOn: $mapStore.showPlaces)
                Toggle("Buluşmalar", isOn: $mapStore.showMeetings)
            }
        } label: {
            PaSymbol("square.3.layers.3d")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel("Katmanlar menüsü")
    }

    private func mapButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            PaSymbol(icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel(label)
    }

    // MARK: Actions

    @MainActor
    private func setSharing(_ value: Bool, minutes: Int?) async {
        busy = true
        defer { busy = false }
        do {
            try await session.setSharing(value, durationMinutes: minutes)
            error = nil
            if value { location.start() }
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func sendSOS() async {
        sosBusy = true
        defer { sosBusy = false }
        do {
            let count = try await mapStore.sendSOS()
            notice = "Acil durum çağrısı \(count) kişiye gönderildi."
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func cancelTrip() async {
        do {
            try await mapStore.cancelTrip()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Floating message card on the map with trailing actions.
struct MapBanner<Actions: View>: View {
    let icon: String
    let text: String
    var tint: Color = Pa.text
    var emphasized = false
    @ViewBuilder let actions: () -> Actions

    var body: some View {
        HStack(spacing: 10) {
            PaSymbol(icon)
                .foregroundColor(tint)
                .accessibilityHidden(true)
            Text(text)
                .paFont(.footnote, weight: emphasized ? .semibold : .regular)
                .foregroundColor(Pa.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 12) { actions() }
                .paFont(.footnote, weight: .semibold)
                .buttonStyle(.borderless)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(minHeight: 44)
        .background(Pa.bg)
        .overlay(
            RoundedRectangle(cornerRadius: Pa.radiusSm)
                .stroke(emphasized ? tint : Color.clear, lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: Pa.radiusSm))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }
}

struct PeerDetailSheet: View {
    let peer: Peer
    var trip: TripUpdate?
    var onHistory: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    AvatarView(name: peer.displayName, color: peer.avatarColor, path: peer.avatarPath, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(peer.displayName).paFont(.title3, weight: .semibold).foregroundColor(Pa.text)
                        if let status = peer.statusText, !status.isEmpty {
                            Text(status).paFont(.subheadline).foregroundColor(Pa.muted)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    if let rel = Format.relative(peer.updatedAt) {
                        Label("Son güncelleme \(rel)", symbol: "clock")
                    }
                    if let battery = peer.battery {
                        Label(
                            peer.charging == true ? String("Pil %\(battery), şarj oluyor") : String("Pil %\(battery)"),
                            symbol: batteryIcon(battery, charging: peer.charging == true)
                        )
                    }
                    if let acc = peer.accuracy {
                        Label("Doğruluk ±\(Int(acc)) m", symbol: "scope")
                    }
                    if let trip {
                        Label(
                            "→ \(trip.destLabel)" + (trip.etaMinutes.map { " · ~\($0) dk" } ?? ""),
                            symbol: "car"
                        )
                    }
                }
                .paFont(.subheadline)
                .foregroundColor(Pa.text)
                HStack(spacing: 12) {
                    Button(action: onHistory) {
                        Label("Konum geçmişi", symbol: "clock.arrow.circlepath")
                    }
                    .buttonStyle(PaSecondaryButtonStyle())
                    NavigationLink {
                        UserProfileView(userId: peer.userId)
                    } label: {
                        Label("Profil", symbol: "person.crop.circle")
                    }
                    .buttonStyle(PaSecondaryButtonStyle())
                }
                Spacer()
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Pa.bg)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func batteryIcon(_ level: Int, charging: Bool) -> String {
        if charging { return "battery.100.bolt" }
        switch level {
        case ..<13: return "battery.0"
        case ..<38: return "battery.25"
        case ..<63: return "battery.50"
        case ..<88: return "battery.75"
        default: return "battery.100"
        }
    }
}

struct PeopleSheet: View {
    let peers: [Peer]
    var trips: [String: TripUpdate] = [:]
    let onPick: (Peer) -> Void
    var onHistory: (String, String) -> Void

    @EnvironmentObject private var session: Session

    var body: some View {
        NavigationStack {
            List {
                if let me = session.user {
                    Button {
                        onHistory(me.id, "Senin")
                    } label: {
                        Label("Konum geçmişim", symbol: "clock.arrow.circlepath")
                    }
                }
                if peers.isEmpty {
                    VStack(spacing: 8) {
                        PaSymbol("person.2").paFont(.largeTitle).foregroundColor(Pa.muted)
                        Text("Haritada kimse yok").paFont(.headline).foregroundColor(Pa.text)
                        Text("Konumunu paylaşan arkadaşların ve aile üyelerin burada görünür.")
                            .paFont(.subheadline).foregroundColor(Pa.muted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(24)
                    .listRowSeparator(.hidden)
                }
                ForEach(peers) { peer in
                    HStack(spacing: 12) {
                        Button { onPick(peer) } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: peer.displayName, color: peer.avatarColor, path: peer.avatarPath, size: 40)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(peer.displayName).foregroundColor(Pa.text)
                                    if let status = peer.statusText, !status.isEmpty {
                                        Text(status).paFont(.caption).foregroundColor(Pa.text)
                                    }
                                    Text(subtitle(peer)).paFont(.caption).foregroundColor(Pa.muted)
                                    if let trip = trips[peer.userId] {
                                        Text("→ \(trip.destLabel)" + (trip.etaMinutes.map { " · ~\($0) dk" } ?? ""))
                                            .paFont(.caption).foregroundColor(Pa.primary)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.borderless)
                        Button("Geçmiş") { onHistory(peer.userId, peer.displayName) }
                            .buttonStyle(.bordered)
                            .paFont(.subheadline)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Haritadaki kişiler")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func subtitle(_ peer: Peer) -> String {
        var parts: [String] = []
        if let b = peer.battery { parts.append(peer.charging == true ? "Pil %\(b) (şarjda)" : "Pil %\(b)") }
        if let rel = Format.relative(peer.updatedAt) { parts.append(rel) }
        return parts.joined(separator: " · ")
    }
}
