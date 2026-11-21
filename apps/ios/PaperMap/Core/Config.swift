// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

enum Config {
    /// Server base URL from Info.plist (API_BASE), without a trailing slash.
    static let apiBase: URL = {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "API_BASE") as? String) ?? "https://maps.paperaxis.com"
        let trimmed = raw.hasSuffix("/") ? String(raw.dropLast()) : raw
        return URL(string: trimmed) ?? URL(string: "https://maps.paperaxis.com")!
    }()

    static var version: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "-"
    }

    static var build: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? "-"
    }

    /// Absolute URL for a server-relative upload path such as "/uploads/a.png".
    static func uploadURL(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        return URL(string: apiBase.absoluteString + (path.hasPrefix("/") ? path : "/" + path))
    }

    /// Bundled style for a variant (light, dark, terrain, night, satellite); see apps/shared.
    static func mapStyleURL(variant: String) -> URL? {
        Bundle.main.url(forResource: "map-style-\(variant)", withExtension: "json")
            ?? Bundle.main.url(forResource: "map-style-light", withExtension: "json")
    }
}
