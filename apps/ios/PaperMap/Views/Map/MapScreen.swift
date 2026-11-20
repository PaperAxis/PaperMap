// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

struct MapScreen: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @EnvironmentObject private var location: LocationService
    @EnvironmentObject private var notifications: NotificationStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var showNotifications = false

    @State private var selected: Peer?
    @State private var recenter = 0
    @State private var focusPeerId: String?
    @State private var showPeople = false
    @State private var busy = false
    @State private var error: String?

    private var sharing: Bool { session.user?.sharingEnabled == true }

    var body: some View {
        ZStack(alignment: .top) {
            MapLibreView(
                peers: realtime.sortedPeers,
                dark: colorScheme == .dark,
                recenterRequest: recenter,
                focusPeerId: focusPeerId,
                onSelect: { selected = $0 }
            )
            .ignoresSafeArea(edges: .top)

            VStack(spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    sharingBar
                    bellButton
                }
                if let error { ErrorText(message: error).padding(10).background(Pa.bg).clipShape(RoundedRectangle(cornerRadius: Pa.radiusSm)) }
                if location.authorization == .denied || location.authorization == .restricted {
                    Label("Konum izni kapalı. Ayarlar'dan PaperMap için konuma izin ver.", systemImage: "location.slash")
                        .font(.footnote)
                        .foregroundColor(Pa.text)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Pa.bg)
                        .clipShape(RoundedRectangle(cornerRadius: Pa.radiusSm))
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            VStack {
                Spacer()
                HStack(spacing: 12) {
                    Spacer()
                    mapButton("person.2", label: "Kişiler") { showPeople = true }
                    mapButton("location", label: "Konumuma git") { recenter += 1 }
                }
                .padding(16)
            }
        }
        .sheet(item: $selected) { peer in
            PeerDetailSheet(peer: peer)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showNotifications) {
            NotificationsView()
        }
        .sheet(isPresented: $showPeople) {
            PeopleSheet(peers: realtime.sortedPeers) { peer in
                showPeople = false
                focusPeerId = peer.userId
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var sharingBar: some View {
        HStack(spacing: 12) {
            Image(systemName: sharing ? "location.fill" : "location.slash")
                .foregroundColor(sharing ? Pa.primary : Pa.muted)
            VStack(alignment: .leading, spacing: 2) {
                Text(sharing ? "Konum paylaşımı açık" : "Konum paylaşımı kapalı")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(Pa.text)
                Text(sharing ? "Arkadaşların ve ailen seni görebilir." : "Şu an kimse konumunu göremez.")
                    .font(.caption)
                    .foregroundColor(Pa.muted)
            }
            Spacer()
            Toggle("Konum paylaşımı", isOn: Binding(
                get: { sharing },
                set: { value in Task { await setSharing(value) } }
            ))
            .labelsHidden()
            .disabled(busy || session.user == nil)
        }
        .padding(12)
        .background(Pa.bg)
        .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
        .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
    }

    private var bellButton: some View {
        Button { showNotifications = true } label: {
            Image(systemName: "bell")
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

    private func mapButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel(label)
    }

    @MainActor
    private func setSharing(_ value: Bool) async {
        busy = true
        defer { busy = false }
        do {
            try await session.setSharing(value)
            error = nil
            if value { location.start() }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct PeerDetailSheet: View {
    let peer: Peer

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                AvatarView(name: peer.displayName, color: peer.avatarColor, path: peer.avatarPath, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(peer.displayName).font(.title3.weight(.semibold)).foregroundColor(Pa.text)
                    if let status = peer.statusText, !status.isEmpty {
                        Text(status).font(.subheadline).foregroundColor(Pa.muted)
                    }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                if let rel = Format.relative(peer.updatedAt) {
                    Label("Son güncelleme \(rel)", systemImage: "clock")
                }
                if let battery = peer.battery {
                    Label(
                        peer.charging == true ? String("Pil %\(battery), şarj oluyor") : String("Pil %\(battery)"),
                        systemImage: batteryIcon(battery, charging: peer.charging == true)
                    )
                }
                if let acc = peer.accuracy {
                    Label("Doğruluk ±\(Int(acc)) m", systemImage: "scope")
                }
            }
            .font(.subheadline)
            .foregroundColor(Pa.text)
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Pa.bg)
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
    let onPick: (Peer) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if peers.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "person.2").font(.largeTitle).foregroundColor(Pa.muted)
                        Text("Haritada kimse yok").font(.headline).foregroundColor(Pa.text)
                        Text("Konumunu paylaşan arkadaşların ve aile üyelerin burada görünür.")
                            .font(.subheadline).foregroundColor(Pa.muted).multilineTextAlignment(.center)
                    }
                    .padding(32)
                } else {
                    List(peers) { peer in
                        Button { onPick(peer) } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: peer.displayName, color: peer.avatarColor, path: peer.avatarPath, size: 40)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(peer.displayName).foregroundColor(Pa.text)
                                    if let rel = Format.relative(peer.updatedAt) {
                                        Text(rel).font(.caption).foregroundColor(Pa.muted)
                                    }
                                }
                                Spacer()
                                if let b = peer.battery {
                                    Text(verbatim: "%\(b)").font(.caption.monospacedDigit()).foregroundColor(Pa.muted)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Kişiler")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
