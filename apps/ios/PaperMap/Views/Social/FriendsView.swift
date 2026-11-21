// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

struct FriendsView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @EnvironmentObject private var chats: ChatStore
    @State private var chatTarget: ChatTarget?
    @State private var openChat = false
    @State private var profileId: String?
    @State private var openProfile = false
    @State private var data = FriendsResponse(friends: [], incoming: [], outgoing: [])
    @State private var loaded = false
    @State private var error: String?
    @State private var showAdd = false
    @State private var newUsername = ""
    @State private var notice: String?

    var body: some View {
        List {
            if let error {
                Section { ErrorText(message: error) }
            }
            if let notice {
                Section { Label(notice, systemImage: "checkmark.circle").foregroundColor(Pa.text) }
            }
            if !data.incoming.isEmpty {
                Section("Gelen istekler") {
                    ForEach(data.incoming) { entry in
                        HStack {
                            PersonRow(person: entry.user)
                            Spacer()
                            Button("Kabul et") { Task { await accept(entry) } }
                                .buttonStyle(.borderedProminent)
                            Button("Reddet") { Task { await remove(entry) } }
                                .buttonStyle(.bordered)
                        }
                    }
                }
            }
            Section("Arkadaşlar") {
                if data.friends.isEmpty && loaded {
                    Text("Henüz arkadaşın yok. Sağ üstten kullanıcı adıyla ekleyebilirsin.")
                        .paFont(.subheadline).foregroundColor(Pa.muted)
                }
                ForEach(data.friends) { entry in
                    HStack {
                        Button {
                            profileId = entry.user.id
                            openProfile = true
                        } label: {
                            PersonRow(person: entry.user)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityHint("Profili açar")
                        Spacer()
                        Button {
                            Task { await message(entry) }
                        } label: {
                            Label("Mesaj", systemImage: "bubble.left")
                        }
                        .buttonStyle(.bordered)
                    }
                    .swipeActions {
                        Button("Sil", role: .destructive) { Task { await remove(entry) } }
                    }
                }
            }
            if !data.outgoing.isEmpty {
                Section("Gönderilen istekler") {
                    ForEach(data.outgoing) { entry in
                        PersonRow(person: entry.user, subtitle: "Yanıt bekleniyor")
                            .swipeActions {
                                Button("Geri çek", role: .destructive) { Task { await remove(entry) } }
                            }
                    }
                }
            }
        }
        .navigationTitle("Arkadaşlar")
        .navigationDestination(isPresented: $openChat) {
            if let chatTarget { ChatView(target: chatTarget) }
        }
        .navigationDestination(isPresented: $openProfile) {
            if let profileId { UserProfileView(userId: profileId) }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    newUsername = ""
                    showAdd = true
                } label: {
                    Image(systemName: "person.badge.plus")
                }
                .accessibilityLabel("Arkadaş ekle")
            }
        }
        .alert("Arkadaş ekle", isPresented: $showAdd) {
            TextField("Kullanıcı adı", text: $newUsername)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("İstek gönder") { Task { await add() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Eklemek istediğin kişinin kullanıcı adını yaz.")
        }
        .refreshable { await load() }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            data = try await session.api("GET", "/api/friends")
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loaded = true
    }

    @MainActor
    private func add() async {
        struct Body: Encodable { let username: String }
        let name = newUsername.trimmingCharacters(in: .whitespaces).lowercased()
        guard !name.isEmpty else { return }
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/friends", body: Body(username: name))
            notice = "Arkadaşlık isteği gönderildi."
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func message(_ entry: FriendEntry) async {
        do {
            chatTarget = try await chats.openDirect(with: entry.user.id, title: entry.user.displayName)
            openChat = true
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func accept(_ entry: FriendEntry) async {
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/friends/\(entry.friendshipId)/accept")
            await load()
            realtime.refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func remove(_ entry: FriendEntry) async {
        do {
            let _: EmptyResponse = try await session.api("DELETE", "/api/friends/\(entry.friendshipId)")
            await load()
            realtime.refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct PersonRow: View {
    let person: PersonSummary
    var subtitle: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: person.displayName, color: person.avatarColor, path: person.avatarPath, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.displayName).foregroundColor(Pa.text)
                if let line = subtitle ?? person.username.map({ "@" + $0 }) {
                    Text(line).paFont(.caption).foregroundColor(Pa.muted)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
