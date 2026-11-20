// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var location: LocationService
    @State private var displayName = ""
    @State private var saving = false
    @State private var error: String?
    @State private var saved = false
    @State private var confirmLogout = false

    private var sharing: Bool { session.user?.sharingEnabled == true }

    var body: some View {
        Form {
            if let user = session.user {
                Section {
                    HStack(spacing: 12) {
                        AvatarView(name: user.displayName, color: user.avatarColor, path: user.avatarPath, size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.displayName).font(.headline).foregroundColor(Pa.text)
                            if let u = user.username {
                                Text(verbatim: "@\(u)").font(.subheadline).foregroundColor(Pa.muted)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    TextField("Görünen ad", text: $displayName)
                    Button(saved ? "Kaydedildi" : "Kaydet") { Task { await save() } }
                        .disabled(saving || displayName.trimmingCharacters(in: .whitespaces).isEmpty
                            || displayName == user.displayName)
                } header: {
                    Text("Görünen ad")
                } footer: {
                    if let error { ErrorText(message: error) }
                }
                Section {
                    Toggle("Konumumu paylaş", isOn: Binding(
                        get: { sharing },
                        set: { value in Task { await setSharing(value) } }
                    ))
                } footer: {
                    Text("Kapalıyken arkadaşların ve ailen konumunu göremez. Uygulama kapalıyken de paylaşım için konum iznini \"Her zaman\" olarak ver.")
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
        .onAppear { displayName = session.user?.displayName ?? "" }
        .onChange(of: session.user?.displayName) { name in
            if let name, displayName.isEmpty { displayName = name }
        }
    }

    @MainActor
    private func save() async {
        saving = true
        defer { saving = false }
        do {
            try await session.updateDisplayName(displayName)
            error = nil
            saved = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func setSharing(_ value: Bool) async {
        do {
            try await session.setSharing(value)
            error = nil
            if value { location.start() }
        } catch {
            self.error = error.localizedDescription
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
