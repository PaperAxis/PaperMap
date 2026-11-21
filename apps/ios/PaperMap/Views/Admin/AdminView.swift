// Copyright (c) 2026 PaperAxis. All rights reserved.

import PhotosUI
import SwiftUI

/// Admin panel (web: Admin.jsx): stats, app name and logo, user management.
struct AdminView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var branding: Branding
    @State private var stats: AdminStats?
    @State private var users: [AdminUser] = []
    @State private var query = ""
    @State private var appName = ""
    @State private var logoItem: PhotosPickerItem?
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?
    @State private var pendingDelete: AdminUser?

    var body: some View {
        List {
            if error != nil || info != nil {
                Section {
                    if let error { ErrorText(message: error) }
                    if let info { InfoText(message: info) }
                }
            }
            if let stats {
                Section("İstatistik") {
                    statRow("kullanıcı", stats.users)
                    statRow("aile", stats.families)
                    statRow("sohbet", stats.conversations)
                    statRow("mesaj", stats.messages)
                }
            }
            Section("Uygulama ayarları") {
                HStack {
                    TextField("Uygulama adı", text: $appName)
                    Button("Kaydet") { Task { await saveName() } }
                        .buttonStyle(.bordered)
                        .disabled(busy || appName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                HStack(spacing: 12) {
                    if let url = Config.uploadURL(branding.settings.logoPath) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image { image.resizable().scaledToFit() } else { Pa.surface }
                        }
                        .frame(width: 44, height: 44)
                        .accessibilityLabel("Logo")
                    } else {
                        Text("Logo yok").foregroundColor(Pa.muted)
                    }
                    Spacer()
                    PhotosPicker(selection: $logoItem, matching: .images) {
                        Text("Yükle")
                    }
                    .buttonStyle(.bordered)
                    if branding.settings.logoPath != nil {
                        Button("Kaldır", role: .destructive) { Task { await removeLogo() } }
                            .buttonStyle(.bordered)
                    }
                }
                .disabled(busy)
            }
            Section {
                HStack {
                    TextField("Ad, kullanıcı adı veya e-posta ara", text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                        .onSubmit { Task { await loadUsers() } }
                    Button("Ara") { Task { await loadUsers() } }
                        .buttonStyle(.bordered)
                }
                ForEach(users) { u in
                    userRow(u)
                }
            } header: {
                Text("Kullanıcılar (\(users.count))")
            }
        }
        .navigationTitle("Yönetim")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "\(pendingDelete?.displayName ?? "") silinsin mi? Bu işlem geri alınamaz.",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Sil", role: .destructive) {
                if let u = pendingDelete { Task { await delete(u) } }
            }
            Button("Vazgeç", role: .cancel) {}
        }
        .onChange(of: logoItem) { item in
            guard let item else { return }
            Task { await uploadLogo(item) }
        }
        .refreshable { await loadAll() }
        .task {
            appName = branding.appName
            await loadAll()
        }
    }

    private func statRow(_ label: String, _ value: Int) -> some View {
        HStack {
            Text(verbatim: "\(value)").paFont(.body, weight: .semibold, monospacedDigit: true).foregroundColor(Pa.text)
            Text(label).foregroundColor(Pa.muted)
        }
        .accessibilityElement(children: .combine)
    }

    private func userRow(_ u: AdminUser) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                AvatarView(name: u.displayName, color: u.avatarColor, path: u.avatarPath, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(u.displayName).foregroundColor(Pa.text)
                        if u.isAdmin == true { tag("Yönetici", color: Pa.primary) }
                        if u.disabled == true { tag("Devre dışı", color: Pa.danger) }
                    }
                    Text(verbatim: "@\(u.username ?? "") · \(u.email ?? "")")
                        .paFont(.caption).foregroundColor(Pa.muted).lineLimit(1)
                }
            }
            if u.id != session.user?.id {
                HStack(spacing: 8) {
                    Button(u.disabled == true ? "Aktifleştir" : "Devre dışı") {
                        Task { await patch(u, disabled: !(u.disabled ?? false)) }
                    }
                    .buttonStyle(.bordered)
                    Button(u.isAdmin == true ? "Yöneticiliği al" : "Yönetici yap") {
                        Task { await patch(u, isAdmin: !(u.isAdmin ?? false)) }
                    }
                    .buttonStyle(.bordered)
                    Spacer()
                    Button("Sil", role: .destructive) { pendingDelete = u }
                        .buttonStyle(.bordered)
                }
                .paFont(.subheadline)
            }
        }
        .padding(.vertical, 4)
    }

    private func tag(_ text: String, color: Color) -> some View {
        Text(text)
            .paFont(.caption2, weight: .semibold)
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(Capsule().stroke(color, lineWidth: 1))
    }

    // MARK: Actions

    @MainActor
    private func loadAll() async {
        do {
            let res: AdminStatsResponse = try await session.api("GET", "/api/admin/stats")
            stats = res.stats
        } catch {
            fail(error)
        }
        await loadUsers()
        await branding.load()
    }

    @MainActor
    private func loadUsers() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        let encoded = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?
            .replacingOccurrences(of: "&", with: "%26")
            .replacingOccurrences(of: "+", with: "%2B") ?? ""
        do {
            let res: AdminUsersResponse = try await session.api("GET", "/api/admin/users" + (q.isEmpty ? "" : "?q=\(encoded)"))
            users = res.users
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func patch(_ u: AdminUser, disabled: Bool? = nil, isAdmin: Bool? = nil) async {
        struct Body: Encodable { let disabled: Bool?; let isAdmin: Bool? }
        do {
            let res: AdminUserResponse = try await session.api(
                "PATCH", "/api/admin/users/\(u.id)", body: Body(disabled: disabled, isAdmin: isAdmin)
            )
            if let idx = users.firstIndex(where: { $0.id == u.id }) { users[idx] = res.user }
            error = nil
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func delete(_ u: AdminUser) async {
        do {
            let _: EmptyResponse = try await session.api("DELETE", "/api/admin/users/\(u.id)")
            users.removeAll { $0.id == u.id }
            flash("Kullanıcı silindi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func saveName() async {
        struct Body: Encodable { let appName: String }
        busy = true
        defer { busy = false }
        do {
            let res: AppSettingsResponse = try await session.api(
                "PATCH", "/api/settings", body: Body(appName: appName.trimmingCharacters(in: .whitespaces))
            )
            branding.apply(res.settings)
            flash("Uygulama adı kaydedildi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func uploadLogo(_ item: PhotosPickerItem) async {
        busy = true
        defer {
            busy = false
            logoItem = nil
        }
        do {
            guard let raw = try await item.loadTransferable(type: Data.self),
                  let png = ImageUpload.png(from: raw, maxPixels: UploadKind.logo.maxPixels) else {
                error = "Görsel okunamadı."
                info = nil
                return
            }
            // PNG keeps the logo's transparency.
            let res: AppSettingsResponse = try await session.upload(.logo, data: png, png: true)
            branding.apply(res.settings)
            flash("Logo güncellendi.")
        } catch {
            fail(error)
        }
    }

    @MainActor
    private func removeLogo() async {
        busy = true
        defer { busy = false }
        do {
            let res: AppSettingsResponse = try await session.api("DELETE", "/api/settings/logo")
            branding.apply(res.settings)
            flash("Logo kaldırıldı.")
        } catch {
            fail(error)
        }
    }

    private func flash(_ message: String) {
        info = message
        error = nil
    }

    private func fail(_ err: Error) {
        error = err.localizedDescription
        info = nil
    }
}
