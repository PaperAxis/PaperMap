// Copyright (c) 2026 PaperAxis. All rights reserved.

import AuthenticationServices
import Foundation
import UIKit

/// External sign-in providers (docs/SSO.md). The server runs the OAuth flow;
/// the app only opens the start URL and exchanges the one-time PaperMap code.
enum SSOProvider: String, CaseIterable, Identifiable {
    case google
    case paperapp

    var id: String { rawValue }

    var title: String {
        switch self {
        case .google: return "Google"
        case .paperapp: return "PaperApp"
        }
    }

    var continueLabel: String { "\(title) ile devam et" }
}

struct SSOProvidersResponse: Decodable {
    let providers: [String]
}

struct SSOIdentity: Decodable, Identifiable {
    let provider: String
    let email: String?
    let createdAt: String?
    var id: String { provider }
}

struct SSOIdentitiesResponse: Decodable {
    let identities: [SSOIdentity]
    let hasPassword: Bool?
}

struct SSOTicketResponse: Decodable {
    let ticket: String
}

/// Result of POST /api/auth/sso/exchange: login returns a token, link returns linked=true.
struct SSOExchangeResponse: Decodable {
    let token: String?
    let user: User?
    let linked: Bool?
    let provider: String?
}

enum SSOError: LocalizedError {
    case cancelled
    case server(String)

    var errorDescription: String? {
        switch self {
        case .cancelled: return nil
        case .server(let message): return message
        }
    }

    /// Turkish message for the error codes in docs/SSO.md.
    static func message(for code: String, provider: SSOProvider?) -> String {
        let name = provider?.title ?? "Sağlayıcı"
        switch code {
        case "access_denied": return "Giriş iptal edildi."
        case "invalid_state": return "Oturum süresi doldu. Yeniden dene."
        case "provider_error": return "\(name) şu anda yanıt vermiyor. Biraz sonra yeniden dene."
        case "email_missing": return "\(name) hesabından e-posta alınamadı."
        case "email_in_use":
            return "Bu e-postayla bir PaperMap hesabı var. Şifrenle giriş yapıp Profil > Bağlı hesaplar'dan bağla."
        case "identity_in_use": return "Bu \(name) hesabı başka bir PaperMap hesabına bağlı."
        case "account_disabled": return "Bu hesap devre dışı bırakılmış."
        case "not_configured": return "\(name) ile giriş şu anda kullanılamıyor."
        default: return "Giriş tamamlanamadı (\(code))."
        }
    }
}

/// Supplies the window ASWebAuthenticationSession presents over.
final class SSOPresentationAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        return windows.first(where: { $0.isKeyWindow }) ?? windows.first ?? ASPresentationAnchor()
    }
}

enum SSOFlow {
    static let callbackScheme = "papermap"

    // Kept alive while a session is on screen; ASWebAuthenticationSession does
    // not retain its context provider.
    @MainActor private static var current: ASWebAuthenticationSession?
    @MainActor private static let anchor = SSOPresentationAnchor()

    static func startURL(provider: SSOProvider, mode: String, ticket: String? = nil) -> URL? {
        var comps = URLComponents(string: Config.apiBase.absoluteString + "/api/sso/\(provider.rawValue)/start")
        var items = [
            URLQueryItem(name: "client", value: "ios"),
            URLQueryItem(name: "mode", value: mode),
        ]
        if let ticket { items.append(URLQueryItem(name: "ticket", value: ticket)) }
        comps?.queryItems = items
        return comps?.url
    }

    /// Opens the start URL and returns the papermap://sso callback URL.
    @MainActor
    static func authenticate(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callback, error in
                Task { @MainActor in current = nil }
                if let error {
                    if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                        cont.resume(throwing: SSOError.cancelled)
                    } else {
                        cont.resume(throwing: SSOError.server("Giriş penceresi açılamadı."))
                    }
                    return
                }
                guard let callback else {
                    cont.resume(throwing: SSOError.cancelled)
                    return
                }
                cont.resume(returning: callback)
            }
            session.presentationContextProvider = anchor
            session.prefersEphemeralWebBrowserSession = false
            current = session
            if !session.start() {
                current = nil
                cont.resume(throwing: SSOError.server("Giriş penceresi açılamadı."))
            }
        }
    }

    /// Reads ?code= or ?error= from papermap://sso?... ; throws the Turkish message on error.
    static func code(from callback: URL, provider: SSOProvider) throws -> String {
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func value(_ name: String) -> String? { items.first(where: { $0.name == name })?.value }
        if let error = value("error"), !error.isEmpty {
            if error == "access_denied" { throw SSOError.cancelled }
            throw SSOError.server(SSOError.message(for: error, provider: provider))
        }
        guard let code = value("code"), !code.isEmpty else {
            throw SSOError.server("Giriş tamamlanamadı.")
        }
        return code
    }
}
