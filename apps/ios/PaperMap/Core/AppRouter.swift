// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation
import Network

enum AppTab: Hashable {
    case map, chat, friends, family, profile
}

/// Links from e-mails: password reset and e-mail verification.
enum DeepLink: Identifiable, Equatable {
    case resetPassword(token: String)
    case verifyEmail(token: String)

    var id: String {
        switch self {
        case .resetPassword(let t): return "reset-\(t)"
        case .verifyEmail(let t): return "verify-\(t)"
        }
    }

    /// Accepts papermap://reset/<token>, papermap://verify/<token> and the web
    /// links https://<API_BASE host>/reset/<token>, /verify/<token>.
    init?(url: URL) {
        var parts: [String]
        if url.scheme == SSOFlow.callbackScheme {
            // papermap://reset/<token>: host is "reset", the token is the path.
            parts = [url.host ?? ""] + url.pathComponents.filter { $0 != "/" }
        } else if url.scheme == "https", url.host == Config.apiBase.host {
            parts = url.pathComponents.filter { $0 != "/" }
        } else {
            return nil
        }
        parts = parts.filter { !$0.isEmpty }
        guard parts.count == 2 else { return nil }
        switch parts[0] {
        case "reset": self = .resetPassword(token: parts[1])
        case "verify": self = .verifyEmail(token: parts[1])
        default: return nil
        }
    }
}

/// App-wide navigation state: selected tab and a pending deep link.
@MainActor
final class AppRouter: ObservableObject {
    @Published var tab: AppTab = .map
    @Published var deepLink: DeepLink?
}

/// Connectivity for the offline banner.
@MainActor
final class NetworkMonitor: ObservableObject {
    @Published private(set) var isOffline = false
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let offline = path.status != .satisfied
            Task { @MainActor in self?.isOffline = offline }
        }
        // Lives as long as the app; never cancelled.
        monitor.start(queue: DispatchQueue(label: "com.paperaxis.papermap.network"))
    }
}

/// Server branding (GET /api/settings): app name and logo set by an admin.
@MainActor
final class Branding: ObservableObject {
    @Published private(set) var settings = AppSettings(appName: nil, logoPath: nil)

    var appName: String {
        let name = settings.appName?.trimmingCharacters(in: .whitespaces) ?? ""
        return name.isEmpty ? "PaperMap" : name
    }

    func load() async {
        if let res: AppSettingsResponse = try? await APIClient.send("GET", "/api/settings", token: nil) {
            settings = res.settings
        }
    }

    func apply(_ settings: AppSettings) {
        self.settings = settings
    }
}
