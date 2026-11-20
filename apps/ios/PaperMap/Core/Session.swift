// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

/// Signed-in state: token (Keychain), current user and authenticated API calls.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var token: String?
    @Published var user: User?

    init() {
        token = Keychain.load()
    }

    var isSignedIn: Bool { token != nil }

    func login(login: String, password: String) async throws {
        struct Body: Encodable { let login: String; let password: String }
        let res: AuthResponse = try await APIClient.send(
            "POST", "/api/auth/login",
            body: Body(login: login.trimmingCharacters(in: .whitespaces), password: password),
            token: nil
        )
        signIn(res)
    }

    func register(email: String, username: String, displayName: String, password: String) async throws {
        struct Body: Encodable {
            let email: String; let username: String; let displayName: String; let password: String
        }
        let res: AuthResponse = try await APIClient.send(
            "POST", "/api/auth/register",
            body: Body(
                email: email.trimmingCharacters(in: .whitespaces),
                username: username.trimmingCharacters(in: .whitespaces).lowercased(),
                displayName: displayName.trimmingCharacters(in: .whitespaces),
                password: password
            ),
            token: nil
        )
        signIn(res)
    }

    func logout() {
        Keychain.delete()
        token = nil
        user = nil
    }

    func refreshMe() async {
        do {
            let res: UserResponse = try await api("GET", "/api/auth/me")
            user = res.user
        } catch {
            // Offline or server error: keep the cached state; 401 already signed out.
        }
    }

    func updateDisplayName(_ name: String) async throws {
        struct Body: Encodable { let displayName: String }
        let res: UserResponse = try await api(
            "PATCH", "/api/auth/profile",
            body: Body(displayName: name.trimmingCharacters(in: .whitespaces))
        )
        user = res.user
    }

    func setSharing(_ enabled: Bool) async throws {
        struct Body: Encodable { let enabled: Bool }
        let res: UserResponse = try await api("PATCH", "/api/location/sharing", body: Body(enabled: enabled))
        user = res.user
    }

    /// Authenticated request; a 401 ends the session.
    func api<T: Decodable>(_ method: String, _ path: String, body: (any Encodable)? = nil) async throws -> T {
        do {
            return try await APIClient.send(method, path, body: body, token: token)
        } catch let err as APIError where err.isUnauthorized {
            logout()
            throw err
        }
    }

    private func signIn(_ res: AuthResponse) {
        Keychain.save(res.token)
        token = res.token
        user = res.user
    }
}
