// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

/// Signed-in state: token (Keychain), current user and authenticated API calls.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var token: String?
    @Published var user: User? {
        // Remembered so the next launch starts in the right color scheme.
        didSet { if user?.theme != oldValue?.theme { Appearance.cache(themeId: user?.theme) } }
    }

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


    /// `durationMinutes` nil: unlimited. Only used when enabling.
    func setSharing(_ enabled: Bool, durationMinutes: Int? = nil) async throws {
        struct Body: Encodable { let enabled: Bool; let durationMinutes: Int? }
        let res: UserResponse = try await api(
            "PATCH", "/api/location/sharing",
            body: Body(enabled: enabled, durationMinutes: enabled ? durationMinutes : nil)
        )
        user = res.user
    }

    /// PATCH /api/auth/profile with only the non-nil fields. An empty statusText clears it.
    func updateProfile(_ patch: ProfilePatch) async throws {
        let res: UserResponse = try await api("PATCH", "/api/auth/profile", body: patch)
        user = res.user
    }

    func changePassword(current: String?, new newPassword: String) async throws {
        struct Body: Encodable { let currentPassword: String?; let newPassword: String }
        // Not through api(): a wrong current password answers 401, which must not sign out.
        let _: EmptyResponse = try await APIClient.send(
            "POST", "/api/auth/password",
            body: Body(currentPassword: user?.passwordSet == false ? nil : current, newPassword: newPassword),
            token: token
        )
        if user?.passwordSet == false { user?.hasPassword = true }
    }

    func resendVerification() async throws {
        let _: EmptyResponse = try await api("POST", "/api/auth/verify/resend")
    }

    /// Uploads a photo already prepared by ImageUpload (JPEG).
    func uploadProfileImage(_ kind: UploadKind, jpeg: Data) async throws {
        let res: UserResponse = try await upload(kind, data: jpeg)
        user = res.user
    }

    func removeProfileImage(_ kind: UploadKind) async throws {
        let res: UserResponse = try await api("DELETE", kind.path)
        user = res.user
    }

    /// Authenticated multipart upload; a 401 ends the session.
    func upload<T: Decodable>(_ kind: UploadKind, data: Data, png: Bool = false) async throws -> T {
        do {
            return try await APIClient.upload(
                kind.path, field: kind.field, data: data,
                filename: "\(kind.field).\(png ? "png" : "jpg")",
                mimeType: png ? "image/png" : "image/jpeg", token: token
            )
        } catch let err as APIError where err.isUnauthorized {
            logout()
            throw err
        }
    }

    // MARK: Signed-out account flows

    /// Same response whether or not the address is registered.
    func requestPasswordReset(email: String) async throws {
        struct Body: Encodable { let email: String }
        let _: EmptyResponse = try await APIClient.send(
            "POST", "/api/auth/forgot",
            body: Body(email: email.trimmingCharacters(in: .whitespaces)),
            token: nil
        )
    }

    func resetPassword(token resetToken: String, newPassword: String) async throws {
        struct Body: Encodable { let token: String; let newPassword: String }
        let _: EmptyResponse = try await APIClient.send(
            "POST", "/api/auth/reset", body: Body(token: resetToken, newPassword: newPassword), token: nil
        )
    }

    func verifyEmail(token verifyToken: String) async throws {
        let escaped = verifyToken.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? verifyToken
        let _: EmptyResponse = try await APIClient.send("GET", "/api/auth/verify/\(escaped)", token: nil)
        if isSignedIn { await refreshMe() }
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

/// Body for PATCH /api/auth/profile; nil fields are left out of the JSON.
struct ProfilePatch: Encodable {
    var displayName: String?
    var username: String?
    var avatarColor: String?
    var statusText: String?
    var theme: String?
    var fontPref: String?
    var iconStyle: String?
}
