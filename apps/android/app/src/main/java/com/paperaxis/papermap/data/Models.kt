// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.data

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val email: String? = null,
    val username: String? = null,
    val displayName: String = "",
    val sharingEnabled: Boolean = false,
    val sharingUntil: String? = null,
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val statusText: String? = null,
    val emailVerified: Boolean = false,
    val isAdmin: Boolean = false,
)

@Serializable
data class AuthResponse(val token: String, val user: User)

@Serializable
data class UserResponse(val user: User)

@Serializable
data class Peer(
    val userId: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val statusText: String? = null,
    val lat: Double,
    val lng: Double,
    val accuracy: Double? = null,
    val battery: Int? = null,
    val charging: Boolean? = null,
    val updatedAt: String? = null,
)

@Serializable
data class PersonSummary(
    val id: String,
    val displayName: String = "",
    val username: String? = null,
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val role: String? = null,
)

@Serializable
data class FriendEntry(val friendshipId: String, val user: PersonSummary)

@Serializable
data class FriendsResponse(
    val friends: List<FriendEntry> = emptyList(),
    val incoming: List<FriendEntry> = emptyList(),
    val outgoing: List<FriendEntry> = emptyList(),
)

@Serializable
data class FamilySummary(
    val id: String,
    val name: String,
    val inviteCode: String? = null,
    val role: String? = null,
    val memberCount: Int = 0,
)

@Serializable
data class FamiliesResponse(val families: List<FamilySummary> = emptyList())

@Serializable
data class FamilyDetail(
    val id: String,
    val name: String,
    val inviteCode: String? = null,
    val ownerId: String? = null,
    val members: List<PersonSummary> = emptyList(),
)

@Serializable
data class ErrorBody(val error: String? = null)

@Serializable
data class AndroidRelease(
    val name: String? = null,
    val id: String? = null,
    val version: String = "",
    val versionCode: Int = 0,
    val `package`: String = "",
    val sha256: String = "",
    val size: Long = 0,
    val minSdk: Int? = null,
)

// Chat

@Serializable
data class ConversationUser(
    val id: String,
    val avatarColor: String? = null,
    val avatarPath: String? = null,
)

@Serializable
data class LastMessage(
    val body: String = "",
    val createdAt: String? = null,
    val senderName: String? = null,
)

@Serializable
data class Conversation(
    val id: String,
    val type: String = "direct",
    val title: String = "",
    val otherUser: ConversationUser? = null,
    val memberCount: Int = 0,
    val lastMessage: LastMessage? = null,
    val updatedAt: String? = null,
    val unread: Int = 0,
)

@Serializable
data class ConversationsResponse(val conversations: List<Conversation> = emptyList())

@Serializable
data class ConversationIdResponse(val conversationId: String)

@Serializable
data class ChatMessage(
    val id: String,
    val conversationId: String = "",
    val body: String? = null,
    val placeLat: Double? = null,
    val placeLng: Double? = null,
    val placeLabel: String? = null,
    val createdAt: String? = null,
    val senderId: String = "",
    val senderName: String = "",
    val senderAvatarColor: String? = null,
    val senderAvatarPath: String? = null,
) {
    val isPlace: Boolean get() = placeLat != null && placeLng != null
}

@Serializable
data class MessagesResponse(val messages: List<ChatMessage> = emptyList())

@Serializable
data class MessageResponse(val message: ChatMessage)

/** Payload of the socket `message` event. */
@Serializable
data class MessageEvent(val conversationId: String, val message: ChatMessage)

// Notifications

@Serializable
data class AppNotification(
    val id: String,
    val title: String = "",
    val body: String = "",
    val createdAt: String? = null,
    val readAt: String? = null,
)

@Serializable
data class NotificationsResponse(
    val notifications: List<AppNotification> = emptyList(),
    val unread: Int = 0,
)
