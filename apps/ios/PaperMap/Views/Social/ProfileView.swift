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
