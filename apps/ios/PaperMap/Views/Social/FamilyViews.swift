// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI
import UIKit

struct FamilyListView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @State private var families: [FamilySummary] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var showCreate = false
    @State private var showJoin = false
    @State private var input = ""

    var body: some View {
        List {
            if let error {
                Section { ErrorText(message: error) }
            }
            if families.isEmpty && loaded {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Henüz bir ailede değilsin").paFont(.headline).foregroundColor(Pa.text)
                        Text("Bir aile oluştur ve davet kodunu paylaş, ya da sana verilen kodla katıl.")
                            .paFont(.subheadline).foregroundColor(Pa.muted)
                    }
                    .padding(.vertical, 4)
                }
            }
            ForEach(families) { family in
                NavigationLink {
                    FamilyDetailView(familyId: family.id, onLeft: { Task { await load() } })
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(family.name).foregroundColor(Pa.text)
                        Text(family.memberCount.map { "\($0) üye" } ?? "")
                            .paFont(.caption).foregroundColor(Pa.muted)
                    }
                }
            }
        }
        .navigationTitle("Aile")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Aile oluştur") { input = ""; showCreate = true }
                    Button("Davet koduyla katıl") { input = ""; showJoin = true }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Aile ekle")
            }
        }
        .alert("Aile oluştur", isPresented: $showCreate) {
            TextField("Aile adı", text: $input)
            Button("Oluştur") { Task { await create() } }
            Button("Vazgeç", role: .cancel) {}
        }
        .alert("Aileye katıl", isPresented: $showJoin) {
            TextField("Davet kodu", text: $input)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
            Button("Katıl") { Task { await join() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Aile üyesinin paylaştığı davet kodunu yaz.")
        }
        .refreshable { await load() }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            let res: FamiliesResponse = try await session.api("GET", "/api/families")
            families = res.families
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loaded = true
    }

    @MainActor
    private func create() async {
        struct Body: Encodable { let name: String }
        let name = input.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/families", body: Body(name: name))
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func join() async {
        struct Body: Encodable { let inviteCode: String }
        let code = input.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else { return }
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/families/join", body: Body(inviteCode: code))
            await load()
            realtime.refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct FamilyDetailView: View {
    let familyId: String
    let onLeft: () -> Void

    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @Environment(\.dismiss) private var dismiss
    @State private var detail: FamilyDetail?
    @State private var error: String?
    @State private var copied = false
    @State private var confirmLeave = false

    var body: some View {
        List {
            if let error {
                Section { ErrorText(message: error) }
            }
            if let detail {
                if let code = detail.inviteCode {
                    Section {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Davet kodu").paFont(.caption).foregroundColor(Pa.muted)
                                Text(code).font(.system(.title3, design: .monospaced).weight(.semibold))
                                    .foregroundColor(Pa.text)
                                    .textSelection(.enabled)
                            }
                            Spacer()
                            Button(copied ? "Kopyalandı" : "Kopyala") {
                                UIPasteboard.general.string = code
                                copied = true
                            }
                            .buttonStyle(.bordered)
                        }
                    } footer: {
                        Text("Bu kodu paylaştığın kişiler aileye katılabilir.")
                    }
                }
                Section("Üyeler") {
                    ForEach(detail.members) { m in
                        if m.id == session.user?.id {
                            memberRow(m, ownerId: detail.ownerId)
                        } else {
                            NavigationLink {
                                UserProfileView(userId: m.id)
                            } label: {
                                memberRow(m, ownerId: detail.ownerId)
                            }
                        }
                    }
                }
                Section {
                    Button("Aileden ayrıl", role: .destructive) { confirmLeave = true }
                }
            } else if error == nil {
                ProgressView()
            }
        }
        .navigationTitle(detail?.name ?? "Aile")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Aileden ayrılmak istiyor musun?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Aileden ayrıl", role: .destructive) { Task { await leave() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Aile üyeleri artık konumunu göremez. Tekrar katılmak için davet kodu gerekir.")
        }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            detail = try await session.api("GET", "/api/families/\(familyId)")
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func memberRow(_ m: FamilyMember, ownerId: String?) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: m.displayName, color: m.avatarColor, path: m.avatarPath, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(m.displayName).foregroundColor(Pa.text)
                if let u = m.username {
                    Text(verbatim: "@\(u)").paFont(.caption).foregroundColor(Pa.muted)
                }
            }
            Spacer()
            if m.id == ownerId {
                Text("Yönetici").paFont(.caption).foregroundColor(Pa.muted)
            }
        }
    }

    @MainActor
    private func leave() async {
        do {
            let _: EmptyResponse = try await session.api("DELETE", "/api/families/\(familyId)/leave")
            realtime.refresh()
            onLeft()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
