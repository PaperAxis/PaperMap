// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

/// Another user's profile (web: UserProfile.jsx): banner, avatar, @username,
/// message and location request. Must be pushed inside a NavigationStack.
struct UserProfileView: View {
    let userId: String

    @EnvironmentObject private var session: Session
    @EnvironmentObject private var chats: ChatStore
    @State private var user: PublicProfile?
    @State private var error: String?
    @State private var info: String?
    @State private var chatTarget: ChatTarget?
    @State private var openChat = false
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let user {
                    ProfileBanner(
                        name: user.displayName, color: user.avatarColor,
                        avatarPath: user.avatarPath, bannerPath: user.bannerPath
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.displayName).font(.title2.weight(.semibold)).foregroundColor(Pa.text)
                        if let u = user.username {
                            Text(verbatim: "@\(u)").foregroundColor(Pa.muted)
                        }
                    }
                    .padding(.horizontal, 16)
                } else if error == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 48)
                }

                VStack(alignment: .leading, spacing: 12) {
                    if let error { ErrorText(message: error) }
                    if let info { InfoText(message: info) }
                    if let user, user.id != session.user?.id {
                        Button {
                            Task { await message() }
                        } label: {
                            Label("Mesaj gönder", systemImage: "bubble.left")
                        }
                        .buttonStyle(PaPrimaryButtonStyle())
                        .disabled(busy)
                        Button {
                            Task { await requestLocation() }
                        } label: {
                            Label("Konum iste", systemImage: "mappin.and.ellipse")
                        }
                        .buttonStyle(PaSecondaryButtonStyle())
                        .disabled(busy)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationTitle(user?.displayName ?? "Profil")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $openChat) {
            if let chatTarget { ChatView(target: chatTarget) }
        }
        .task { await load() }
    }

    @MainActor
    private func load() async {
        do {
            let res: PublicProfileResponse = try await session.api("GET", "/api/users/\(userId)")
            user = res.user
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func message() async {
        guard let user else { return }
        busy = true
        defer { busy = false }
        do {
            chatTarget = try await chats.openDirect(with: user.id, title: user.displayName)
            openChat = true
            error = nil
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }

    @MainActor
    private func requestLocation() async {
        struct Body: Encodable { let userId: String }
        busy = true
        defer { busy = false }
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/location/request", body: Body(userId: userId))
            info = "Konum isteği gönderildi."
            error = nil
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }
}
