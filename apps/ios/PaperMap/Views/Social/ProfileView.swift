// Copyright (c) 2026 PaperAxis. All rights reserved.

import PhotosUI
import SwiftUI
import UIKit

struct ProfileView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var location: LocationService
    @State private var displayName = ""
    @State private var username = ""
    @State private var avatarColor = Color.blue
    @State private var statusText = ""
    @State private var busy = false
    @State private var verifyBusy = false
    @State private var error: String?
    @State private var info: String?
    @State private var confirmLogout = false
    @State private var askDuration = false
    @State private var avatarItem: PhotosPickerItem?
    @State private var bannerItem: PhotosPickerItem?

    private static let statusPresets = ["Evdeyim", "Yoldayım", "İşteyim", "Müsait değilim"]

    private var sharing: Bool { session.user?.sharingEnabled == true }

    var body: some View {
        Form {
            if let user = session.user {
                header(user)
                if error != nil || info != nil {
                    Section {
                        if let error { ErrorText(message: error) }
                        if let info { InfoText(message: info) }
                    }
                }
                if user.isAdmin == true {
                    Section {
                        NavigationLink {
                            AdminView()
                        } label: {
                            Label("Yönetim paneli", systemImage: "wrench.and.screwdriver")
                        }
                    }
                }
                if user.emailVerified == false {
                    verifySection(user)
                }
                infoSection(user)
                statusSection
                sharingSection
                Section {
                    NavigationLink {
                        AppearanceView()
                    } label: {
                        Label("Görünüm", systemImage: "paintpalette")
                    }
                    NavigationLink {
                        LocationPrivacyView()
                    } label: {
                        Label("Konum gizliliği", systemImage: "eye.slash")
                    }
                    NavigationLink {
                        ShareLinksView()
                    } label: {
                        Label("Geçici konum bağlantısı", systemImage: "link")
                    }
                    NavigationLink {
                        PasswordView()
                    } label: {
                        Label(user.passwordSet ? "Şifre değiştir" : "Şifre belirle", systemImage: "key")
                    }
                }
            } else {
                ProgressView()
            }

            if session.user != nil {
                LinkedAccountsSection()
            }

            Section("Hakkında") {
                HStack(spacing: 12) {
                    Image("LaunchLogo").resizable().frame(width: 40, height: 40).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("PaperMap").font(.headline).foregroundColor(Pa.text)
                        Text(verbatim: "Sürüm \(Config.version) (\(Config.build))")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(Pa.muted)
                    }
                }
                Text("Bir PaperAxis ürünüdür.").foregroundColor(Pa.text)
                Text(verbatim: "© 2026 PaperAxis. Tüm hakları saklıdır.").font(.caption).foregroundColor(Pa.muted)
                Link("info@paperaxis.com", destination: URL(string: "mailto:info@paperaxis.com")!)
            }

            Section {
                Button("Oturumu kapat", role: .destructive) { confirmLogout = true }
            }
        }
        .navigationTitle("Profil")
        .confirmationDialog("Oturumu kapatmak istiyor musun?", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("Oturumu kapat", role: .destructive) { session.logout() }
            Button("Vazgeç", role: .cancel) {}
        }
        .sharingDurationDialog(isPresented: $askDuration) { minutes in
            Task { await setSharing(true, minutes: minutes) }
        }
        .onAppear { fillForm() }
        .onChange(of: session.user?.id) { _ in fillForm() }
        .onChange(of: avatarItem) { item in
            guard let item else { return }
            Task { await upload(item, kind: .avatar) }
        }
        .onChange(of: bannerItem) { item in
            guard let item else { return }
            Task { await upload(item, kind: .banner) }
        }
    }

    // MARK: Sections

    private func header(_ user: User) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                ProfileBanner(
                    name: user.displayName, color: user.avatarColor,
                    avatarPath: user.avatarPath, bannerPath: user.bannerPath
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.displayName).font(.title3.weight(.semibold)).foregroundColor(Pa.text)
                    if let u = user.username {
                        Text(verbatim: "@\(u)").font(.subheadline).foregroundColor(Pa.muted)
                    }
                    if let status = user.statusText, !status.isEmpty {
                        Text(status).font(.subheadline).foregroundColor(Pa.text)
                    }
                }
                .padding(.horizontal, 16)
                HStack(spacing: 12) {
                    PhotosPicker(selection: $bannerItem, matching: .images) {
                        Label("Banner yükle", systemImage: "photo")
                    }
                    .buttonStyle(.bordered)
                    if user.bannerPath != nil {
                        Button("Kaldır", role: .destructive) { Task { await remove(.banner) } }
                            .buttonStyle(.bordered)
                    }
                }
                .disabled(busy)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
            }
            .listRowInsets(EdgeInsets())
        }
    }

    private func verifySection(_ user: User) -> some View {
        Section {
            Text("E-posta adresin (\(user.email ?? "")) henüz doğrulanmadı. Doğrulama bağlantısını e-postandan onayla.")
                .font(.subheadline)
                .foregroundColor(Pa.text)
            Button {
                Task { await resendVerify() }
            } label: {
                if verifyBusy { ProgressView() } else { Text("Doğrulama e-postası gönder") }
            }
            .disabled(verifyBusy)
        } header: {
            Text("E-posta doğrulama")
        }
    }

    private func infoSection(_ user: User) -> some View {
        Section {
            HStack(spacing: 12) {
                AvatarView(name: user.displayName, color: user.avatarColor, path: user.avatarPath, size: 56)
                PhotosPicker(selection: $avatarItem, matching: .images) {
                    Text("Fotoğraf yükle")
                }
                .buttonStyle(.bordered)
                if user.avatarPath != nil {
                    Button("Kaldır", role: .destructive) { Task { await remove(.avatar) } }
                        .buttonStyle(.bordered)
                }
            }
            .disabled(busy)
            TextField("Görünen ad", text: $displayName)
                .textContentType(.name)
            VStack(alignment: .leading, spacing: 4) {
                TextField("Kullanıcı adı", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)
                    .onChange(of: username) { value in
                        let lower = value.lowercased()
                        if lower != value { username = lower }
                    }
                Text(verbatim: "Arkadaşların seni @\(username) ile bulur.")
                    .font(.caption).foregroundColor(Pa.muted)
            }
            if user.avatarPath == nil {
                ColorPicker("Avatar rengi", selection: $avatarColor, supportsOpacity: false)
            }
            Button("Kaydet") { Task { await saveInfo() } }
                .disabled(busy || displayName.trimmingCharacters(in: .whitespaces).isEmpty || username.count < 3)
        } header: {
            Text("Profil bilgileri")
        }
    }

    private var statusSection: some View {
        Section {
            ForEach(Self.statusPresets, id: \.self) { preset in
                Button {
                    Task { await saveStatus(preset) }
                } label: {
                    HStack {
                        Text(preset).foregroundColor(Pa.text)
                        Spacer()
                        if session.user?.statusText == preset {
                            Image(systemName: "checkmark").foregroundColor(Pa.primary)
                        }
                    }
                }
                .accessibilityAddTraits(session.user?.statusText == preset ? .isSelected : [])
            }
            TextField("Özel durum (örn. Tatildeyim)", text: $statusText)
                .onChange(of: statusText) { value in
                    if value.count > 60 { statusText = String(value.prefix(60)) }
                }
            HStack {
                Button("Temizle") { Task { await saveStatus("") } }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Kaydet") { Task { await saveStatus(statusText.trimmingCharacters(in: .whitespaces)) } }
                    .buttonStyle(.borderedProminent)
            }
        } header: {
            Text("Durum")
        } footer: {
            Text("Arkadaşların ve aile üyelerin durumunu haritada ve kişi listesinde görür.")
        }
    }

    private var sharingSection: some View {
        Section {
            Toggle("Konumumu paylaş", isOn: Binding(
                get: { sharing },
                set: { value in
                    if value { askDuration = true } else { Task { await setSharing(false, minutes: nil) } }
                }
            ))
            if sharing, session.user?.sharingUntil != nil {
                TimelineView(.periodic(from: .now, by: 30)) { context in
                    Text(SharingText.label(for: session.user, now: context.date))
                        .font(.subheadline).foregroundColor(Pa.muted)
                }
            }
        } footer: {
            Text("Kapalıyken arkadaşların ve ailen konumunu göremez. Uygulama kapalıyken de paylaşım için konum iznini \"Her zaman\" olarak ver.")
        }
    }

    // MARK: Actions

    private func fillForm() {
        guard let user = session.user else { return }
        displayName = user.displayName
        username = user.username ?? ""
        avatarColor = paColor(user.avatarColor)
        statusText = user.statusText ?? ""
    }

    private func flash(_ message: String) {
        info = message
        error = nil
    }

    private func fail(_ err: Error) {
        error = err.localizedDescription
        info = nil
    }

    @MainActor
    private func saveInfo() async {
        busy = true
        defer { busy = false }
        var patch = ProfilePatch(
            displayName: displayName.trimmingCharacters(in: .whitespaces),
            username: username.trimmingCharacters(in: .whitespaces).lowercased()
        )
        if session.user?.avatarPath == nil {
            patch.avatarColor = UIColor(avatarColor).hexString
        }
        do {
            try await session.updateProfile(patch)
            flash("Profil bilgileri kaydedildi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func saveStatus(_ value: String) async {
        do {
            try await session.updateProfile(ProfilePatch(statusText: value))
            statusText = value
            flash(value.isEmpty ? "Durum temizlendi." : "Durum güncellendi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func resendVerify() async {
        verifyBusy = true
        defer { verifyBusy = false }
        do {
            try await session.resendVerification()
            flash("Doğrulama e-postası gönderildi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func upload(_ item: PhotosPickerItem, kind: UploadKind) async {
        busy = true
        defer {
            busy = false
            if kind == .avatar { avatarItem = nil } else { bannerItem = nil }
        }
        do {
            guard let raw = try await item.loadTransferable(type: Data.self),
                  let jpeg = ImageUpload.jpeg(from: raw, maxPixels: kind.maxPixels) else {
                error = "Görsel okunamadı."
                info = nil
                return
            }
            try await session.uploadProfileImage(kind, jpeg: jpeg)
            flash(kind == .avatar ? "Profil fotoğrafı güncellendi." : "Banner güncellendi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func remove(_ kind: UploadKind) async {
        busy = true
        defer { busy = false }
        do {
            try await session.removeProfileImage(kind)
            flash(kind == .avatar ? "Profil fotoğrafı kaldırıldı." : "Banner kaldırıldı.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func setSharing(_ value: Bool, minutes: Int?) async {
        do {
            try await session.setSharing(value, durationMinutes: minutes)
            error = nil
            if value { location.start() }
        } catch {
            fail(error)
        }
    }
}

/// "Bağlı hesaplar": link or unlink Google / PaperApp (docs/SSO.md).
struct LinkedAccountsSection: View {
    @EnvironmentObject private var session: Session
    @State private var enabled: [SSOProvider] = []
    @State private var identities: [SSOIdentity] = []
    @State private var hasPassword = true
    @State private var busy: SSOProvider?
    @State private var error: String?

    var body: some View {
        Section {
            if enabled.isEmpty {
                Text("Bağlanabilecek hesap yok.").foregroundColor(Pa.muted)
            }
            ForEach(enabled) { provider in
                let identity = identities.first(where: { $0.provider == provider.rawValue })
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(provider.title).foregroundColor(Pa.text)
                        if let identity {
                            Text(identity.email ?? "Bağlı").font(.caption).foregroundColor(Pa.muted)
                        } else {
                            Text("Bağlı değil").font(.caption).foregroundColor(Pa.muted)
                        }
                    }
                    Spacer()
                    if busy == provider {
                        ProgressView()
                    } else if identity != nil {
                        Button("Kaldır", role: .destructive) { Task { await unlink(provider) } }
                            .buttonStyle(.borderless)
                            .disabled(busy != nil)
                    } else {
                        Button("Bağla") { Task { await link(provider) } }
                            .buttonStyle(.borderless)
                            .disabled(busy != nil)
                    }
                }
                .frame(minHeight: 44)
            }
        } header: {
            Text("Bağlı hesaplar")
        } footer: {
            VStack(alignment: .leading, spacing: 6) {
                if !hasPassword {
                    Text("Şifren yok; giriş için bağlı hesabını kullan.")
                }
                if let error { ErrorText(message: error) }
            }
        }
        .task { await reload() }
    }

    @MainActor
    private func reload() async {
        enabled = await session.ssoProviders()
        do {
            let res = try await session.identities()
            identities = res.identities
            hasPassword = res.hasPassword ?? (session.user?.passwordSet ?? true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func link(_ provider: SSOProvider) async {
        busy = provider
        defer { busy = nil }
        do {
            try await session.linkProvider(provider)
            error = nil
        } catch SSOError.cancelled {
            // Sheet closed by the user.
        } catch {
            self.error = error.localizedDescription
        }
        await reload()
    }

    @MainActor
    private func unlink(_ provider: SSOProvider) async {
        busy = provider
        defer { busy = nil }
        do {
            try await session.unlinkProvider(provider)
            error = nil
        } catch let err as APIError where err.status == 409 {
            error = err.message.isEmpty
                ? "Bu bağlantı kaldırılamaz: hesabının şifresi yok ve başka bağlı hesabı kalmıyor."
                : err.message
        } catch {
            self.error = error.localizedDescription
        }
        await reload()
    }
}
