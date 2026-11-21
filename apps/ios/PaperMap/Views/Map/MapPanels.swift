// Copyright (c) 2026 PaperAxis. All rights reserved.
// Map sheets (web: GeofencePanel.jsx, PlacesPanel.jsx, MeetingsPanel.jsx and
// the MapView.jsx create forms).

import SwiftUI

// MARK: - Shared pieces

/// Friends and family checklist used for geofence watches and meeting invites.
struct CandidateChecklist: View {
    let candidates: CandidatesResponse
    /// People already added (hidden from the list).
    var excluded: Set<String> = []
    @Binding var selected: Set<String>
    /// Shows "Tümünü seç" / "Kaldır" for the family group.
    var familySelectAll = false

    private var familyMembers: [CandidatePerson] {
        (candidates.family?.members ?? []).filter { !excluded.contains($0.id) }
    }

    private var friends: [CandidatePerson] {
        let familyIds = Set((candidates.family?.members ?? []).map(\.id))
        return candidates.friends.filter { !excluded.contains($0.id) && !familyIds.contains($0.id) }
    }

    var isEmpty: Bool { familyMembers.isEmpty && friends.isEmpty }

    var body: some View {
        if let family = candidates.family, !familyMembers.isEmpty {
            Section {
                ForEach(familyMembers) { row($0) }
            } header: {
                HStack {
                    Text("\(family.name) (aile)")
                    Spacer()
                    if familySelectAll {
                        let allIn = familyMembers.allSatisfy { selected.contains($0.id) }
                        Button(allIn ? "Kaldır" : "Tümünü seç") {
                            for m in familyMembers {
                                if allIn { selected.remove(m.id) } else { selected.insert(m.id) }
                            }
                        }
                        .font(.caption.weight(.semibold))
                        .textCase(nil)
                    }
                }
            }
        }
        if !friends.isEmpty {
            Section("Arkadaşlar") {
                ForEach(friends) { row($0) }
            }
        }
    }

    private func row(_ person: CandidatePerson) -> some View {
        let on = selected.contains(person.id)
        return Button {
            if on { selected.remove(person.id) } else { selected.insert(person.id) }
        } label: {
            HStack(spacing: 12) {
                AvatarView(name: person.displayName, color: person.avatarColor, path: person.avatarPath, size: 32)
                Text(person.displayName).foregroundColor(Pa.text)
                Spacer()
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(on ? Pa.primary : Pa.muted)
            }
        }
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// Saved place color swatches.
struct PlaceColorPicker: View {
    @Binding var color: String

    var body: some View {
        HStack(spacing: 12) {
            ForEach(placeColors, id: \.self) { hex in
                Button {
                    color = hex
                } label: {
                    Circle()
                        .fill(paColor(hex))
                        .frame(width: 32, height: 32)
                        .overlay(Circle().stroke(Pa.text, lineWidth: color == hex ? 3 : 0).padding(-4))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Renk \(hex)")
                .accessibilityAddTraits(color == hex ? .isSelected : [])
            }
        }
    }
}

private struct RadiusSlider: View {
    @Binding var radius: Double
    var upper: Double = 5000

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Yarıçap: \(Int(radius)) m").foregroundColor(Pa.text)
            Slider(value: $radius, in: 50...max(upper, 5000), step: 50)
                .accessibilityLabel("Yarıçap")
                .accessibilityValue("\(Int(radius)) metre")
        }
    }
}

// MARK: - Create at a tapped point

struct CreateAtPointSheet: View {
    let point: PendingPoint

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var radius: Double = 300
    @State private var color = placeColors[0]
    @State private var candidates = CandidatesResponse(friends: [], family: nil)
    @State private var invited = Set<String>()
    @State private var busy = false
    @State private var error: String?

    private var title: String {
        switch point.mode {
        case .geofence: return "Yeni alan"
        case .place: return "Yeni yer"
        case .meeting: return "Yeni buluşma"
        }
    }

    private var nameLabel: String {
        switch point.mode {
        case .geofence: return "Alan adı (örn. Ev, Okul)"
        case .place: return "Yer adı (örn. Ev, İş, Spor salonu)"
        case .meeting: return "Buluşma adı (örn. Akşam yemeği)"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(nameLabel, text: $name)
                    switch point.mode {
                    case .geofence:
                        RadiusSlider(radius: $radius)
                    case .place:
                        PlaceColorPicker(color: $color)
                    case .meeting:
                        EmptyView()
                    }
                }
                if let error {
                    Section { ErrorText(message: error) }
                }
                if point.mode == .meeting {
                    let list = CandidateChecklist(candidates: candidates, selected: $invited)
                    if list.isEmpty {
                        Section("Kimleri davet etmek istersin?") {
                            Text("Davet edebileceğin arkadaş ya da aile üyen yok.").foregroundColor(Pa.muted)
                        }
                    } else {
                        Section {
                            Text("Kimleri davet etmek istersin?").font(.subheadline.weight(.medium))
                        }
                        list
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(point.mode == .place ? "Kaydet" : "Oluştur") { Task { await submit() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .task {
                guard point.mode == .meeting else { return }
                if let res = try? await mapStore.candidates() { candidates = res }
            }
        }
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            switch point.mode {
            case .geofence:
                try await mapStore.createGeofence(name: name, lat: point.lat, lng: point.lng, radius: radius)
            case .place:
                try await mapStore.createPlace(name: name, lat: point.lat, lng: point.lng, color: color)
            case .meeting:
                try await mapStore.createMeeting(label: name, lat: point.lat, lng: point.lng, memberIds: Array(invited))
            }
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Geofences

struct GeofencesSheet: View {
    let onStartPlacing: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(action: onStartPlacing) {
                        Label("Yeni alan (haritada nokta seç)", systemImage: "plus")
                    }
                }
                if let error {
                    Section { ErrorText(message: error) }
                }
                Section {
                    if mapStore.geofences.isEmpty {
                        Text("Henüz alan yok. Yeni bir alan ekleyip seçtiğin kişiler girince/çıkınca bildirim al.")
                            .font(.subheadline).foregroundColor(Pa.muted)
                    }
                    ForEach(mapStore.geofences) { g in
                        NavigationLink {
                            GeofenceDetailView(geofenceId: g.id, closeSheet: { dismiss() })
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(g.name).foregroundColor(Pa.text)
                                Text("\(Int(g.radius)) m · \(g.watches.count) kişi izleniyor")
                                    .font(.caption).foregroundColor(Pa.muted)
                            }
                        }
                        .swipeActions {
                            Button("Sil", role: .destructive) { Task { await delete(g.id) } }
                        }
                    }
                }
            }
            .navigationTitle("Alanlar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
            }
            .refreshable { await mapStore.loadGeofences() }
            .task { await mapStore.loadGeofences() }
        }
    }

    @MainActor
    private func delete(_ id: String) async {
        do {
            try await mapStore.deleteGeofence(id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct GeofenceDetailView: View {
    let geofenceId: String
    let closeSheet: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var radius: Double = 300
    @State private var notifyOnEnter = true
    @State private var notifyOnExit = true
    @State private var candidates = CandidatesResponse(friends: [], family: nil)
    @State private var selected = Set<String>()
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?
    @State private var confirmDelete = false
    @State private var filled = false

    private var geofence: Geofence? { mapStore.geofences.first { $0.id == geofenceId } }

    var body: some View {
        Form {
            if let g = geofence {
                Section {
                    Button {
                        mapStore.flyTo(lat: g.lat, lng: g.lng, zoom: 15)
                        closeSheet()
                    } label: {
                        Label("Haritada gör", systemImage: "map")
                    }
                }
                if error != nil || info != nil {
                    Section {
                        if let error { ErrorText(message: error) }
                        if let info { InfoText(message: info) }
                    }
                }
                Section("Düzenle") {
                    TextField("Alan adı", text: $name)
                    RadiusSlider(radius: $radius, upper: g.radius)
                    Toggle("Girişte bildir", isOn: $notifyOnEnter)
                    Toggle("Çıkışta bildir", isOn: $notifyOnExit)
                    Button("Kaydet") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                Section("İzlenen kişiler") {
                    if g.watches.isEmpty {
                        Text("Kimse izlenmiyor.").foregroundColor(Pa.muted)
                    }
                    ForEach(g.watches) { w in
                        HStack(spacing: 12) {
                            AvatarView(name: w.displayName, color: w.avatarColor, path: w.avatarPath, size: 32)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(w.displayName).foregroundColor(Pa.text)
                                Text(w.inside == true ? "içeride" : w.inside == false ? "dışarıda" : "henüz bilinmiyor")
                                    .font(.caption).foregroundColor(Pa.muted)
                            }
                            Spacer()
                            Button("Çıkar") { Task { await removeWatch(w.userId) } }
                                .buttonStyle(.bordered)
                        }
                    }
                }
                let checklist = CandidateChecklist(
                    candidates: candidates,
                    excluded: Set(g.watches.map(\.userId)),
                    selected: $selected,
                    familySelectAll: true
                )
                if checklist.isEmpty {
                    Section("Kişi ekle") {
                        Text("Eklenebilecek kişi yok.").foregroundColor(Pa.muted)
                    }
                } else {
                    Section {
                        Text("Kişi ekle").font(.subheadline.weight(.medium))
                    }
                    checklist
                    Section {
                        Button("Seçilenleri ekle (\(selected.count))") { Task { await addSelected() } }
                            .disabled(busy || selected.isEmpty)
                    }
                }
                Section {
                    Button("Alanı sil", role: .destructive) { confirmDelete = true }
                }
            } else {
                Text("Alan bulunamadı").foregroundColor(Pa.muted)
            }
        }
        .navigationTitle(geofence?.name ?? "Alan")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Bu alan silinsin mi?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Sil", role: .destructive) { Task { await delete() } }
            Button("Vazgeç", role: .cancel) {}
        }
        .task {
            fill()
            if let res = try? await mapStore.candidates() { candidates = res }
        }
    }

    private func fill() {
        guard !filled, let g = geofence else { return }
        filled = true
        name = g.name
        radius = (g.radius / 50).rounded() * 50
        notifyOnEnter = g.notifyOnEnter
        notifyOnExit = g.notifyOnExit
    }

    @MainActor
    private func run(_ message: String?, _ work: () async throws -> Void) async {
        busy = true
        defer { busy = false }
        do {
            try await work()
            error = nil
            info = message
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }

    @MainActor
    private func save() async {
        await run("Alan kaydedildi.") {
            try await mapStore.updateGeofence(
                geofenceId, name: name, radius: radius,
                notifyOnEnter: notifyOnEnter, notifyOnExit: notifyOnExit
            )
        }
    }

    @MainActor
    private func addSelected() async {
        let ids = Array(selected)
        await run(nil) {
            try await mapStore.addWatches(geofenceId, userIds: ids)
            selected = []
        }
    }

    @MainActor
    private func removeWatch(_ userId: String) async {
        await run(nil) { try await mapStore.removeWatch(geofenceId, userId: userId) }
    }

    @MainActor
    private func delete() async {
        await run(nil) { try await mapStore.deleteGeofence(geofenceId) }
        if error == nil { dismiss() }
    }
}

// MARK: - Places

struct PlacesSheet: View {
    let onStartPlacing: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(action: onStartPlacing) {
                        Label("Yeni yer (haritada nokta seç)", systemImage: "plus")
                    }
                }
                if let error {
                    Section { ErrorText(message: error) }
                }
                Section {
                    if mapStore.places.isEmpty {
                        Text("Henüz kayıtlı yer yok. Sık gittiğin yerleri haritaya işaretle.")
                            .font(.subheadline).foregroundColor(Pa.muted)
                    }
                    ForEach(mapStore.places) { p in
                        NavigationLink {
                            PlaceDetailView(placeId: p.id, closeSheet: { dismiss() })
                        } label: {
                            HStack(spacing: 12) {
                                Circle().fill(paColor(p.color, fallback: placeColors[0])).frame(width: 14, height: 14)
                                Text(p.name).foregroundColor(Pa.text)
                            }
                        }
                        .swipeActions {
                            Button("Sil", role: .destructive) { Task { await delete(p.id) } }
                        }
                    }
                }
            }
            .navigationTitle("Kayıtlı yerler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
            }
            .refreshable { await mapStore.loadPlaces() }
        }
    }

    @MainActor
    private func delete(_ id: String) async {
        do {
            try await mapStore.deletePlace(id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct PlaceDetailView: View {
    let placeId: String
    let closeSheet: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var color = placeColors[0]
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?
    @State private var filled = false

    private var place: SavedPlace? { mapStore.places.first { $0.id == placeId } }

    var body: some View {
        Form {
            if let p = place {
                Section {
                    Button {
                        mapStore.flyTo(lat: p.lat, lng: p.lng)
                        closeSheet()
                    } label: {
                        Label("Haritada gör", systemImage: "map")
                    }
                    Button {
                        Task { await startTrip(p) }
                    } label: {
                        Label("Yola çık", systemImage: "car")
                    }
                    .disabled(busy)
                }
                if error != nil || info != nil {
                    Section {
                        if let error { ErrorText(message: error) }
                        if let info { InfoText(message: info) }
                    }
                }
                Section("Düzenle") {
                    TextField("Ad", text: $name)
                    PlaceColorPicker(color: $color)
                    Button("Kaydet") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                Section {
                    Button("Sil", role: .destructive) { Task { await delete() } }
                }
            } else {
                Text("Yer bulunamadı").foregroundColor(Pa.muted)
            }
        }
        .navigationTitle(place?.name ?? "Yer")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !filled, let p = place else { return }
            filled = true
            name = p.name
            color = p.color ?? placeColors[0]
        }
    }

    @MainActor
    private func startTrip(_ p: SavedPlace) async {
        busy = true
        defer { busy = false }
        do {
            try await mapStore.startTrip(to: p)
            closeSheet()
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }

    @MainActor
    private func save() async {
        busy = true
        defer { busy = false }
        do {
            try await mapStore.updatePlace(placeId, name: name, color: color)
            info = "Yer kaydedildi."
            error = nil
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }

    @MainActor
    private func delete() async {
        do {
            try await mapStore.deletePlace(placeId)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Meetings

struct MeetingsSheet: View {
    let onStartPlacing: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(action: onStartPlacing) {
                        Label("Yeni buluşma (haritada nokta seç)", systemImage: "plus")
                    }
                }
                Section {
                    if mapStore.meetings.isEmpty {
                        Text("Henüz buluşma yok. Bir nokta seçip kişileri davet et; herkesin oraya varış süresini birlikte görün.")
                            .font(.subheadline).foregroundColor(Pa.muted)
                    }
                    ForEach(mapStore.meetings) { m in
                        NavigationLink {
                            MeetingDetailView(meetingId: m.id, closeSheet: { dismiss() })
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.label).foregroundColor(Pa.text)
                                Text("\(m.memberCount ?? 1) kişi" + (m.isOwner ? " · sahibisin" : ""))
                                    .font(.caption).foregroundColor(Pa.muted)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Buluşmalar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
            }
            .refreshable { await mapStore.loadMeetings() }
            .task { await mapStore.loadMeetings() }
        }
    }
}

struct MeetingDetailView: View {
    let meetingId: String
    let closeSheet: () -> Void

    @EnvironmentObject private var mapStore: MapStore
    @Environment(\.dismiss) private var dismiss
    @State private var detail: MeetingDetailResponse?
    @State private var error: String?
    @State private var confirm = false

    private var meeting: Meeting? { detail?.meeting ?? mapStore.meetings.first { $0.id == meetingId } }

    var body: some View {
        List {
            if let error {
                Section { ErrorText(message: error) }
            }
            if let m = meeting {
                Section {
                    Button {
                        mapStore.flyTo(lat: m.lat, lng: m.lng)
                        closeSheet()
                    } label: {
                        Label("Haritada gör", systemImage: "map")
                    }
                }
            }
            Section {
                if let detail {
                    ForEach(detail.members) { member in
                        HStack(spacing: 12) {
                            AvatarView(name: member.displayName, color: member.avatarColor, path: member.avatarPath, size: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(member.displayName + (member.isOwner ? " (sahip)" : "")).foregroundColor(Pa.text)
                                Text(member.etaText).font(.caption).foregroundColor(Pa.muted)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                } else if error == nil {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Yükleniyor…").foregroundColor(Pa.muted)
                    }
                }
            } header: {
                Text("Katılımcılar")
            } footer: {
                Text("Varış süreleri 20 saniyede bir yenilenir.")
            }
            if let m = meeting {
                Section {
                    Button(m.isOwner ? "Buluşmayı sil" : "Buluşmadan ayrıl", role: .destructive) { confirm = true }
                }
            }
        }
        .navigationTitle(meeting?.label ?? "Buluşma")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            meeting?.isOwner == true ? "Buluşma silinsin mi?" : "Buluşmadan ayrılmak istiyor musun?",
            isPresented: $confirm,
            titleVisibility: .visible
        ) {
            Button(meeting?.isOwner == true ? "Sil" : "Ayrıl", role: .destructive) { Task { await removeOrLeave() } }
            Button("Vazgeç", role: .cancel) {}
        }
        .task {
            // Refreshed every 20 s while on screen, like the web panel.
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(nanoseconds: 20_000_000_000)
            }
        }
    }

    @MainActor
    private func load() async {
        do {
            detail = try await mapStore.meetingDetail(meetingId)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func removeOrLeave() async {
        do {
            if meeting?.isOwner == true {
                try await mapStore.deleteMeeting(meetingId)
            } else {
                try await mapStore.leaveMeeting(meetingId)
            }
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
