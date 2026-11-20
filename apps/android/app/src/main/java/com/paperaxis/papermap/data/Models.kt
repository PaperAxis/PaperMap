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
    val bannerPath: String? = null,
    val theme: String? = null,
    val fontPref: String? = null,
    val iconStyle: String? = null,
    val statusText: String? = null,
    val emailVerified: Boolean = false,
    val isAdmin: Boolean = false,
    val hasPassword: Boolean = true,
)

@Serializable
data class SsoProvidersResponse(val providers: List<String> = emptyList())

/** Login: token + user. Link: linked = true, provider, user. */
@Serializable
data class SsoExchangeResponse(
    val token: String? = null,
    val user: User? = null,
    val linked: Boolean = false,
    val provider: String? = null,
)

@Serializable
data class LinkTicketResponse(val ticket: String)

@Serializable
data class Identity(
    val provider: String,
    val email: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class IdentitiesResponse(
    val identities: List<Identity> = emptyList(),
    val hasPassword: Boolean = true,
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

@Serializable
data class OkResponse(val ok: Boolean = true)

// Profile of a friend or family member (GET /api/users/:id)

@Serializable
data class PublicProfile(
    val id: String,
    val displayName: String = "",
    val username: String? = null,
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val bannerPath: String? = null,
)

@Serializable
data class PublicProfileResponse(val user: PublicProfile)

// Privacy and share links

@Serializable
data class PrivacyPerson(
    val id: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val hidden: Boolean = false,
)

@Serializable
data class PrivacyPeopleResponse(val people: List<PrivacyPerson> = emptyList())

@Serializable
data class ShareLink(
    val id: String,
    val token: String,
    val label: String? = null,
    val expiresAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class ShareLinksResponse(val links: List<ShareLink> = emptyList())

@Serializable
data class ShareLinkResponse(val link: ShareLink)

// Server branding and admin

@Serializable
data class AppSettings(val appName: String = "PaperMap", val logoPath: String? = null)

@Serializable
data class AppSettingsResponse(val settings: AppSettings)

@Serializable
data class AdminStats(
    val users: Int = 0,
    val families: Int = 0,
    val conversations: Int = 0,
    val messages: Int = 0,
)

@Serializable
data class AdminStatsResponse(val stats: AdminStats)

@Serializable
data class AdminUser(
    val id: String,
    val email: String? = null,
    val username: String? = null,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val isAdmin: Boolean = false,
    val disabled: Boolean = false,
    val createdAt: String? = null,
)

@Serializable
data class AdminUsersResponse(val users: List<AdminUser> = emptyList())

@Serializable
data class AdminUserResponse(val user: AdminUser)

// Map features

@Serializable
data class HistoryPoint(
    val lat: Double,
    val lng: Double,
    val accuracy: Double? = null,
    val recordedAt: String? = null,
)

@Serializable
data class HistoryResponse(val points: List<HistoryPoint> = emptyList())

@Serializable
data class GeofenceWatch(
    val userId: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val inside: Boolean? = null,
)

@Serializable
data class Geofence(
    val id: String,
    val name: String = "",
    val lat: Double,
    val lng: Double,
    val radius: Double = 300.0,
    val notifyOnEnter: Boolean = true,
    val notifyOnExit: Boolean = true,
    val watches: List<GeofenceWatch> = emptyList(),
)

@Serializable
data class GeofencesResponse(val geofences: List<Geofence> = emptyList())

@Serializable
data class GeofenceResponse(val geofence: Geofence)

@Serializable
data class CandidatePerson(
    val id: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
)

@Serializable
data class CandidateFamily(
    val id: String,
    val name: String = "",
    val members: List<CandidatePerson> = emptyList(),
)

/** Friends plus (optional) family members: who can be watched or invited. */
@Serializable
data class Candidates(
    val friends: List<CandidatePerson> = emptyList(),
    val family: CandidateFamily? = null,
)

@Serializable
data class Place(
    val id: String,
    val name: String = "",
    val lat: Double,
    val lng: Double,
    val color: String = "#7c3aed",
)

@Serializable
data class PlacesResponse(val places: List<Place> = emptyList())

@Serializable
data class PlaceResponse(val place: Place)

@Serializable
data class Trip(
    val destLat: Double,
    val destLng: Double,
    val destLabel: String = "",
    val startedAt: String? = null,
)

@Serializable
data class TripResponse(val trip: Trip? = null)

/** Payload of the socket `trip:update` event. */
@Serializable
data class TripUpdate(
    val userId: String,
    val displayName: String = "",
    val destLat: Double? = null,
    val destLng: Double? = null,
    val destLabel: String = "",
    val distanceMeters: Double? = null,
    val etaMinutes: Int? = null,
)

@Serializable
data class Meeting(
    val id: String,
    val label: String = "",
    val lat: Double,
    val lng: Double,
    val isOwner: Boolean = false,
    val memberCount: Int = 0,
    val createdAt: String? = null,
)

@Serializable
data class MeetingsResponse(val meetings: List<Meeting> = emptyList())

@Serializable
data class MeetingMember(
    val userId: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val isOwner: Boolean = false,
    val distanceMeters: Double? = null,
    val etaMinutes: Int? = null,
    val arrived: Boolean = false,
    val locationOff: Boolean = false,
    val updatedAt: String? = null,
)

@Serializable
data class MeetingDetail(val meeting: Meeting, val members: List<MeetingMember> = emptyList())

@Serializable
data class SosResponse(val ok: Boolean = true, val notified: Int = 0)

/** Payload of the socket `sos` event. */
@Serializable
data class SosEvent(
    val userId: String,
    val displayName: String = "",
    val avatarColor: String? = null,
    val avatarPath: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val message: String? = null,
    val at: String? = null,
)

/** Payload of the socket `location:request` event. */
@Serializable
data class LocationRequestEvent(val fromId: String = "", val fromName: String = "")

/** Payload of the socket `trip:ended` event. */
@Serializable
data class TripEndedEvent(val userId: String)
