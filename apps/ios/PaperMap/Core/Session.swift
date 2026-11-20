// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

/// Signed-in state: token (Keychain), current user and authenticated API calls.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var token: String?
    @Published var user: User?

    /// Login name saved by "Beni hatırla"; prefills the login form.
    @Published private(set) var rememberedLogin: String

    private static let loginKey = "papermap.rememberedLogin"

    init() {
        token = Keychain.load()
        rememberedLogin = UserDefaults.standard.string(forKey: Self.loginKey) ?? ""
    }

    var isSignedIn: Bool { token != nil }

    /// `remember` false: token is kept in memory only and is gone when the app quits.
    func login(login: String, password: String, remember: Bool = true) async throws {
        struct Body: Encodable { let login: String; let password: String }
        let res: AuthResponse = try await APIClient.send(
            "POST", "/api/auth/login",
            body: Body(login: login.trimmingCharacters(in: .whitespaces), password: password),
            token: nil
        )
        let name = login.trimmingCharacters(in: .whitespaces)
        if remember {
            UserDefaults.standard.set(name, forKey: Self.loginKey)
            rememberedLogin = name
        } else {
            UserDefaults.standard.removeObject(forKey: Self.loginKey)
            rememberedLogin = ""
        }
        signIn(res, persist: remember)
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

    // MARK: External sign-in (docs/SSO.md)

    /// Providers the server has configured; unknown keys are ignored.
    func ssoProviders() async -> [SSOProvider] {
        do {
            let res: SSOProvidersResponse = try await APIClient.send("GET", "/api/auth/sso/providers", token: nil)
            return SSOProvider.allCases.filter { res.providers.contains($0.rawValue) }
        } catch {
            return []
        }
    }

    /// Full browser sign-in with a provider. Throws SSOError.cancelled when the user backs out.
    func loginWithProvider(_ provider: SSOProvider) async throws {
        guard let url = SSOFlow.startURL(provider: provider, mode: "login") else {
            throw SSOError.server("Geçersiz adres")
        }
        let callback = try await SSOFlow.authenticate(url: url)
        let code = try SSOFlow.code(from: callback, provider: provider)
        let res = try await exchangeSSO(code: code)
        guard let token = res.token, let user = res.user else {
            throw SSOError.server("Giriş tamamlanamadı.")
        }
        signIn(AuthResponse(token: token, user: user), persist: true)
    }

    /// Links a provider to the signed-in account.
    func linkProvider(_ provider: SSOProvider) async throws {
        struct Body: Encodable { let provider: String }
        let ticket: SSOTicketResponse = try await api(
            "POST", "/api/auth/sso/link-ticket", body: Body(provider: provider.rawValue)
        )
        guard let url = SSOFlow.startURL(provider: provider, mode: "link", ticket: ticket.ticket) else {
            throw SSOError.server("Geçersiz adres")
        }
        let callback = try await SSOFlow.authenticate(url: url)
        let code = try SSOFlow.code(from: callback, provider: provider)
        let res = try await exchangeSSO(code: code)
        if let user = res.user { self.user = user }
    }

    func identities() async throws -> SSOIdentitiesResponse {
        try await api("GET", "/api/auth/identities")
    }

    func unlinkProvider(_ provider: SSOProvider) async throws {
        let _: EmptyResponse = try await api("DELETE", "/api/auth/identities/\(provider.rawValue)")
    }

    private func exchangeSSO(code: String) async throws -> SSOExchangeResponse {
        struct Body: Encodable { let code: String }
        return try await APIClient.send("POST", "/api/auth/sso/exchange", body: Body(code: code), token: token)
    }

    private func signIn(_ res: AuthResponse, persist: Bool = true) {
        if persist { Keychain.save(res.token) } else { Keychain.delete() }
        token = res.token
        user = res.user
    }
}
