// Copyright (c) 2026 PaperAxis. All rights reserved.
// Profile sub-screens (web: Profile.jsx): location privacy, temporary share
// links and password.

import SwiftUI
import UIKit

/// Per-person location privacy: unchecked people cannot see my location.
struct LocationPrivacyView: View {
    @EnvironmentObject private var session: Session
    @State private var people: [PrivacyPerson] = []
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        List {
            if let error {
                Section { ErrorText(message: error) }
            }
            Section {
                if people.isEmpty && loaded {
                    Text("Henüz arkadaşın ya da aile üyen yok.").foregroundColor(Pa.muted)
                }
                ForEach(people) { person in
                    Toggle(isOn: Binding(
                        get: { !person.hidden },
                        set: { visible in Task { await setHidden(person.id, hidden: !visible) } }
                    )) {
                        HStack(spacing: 12) {
                            AvatarView(name: person.displayName, color: person.avatarColor, path: person.avatarPath, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(person.displayName).foregroundColor(Pa.text)
                                Text(person.hidden ? "Konumunu göremez" : "Konumunu görebilir")
                                    .paFont(.caption).foregroundColor(Pa.muted)
                            }
                        }
                    }
                }
            } footer: {
                Text("İşareti kaldırdığın kişiler konumunu haritada göremez.")
            }
        }
        .navigationTitle("Konum gizliliği")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            let res: PrivacyPeopleResponse = try await session.api("GET", "/api/privacy/people")
            people = res.people
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loaded = true
    }

    @MainActor
    private func setHidden(_ id: String, hidden: Bool) async {
        struct Body: Encodable { let hidden: Bool }
        guard let idx = people.firstIndex(where: { $0.id == id }) else { return }
        people[idx].hidden = hidden
        do {
            let _: EmptyResponse = try await session.api("PUT", "/api/privacy/hidden/\(id)", body: Body(hidden: hidden))
            error = nil
        } catch {
            if let i = people.firstIndex(where: { $0.id == id }) { people[i].hidden = !hidden }
            self.error = error.localizedDescription
        }
    }
}

/// Temporary public links to my live location, valid for 1, 8 or 24 hours.
struct ShareLinksView: View {
    @EnvironmentObject private var session: Session
    @State private var links: [LocationShareLink] = []
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?

    var body: some View {
        List {
            Section {
                Text("Uygulaması olmayan birine, süreli bir bağlantıyla canlı konumunu gösterebilirsin. Süre dolunca bağlantı kendiliğinden geçersizleşir.")
                    .paFont(.subheadline)
                    .foregroundColor(Pa.text)
                HStack(spacing: 8) {
                    durationButton("1 saat", minutes: 60)
                    durationButton("8 saat", minutes: 8 * 60)
                    durationButton("24 saat", minutes: 24 * 60)
                }
                .disabled(busy)
            }
            if error != nil || info != nil {
                Section {
                    if let error { ErrorText(message: error) }
                    if let info { InfoText(message: info) }
                }
            }
            if !links.isEmpty {
                Section("Etkin bağlantılar") {
                    ForEach(links) { link in
                        VStack(alignment: .leading, spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Bağlantı").foregroundColor(Pa.text)
                                Text("Bitiş: \(Format.dayTime(link.expiresAt) ?? "-")")
                                    .paFont(.caption).foregroundColor(Pa.muted)
                            }
                            HStack(spacing: 8) {
                                Button("Kopyala") { copy(link) }
                                    .buttonStyle(.bordered)
                                if let url = link.url {
                                    ShareLink(item: url) {
                                        Label("Paylaş", systemImage: "square.and.arrow.up")
                                    }
                                    .buttonStyle(.bordered)
                                }
                                Spacer()
                                Button("İptal", role: .destructive) { Task { await revoke(link) } }
                                    .buttonStyle(.bordered)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Geçici konum bağlantısı")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    private func durationButton(_ title: String, minutes: Int) -> some View {
        Button(title) { Task { await create(minutes) } }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
    }

    @MainActor
    private func load() async {
        do {
            let res: ShareLinksResponse = try await session.api("GET", "/api/sharelinks")
            links = res.links
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func create(_ minutes: Int) async {
        struct Body: Encodable { let durationMinutes: Int }
        busy = true
        defer { busy = false }
        do {
            let res: ShareLinkResponse = try await session.api("POST", "/api/sharelinks", body: Body(durationMinutes: minutes))
            links.insert(res.link, at: 0)
            info = "Konum bağlantısı oluşturuldu."
            error = nil
        } catch {
            fail(error)
        }
    }

    private func copy(_ link: LocationShareLink) {
        guard let url = link.url else { return }
        UIPasteboard.general.string = url.absoluteString
        info = "Bağlantı panoya kopyalandı."
        error = nil
    }

    @MainActor
    private func revoke(_ link: LocationShareLink) async {
        do {
            let _: EmptyResponse = try await session.api("DELETE", "/api/sharelinks/\(link.id)")
            links.removeAll { $0.id == link.id }
            error = nil
        } catch {
            fail(error)
        }
    }

    private func fail(_ err: Error) {
        error = err.localizedDescription
        info = nil
    }
}

/// Change the password, or set a first one for accounts opened with Google/PaperApp.
struct PasswordView: View {
    @EnvironmentObject private var session: Session
    @State private var current = ""
    @State private var newPassword = ""
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?

    private var hasPassword: Bool { session.user?.passwordSet ?? true }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !hasPassword {
                    Text("Hesabını Google ya da PaperApp ile açtın. Şifre belirlersen kullanıcı adınla da giriş yapabilirsin.")
                        .paFont(.subheadline)
                        .foregroundColor(Pa.muted)
                } else {
                    LabeledField(label: "Mevcut şifre", text: $current, secure: true, contentType: .password)
                }
                LabeledField(label: "Yeni şifre (en az 8 karakter)", text: $newPassword, secure: true, contentType: .newPassword)
                if let error { ErrorText(message: error) }
                if let info { InfoText(message: info) }
                Button {
                    Task { await submit() }
                } label: {
                    if busy {
                        ProgressView().tint(Pa.onPrimary)
                    } else {
                        Text(hasPassword ? "Şifreyi değiştir" : "Şifreyi belirle")
                    }
                }
                .buttonStyle(PaPrimaryButtonStyle())
                .disabled(busy || newPassword.count < 8 || (hasPassword && current.isEmpty))
            }
            .padding(24)
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationTitle(hasPassword ? "Şifre değiştir" : "Şifre belirle")
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        let wasSet = hasPassword
        do {
            try await session.changePassword(current: current, new: newPassword)
            current = ""
            newPassword = ""
            info = wasSet ? "Şifre değiştirildi." : "Şifre belirlendi."
            error = nil
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }
}
