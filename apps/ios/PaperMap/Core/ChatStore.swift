// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

/// Conversations, the open chat's messages and unread counts. Owned by the app so
/// live `message` events land even when the chat tab is not on screen.
@MainActor
final class ChatStore: ObservableObject {
    @Published private(set) var conversations: [ConversationSummary] = []
    @Published private(set) var messages: [String: [ChatMessage]] = [:]
    @Published private(set) var loaded = false
    @Published var error: String?

    /// Conversation currently on screen; its messages are marked read as they arrive.
    private(set) var openConversationId: String?

    weak var session: Session?

    var unreadTotal: Int { conversations.reduce(0) { $0 + max(0, $1.unread) } }

    func reset() {
        conversations = []
        messages = [:]
        loaded = false
        error = nil
        openConversationId = nil
    }

    func loadConversations() async {
        guard let session else { return }
        do {
            let res: ConversationsResponse = try await session.api("GET", "/api/conversations")
            conversations = res.conversations.sorted { sortKey($0) > sortKey($1) }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loaded = true
    }

    func loadMessages(_ conversationId: String) async {
        guard let session else { return }
        do {
            let res: MessagesResponse = try await session.api("GET", "/api/conversations/\(conversationId)/messages")
            messages[conversationId] = res.messages
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func open(_ conversationId: String) {
        openConversationId = conversationId
        Task { await markRead(conversationId) }
    }

    func close(_ conversationId: String) {
        if openConversationId == conversationId { openConversationId = nil }
    }

    func markRead(_ conversationId: String) async {
        setUnread(conversationId, 0)
        guard let session else { return }
        let _: EmptyResponse? = try? await session.api("POST", "/api/conversations/\(conversationId)/read")
    }

    func send(_ text: String, to conversationId: String) async throws {
        guard let session else { return }
        struct Body: Encodable { let body: String }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let res: SentMessageResponse = try await session.api(
            "POST", "/api/conversations/\(conversationId)/messages", body: Body(body: trimmed)
        )
        append(res.message)
    }

    /// Opens (or finds) the direct chat with a friend.
    func openDirect(with userId: String, title: String) async throws -> ChatTarget {
        guard let session else { throw APIError(status: 0, message: "Oturum yok") }
        struct Body: Encodable { let userId: String }
        let res: ConversationIdResponse = try await session.api(
            "POST", "/api/conversations/direct", body: Body(userId: userId)
        )
        await loadConversations()
        let found = conversations.first { $0.id == res.conversationId }
        return ChatTarget(id: res.conversationId, title: found?.title ?? title, type: "direct")
    }

    func createGroup(name: String, memberIds: [String]) async throws -> ChatTarget {
        guard let session else { throw APIError(status: 0, message: "Oturum yok") }
        struct Body: Encodable { let name: String; let memberIds: [String] }
        let clean = name.trimmingCharacters(in: .whitespaces)
        let res: ConversationIdResponse = try await session.api(
            "POST", "/api/conversations/group", body: Body(name: clean, memberIds: memberIds)
        )
        await loadConversations()
        return ChatTarget(id: res.conversationId, title: clean, type: "group")
    }

    /// Live `message` event from the socket.
    func handle(_ event: MessageEvent, myId: String?) {
        append(event.message)
        let mine = event.message.senderId != nil && event.message.senderId == myId
        if let idx = conversations.firstIndex(where: { $0.id == event.conversationId }) {
            var conv = conversations[idx]
            conv.lastMessage = ConversationLastMessage(
                body: preview(event.message),
                createdAt: event.message.createdAt,
                senderName: event.message.senderName
            )
            conv.updatedAt = event.message.createdAt ?? conv.updatedAt
            if openConversationId == event.conversationId {
                conv.unread = 0
            } else if !mine {
                conv.unread += 1
            }
            conversations.remove(at: idx)
            conversations.insert(conv, at: 0)
        } else {
            // A conversation we have not listed yet (new group, new direct chat).
            Task { await loadConversations() }
        }
        if openConversationId == event.conversationId, !mine {
            Task { await markRead(event.conversationId) }
        }
    }

    private func append(_ message: ChatMessage) {
        var list = messages[message.conversationId] ?? []
        guard !list.contains(where: { $0.id == message.id }) else { return }
        list.append(message)
        messages[message.conversationId] = list
    }

    private func setUnread(_ conversationId: String, _ value: Int) {
        guard let idx = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[idx].unread = value
    }

    private func preview(_ m: ChatMessage) -> String {
        if m.isPlace { return "Konum: \(m.placeLabel ?? "Konum")" }
        return m.body ?? ""
    }

    private func sortKey(_ c: ConversationSummary) -> Date {
        Format.date(c.updatedAt) ?? .distantPast
    }
}
