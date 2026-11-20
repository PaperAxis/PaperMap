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
    /// False for accounts created through Google/PaperApp sign-in; absent means true.
    var hasPassword: Bool?

    var passwordSet: Bool { hasPassword ?? true }
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

// MARK: - Chat

struct ConversationOtherUser: Codable, Hashable {
    let id: String
    var avatarColor: String?
    var avatarPath: String?
}

struct ConversationLastMessage: Codable, Hashable {
    var body: String?
    var createdAt: String?
    var senderName: String?
}

struct ConversationSummary: Codable, Identifiable, Hashable {
    let id: String
    var type: String
    var title: String
    var otherUser: ConversationOtherUser?
    var memberCount: Int?
    var lastMessage: ConversationLastMessage?
    var updatedAt: String?
    var unread: Int

    enum CodingKeys: String, CodingKey {
        case id, type, title, otherUser, memberCount, lastMessage, updatedAt, unread
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = (try? c.decode(String.self, forKey: .type)) ?? "direct"
        title = (try? c.decode(String.self, forKey: .title)) ?? "Sohbet"
        otherUser = try? c.decodeIfPresent(ConversationOtherUser.self, forKey: .otherUser)
        memberCount = try? c.decodeIfPresent(Int.self, forKey: .memberCount)
        lastMessage = try? c.decodeIfPresent(ConversationLastMessage.self, forKey: .lastMessage)
        updatedAt = try? c.decodeIfPresent(String.self, forKey: .updatedAt)
        unread = (try? c.decodeIfPresent(Int.self, forKey: .unread)) ?? 0
    }
}

struct ConversationsResponse: Decodable {
    let conversations: [ConversationSummary]
}

struct ChatMessage: Codable, Identifiable, Hashable {
    let id: String
    let conversationId: String
    var body: String?
    var placeLat: Double?
    var placeLng: Double?
    var placeLabel: String?
    var createdAt: String?
    var senderId: String?
    var senderName: String?
    var senderAvatarColor: String?
    var senderAvatarPath: String?

    var isPlace: Bool { placeLat != nil && placeLng != nil }
}

struct MessagesResponse: Decodable {
    let messages: [ChatMessage]
}

struct SentMessageResponse: Decodable {
    let message: ChatMessage
}

struct ConversationIdResponse: Decodable {
    let conversationId: String
}

/// Socket `message` event payload.
struct MessageEvent: Decodable {
    let conversationId: String
    let message: ChatMessage
}

/// Destination for opening a chat screen.
struct ChatTarget: Identifiable, Hashable {
    let id: String
    var title: String
    var type: String
}

// MARK: - Notifications

struct NotificationItem: Codable, Identifiable, Hashable {
    let id: String
    var title: String
    var body: String
    var createdAt: String?
    var readAt: String?
}

struct NotificationsResponse: Decodable {
    let notifications: [NotificationItem]
    let unread: Int?
}
