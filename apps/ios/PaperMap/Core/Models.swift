// Copyright (c) 2026 PaperAxis. All rights reserved.
// Codable models matching the PaperMap REST API (see apps/README.md).

import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    var email: String?
    var username: String?
    var displayName: String
    var sharingEnabled: Bool
    var sharingUntil: String?
    var avatarColor: String?
    var avatarPath: String?
    var statusText: String?
    var emailVerified: Bool?
    var isAdmin: Bool?
}

struct AuthResponse: Decodable {
    let token: String
    let user: User
}

struct UserResponse: Decodable {
    let user: User
}

/// Responses whose body we do not need ({"ok": true} and similar).
struct EmptyResponse: Decodable {}

struct PersonSummary: Codable, Identifiable, Hashable {
    let id: String
    let displayName: String
    var username: String?
    var avatarColor: String?
    var avatarPath: String?
}

struct FriendEntry: Decodable, Identifiable {
    let friendshipId: String
    let user: PersonSummary
    var id: String { friendshipId }
}

struct FriendsResponse: Decodable {
    var friends: [FriendEntry]
    var incoming: [FriendEntry]
    var outgoing: [FriendEntry]
}

struct FamilySummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    var inviteCode: String?
    var role: String?
    var memberCount: Int?
}

struct FamiliesResponse: Decodable {
    let families: [FamilySummary]
}

struct FamilyMember: Decodable, Identifiable {
    let id: String
    let displayName: String
    var username: String?
    var avatarColor: String?
    var avatarPath: String?
    var role: String?
    var joinedAt: String?
}

struct FamilyDetail: Decodable {
    let id: String
    let name: String
    var inviteCode: String?
    var ownerId: String?
    var members: [FamilyMember]
}

struct Peer: Codable, Identifiable, Equatable {
    let userId: String
    var displayName: String
    var avatarColor: String?
    var avatarPath: String?
    var statusText: String?
    var lat: Double
    var lng: Double
    var accuracy: Double?
    var battery: Int?
    var charging: Bool?
    var updatedAt: String?

    var id: String { userId }
}

struct LocationPayload: Encodable {
    let lat: Double
    let lng: Double
    let accuracy: Double?
    let battery: Int?
    let charging: Bool?
}

enum Format {
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain = ISO8601DateFormatter()

    static func date(_ s: String?) -> Date? {
        guard let s else { return nil }
        return isoFractional.date(from: s) ?? isoPlain.date(from: s)
    }

    /// "3 dakika önce" style relative time in Turkish.
    static func relative(_ s: String?) -> String? {
        guard let d = date(s) else { return nil }
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.unitsStyle = .full
        return f.localizedString(for: d, relativeTo: Date())
    }

    /// Up to two initials, Turkish-aware uppercase ("ılgın" -> "I", "işık" -> "İ").
    static func initials(_ name: String) -> String {
        let tr = Locale(identifier: "tr_TR")
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first.map { String($0).uppercased(with: tr) } }
        return letters.isEmpty ? "?" : letters.joined()
    }
}
