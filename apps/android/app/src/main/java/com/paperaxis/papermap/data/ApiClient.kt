// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.data

import com.paperaxis.papermap.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(message: String, val status: Int) : IOException(message)

val AppJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    coerceInputValues = true
}

/** Thin REST client for the PaperMap server (see apps/README.md). */
class ApiClient(private val session: SessionStore) {
    val base: String = BuildConfig.API_BASE

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private suspend fun call(method: String, path: String, body: JsonObject? = null): String =
        withContext(Dispatchers.IO) {
            val token = session.token()
            val reqBody: RequestBody? = when {
                body != null -> body.toString().toRequestBody(jsonType)
                method == "POST" || method == "PATCH" || method == "PUT" -> "{}".toRequestBody(jsonType)
                else -> null
            }
            val builder = Request.Builder().url(base + path).method(method, reqBody)
            if (token != null) builder.header("Authorization", "Bearer $token")
            http.newCall(builder.build()).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) {
                    val msg = runCatching { AppJson.decodeFromString<ErrorBody>(text).error }
                        .getOrNull()
                    throw ApiException(msg ?: "Sunucu hatası (${res.code})", res.code)
                }
                text
            }
        }

    private suspend inline fun <reified T> get(path: String): T =
        AppJson.decodeFromString(call("GET", path))

    private suspend inline fun <reified T> send(method: String, path: String, body: JsonObject? = null): T =
        AppJson.decodeFromString(call(method, path, body))

    /** Multipart image upload (server/src/upload.js: jpg, png or webp up to 5 MB). */
    private suspend fun upload(path: String, field: String, bytes: ByteArray, mime: String, fileName: String): String =
        withContext(Dispatchers.IO) {
            val token = session.token()
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(field, fileName, bytes.toRequestBody(mime.toMediaType()))
                .build()
            val builder = Request.Builder().url(base + path).post(body)
            if (token != null) builder.header("Authorization", "Bearer $token")
            http.newCall(builder.build()).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) {
                    val msg = runCatching { AppJson.decodeFromString<ErrorBody>(text).error }.getOrNull()
                    throw ApiException(msg ?: "Yükleme başarısız oldu", res.code)
                }
                text
            }
        }

    /** Absolute URL of an uploaded file ("/uploads/…"), or null. */
    fun fileUrl(path: String?): String? = if (path.isNullOrBlank()) null else base + path

    /** Public live-location page for a share link token. */
    fun shareLinkUrl(token: String): String = "$base/s/$token"

    private fun enc(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")

    // Auth
    suspend fun login(login: String, password: String): AuthResponse =
        AppJson.decodeFromString(
            call("POST", "/api/auth/login", buildJsonObject {
                put("login", login)
                put("password", password)
            }),
        )

    suspend fun register(email: String, username: String, displayName: String, password: String): AuthResponse =
        AppJson.decodeFromString(
            call("POST", "/api/auth/register", buildJsonObject {
                put("email", email)
                put("username", username)
                put("displayName", displayName)
                put("password", password)
            }),
        )

    suspend fun me(): User = get<UserResponse>("/api/auth/me").user

    suspend fun forgotPassword(email: String) {
        call("POST", "/api/auth/forgot", buildJsonObject { put("email", email) })
    }

    suspend fun resetPassword(token: String, newPassword: String) {
        call("POST", "/api/auth/reset", buildJsonObject {
            put("token", token)
            put("newPassword", newPassword)
        })
    }

    suspend fun verifyEmail(token: String) {
        call("GET", "/api/auth/verify/${enc(token)}")
    }

    suspend fun resendVerification() {
        call("POST", "/api/auth/verify/resend")
    }

    /** currentPassword is null for SSO-only accounts setting a first password. */
    suspend fun changePassword(currentPassword: String?, newPassword: String) {
        call("POST", "/api/auth/password", buildJsonObject {
            if (currentPassword != null) put("currentPassword", currentPassword)
            put("newPassword", newPassword)
        })
    }

    /** PATCH /api/auth/profile with any of displayName, username, avatarColor, statusText, theme, fontPref, iconStyle. */
    suspend fun updateProfile(patch: JsonObject): User =
        send<UserResponse>("PATCH", "/api/auth/profile", patch).user

    suspend fun uploadAvatar(bytes: ByteArray, mime: String): User =
        AppJson.decodeFromString<UserResponse>(upload("/api/auth/profile/avatar", "avatar", bytes, mime, "avatar.jpg")).user

    suspend fun removeAvatar(): User = send<UserResponse>("DELETE", "/api/auth/profile/avatar").user

    suspend fun uploadBanner(bytes: ByteArray, mime: String): User =
        AppJson.decodeFromString<UserResponse>(upload("/api/auth/profile/banner", "banner", bytes, mime, "banner.jpg")).user

    suspend fun removeBanner(): User = send<UserResponse>("DELETE", "/api/auth/profile/banner").user

    suspend fun publicProfile(userId: String): PublicProfile =
        get<PublicProfileResponse>("/api/users/$userId").user

    // Privacy and share links
    suspend fun privacyPeople(): List<PrivacyPerson> = get<PrivacyPeopleResponse>("/api/privacy/people").people

    suspend fun setHidden(userId: String, hidden: Boolean) {
        call("PUT", "/api/privacy/hidden/$userId", buildJsonObject { put("hidden", hidden) })
    }

    suspend fun shareLinks(): List<ShareLink> = get<ShareLinksResponse>("/api/sharelinks").links

    suspend fun createShareLink(durationMinutes: Int): ShareLink =
        send<ShareLinkResponse>("POST", "/api/sharelinks", buildJsonObject { put("durationMinutes", durationMinutes) }).link

    suspend fun revokeShareLink(id: String) {
        call("DELETE", "/api/sharelinks/$id")
    }

    // Branding and admin
    suspend fun appSettings(): AppSettings = get<AppSettingsResponse>("/api/settings").settings

    suspend fun updateAppName(name: String): AppSettings =
        send<AppSettingsResponse>("PATCH", "/api/settings", buildJsonObject { put("appName", name) }).settings

    suspend fun uploadLogo(bytes: ByteArray, mime: String): AppSettings =
        AppJson.decodeFromString<AppSettingsResponse>(upload("/api/settings/logo", "logo", bytes, mime, "logo.png")).settings

    suspend fun removeLogo(): AppSettings = send<AppSettingsResponse>("DELETE", "/api/settings/logo").settings

    suspend fun adminStats(): AdminStats = get<AdminStatsResponse>("/api/admin/stats").stats

    suspend fun adminUsers(query: String): List<AdminUser> =
        get<AdminUsersResponse>("/api/admin/users" + if (query.isBlank()) "" else "?q=${enc(query.trim())}").users

    suspend fun adminUpdateUser(id: String, disabled: Boolean? = null, isAdmin: Boolean? = null): AdminUser =
        send<AdminUserResponse>("PATCH", "/api/admin/users/$id", buildJsonObject {
            if (disabled != null) put("disabled", disabled)
            if (isAdmin != null) put("isAdmin", isAdmin)
        }).user

    suspend fun adminDeleteUser(id: String) {
        call("DELETE", "/api/admin/users/$id")
    }

    // SSO (docs/SSO.md)
    suspend fun ssoProviders(): List<String> =
        get<SsoProvidersResponse>("/api/auth/sso/providers").providers

    suspend fun ssoExchange(code: String): SsoExchangeResponse =
        AppJson.decodeFromString(
            call("POST", "/api/auth/sso/exchange", buildJsonObject { put("code", code) }),
        )

    suspend fun linkTicket(provider: String): String =
        AppJson.decodeFromString<LinkTicketResponse>(
            call("POST", "/api/auth/sso/link-ticket", buildJsonObject { put("provider", provider) }),
        ).ticket

    suspend fun identities(): IdentitiesResponse = get("/api/auth/identities")

    suspend fun unlinkIdentity(provider: String) {
        call("DELETE", "/api/auth/identities/$provider")
    }

    /** Browser URL that starts the server-side SSO flow. */
    fun ssoStartUrl(provider: String, mode: String, ticket: String? = null): String {
        val q = StringBuilder("client=android&mode=").append(mode)
        if (ticket != null) q.append("&ticket=").append(java.net.URLEncoder.encode(ticket, "UTF-8"))
        return "$base/api/sso/$provider/start?$q"
    }

    // Location
    /** durationMinutes null: unlimited sharing. */
    suspend fun setSharing(enabled: Boolean, durationMinutes: Int? = null): User =
        AppJson.decodeFromString<UserResponse>(
            call("PATCH", "/api/location/sharing", buildJsonObject {
                put("enabled", enabled)
                if (enabled && durationMinutes != null) put("durationMinutes", durationMinutes)
            }),
        ).user

    suspend fun locationHistory(userId: String): List<HistoryPoint> =
        get<HistoryResponse>("/api/location/history/$userId").points

    suspend fun requestLocation(userId: String) {
        call("POST", "/api/location/request", buildJsonObject { put("userId", userId) })
    }

    suspend fun sendSos(): Int = send<SosResponse>("POST", "/api/sos").notified

    // Geofences
    suspend fun geofences(): List<Geofence> = get<GeofencesResponse>("/api/geofences").geofences

    suspend fun candidates(): Candidates = get("/api/geofences/candidates")

    suspend fun createGeofence(name: String, lat: Double, lng: Double, radius: Int): Geofence =
        send<GeofenceResponse>("POST", "/api/geofences", buildJsonObject {
            put("name", name)
            put("lat", lat)
            put("lng", lng)
            put("radius", radius)
        }).geofence

    suspend fun updateGeofence(id: String, name: String, radius: Int, notifyOnEnter: Boolean, notifyOnExit: Boolean): Geofence =
        send<GeofenceResponse>("PATCH", "/api/geofences/$id", buildJsonObject {
            put("name", name)
            put("radius", radius)
            put("notifyOnEnter", notifyOnEnter)
            put("notifyOnExit", notifyOnExit)
        }).geofence

    suspend fun deleteGeofence(id: String) {
        call("DELETE", "/api/geofences/$id")
    }

    suspend fun addWatches(geofenceId: String, userIds: List<String>) {
        call("POST", "/api/geofences/$geofenceId/watches", buildJsonObject {
            put("userIds", JsonArray(userIds.map { JsonPrimitive(it) }))
        })
    }

    suspend fun removeWatch(geofenceId: String, userId: String) {
        call("DELETE", "/api/geofences/$geofenceId/watches/$userId")
    }

    // Places
    suspend fun places(): List<Place> = get<PlacesResponse>("/api/places").places

    suspend fun createPlace(name: String, lat: Double, lng: Double, color: String): Place =
        send<PlaceResponse>("POST", "/api/places", buildJsonObject {
            put("name", name)
            put("lat", lat)
            put("lng", lng)
            put("color", color)
        }).place

    suspend fun updatePlace(id: String, name: String, color: String): Place =
        send<PlaceResponse>("PATCH", "/api/places/$id", buildJsonObject {
            put("name", name)
            put("color", color)
        }).place

    suspend fun deletePlace(id: String) {
        call("DELETE", "/api/places/$id")
    }

    // Trips
    suspend fun myTrip(): Trip? = get<TripResponse>("/api/trips/mine").trip

    suspend fun startTrip(lat: Double, lng: Double, label: String) {
        call("POST", "/api/trips", buildJsonObject {
            put("destLat", lat)
            put("destLng", lng)
            put("destLabel", label)
        })
    }

    suspend fun cancelTrip() {
        call("DELETE", "/api/trips")
    }

    // Meetings
    suspend fun meetings(): List<Meeting> = get<MeetingsResponse>("/api/meetings").meetings

    suspend fun meeting(id: String): MeetingDetail = get("/api/meetings/$id")

    suspend fun createMeeting(label: String, lat: Double, lng: Double, memberIds: List<String>) {
        call("POST", "/api/meetings", buildJsonObject {
            put("label", label)
            put("lat", lat)
            put("lng", lng)
            put("memberIds", JsonArray(memberIds.map { JsonPrimitive(it) }))
        })
    }

    suspend fun deleteMeeting(id: String) {
        call("DELETE", "/api/meetings/$id")
    }

    suspend fun leaveMeeting(id: String) {
        call("POST", "/api/meetings/$id/leave")
    }

    suspend fun postLocation(lat: Double, lng: Double, accuracy: Float?, battery: Int?, charging: Boolean?) {
        call("POST", "/api/location", buildJsonObject {
            put("lat", lat)
            put("lng", lng)
            if (accuracy != null) put("accuracy", accuracy)
            if (battery != null) put("battery", battery)
            if (charging != null) put("charging", charging)
        })
    }

    // Friends
    suspend fun friends(): FriendsResponse = get("/api/friends")

    suspend fun addFriend(username: String) {
        call("POST", "/api/friends", buildJsonObject { put("username", username) })
    }

    suspend fun acceptFriend(friendshipId: String) {
        call("POST", "/api/friends/$friendshipId/accept")
    }

    suspend fun removeFriend(friendshipId: String) {
        call("DELETE", "/api/friends/$friendshipId")
    }

    // Families
    suspend fun families(): List<FamilySummary> = get<FamiliesResponse>("/api/families").families

    suspend fun family(id: String): FamilyDetail = get("/api/families/$id")

    suspend fun createFamily(name: String) {
        call("POST", "/api/families", buildJsonObject { put("name", name) })
    }

    suspend fun joinFamily(code: String) {
        call("POST", "/api/families/join", buildJsonObject { put("inviteCode", code) })
    }

    suspend fun leaveFamily(id: String) {
        call("DELETE", "/api/families/$id/leave")
    }

    // Chat
    suspend fun conversations(): List<Conversation> =
        get<ConversationsResponse>("/api/conversations").conversations

    suspend fun openDirect(userId: String): String =
        AppJson.decodeFromString<ConversationIdResponse>(
            call("POST", "/api/conversations/direct", buildJsonObject { put("userId", userId) }),
        ).conversationId

    suspend fun createGroup(name: String, memberIds: List<String>): String =
        AppJson.decodeFromString<ConversationIdResponse>(
            call("POST", "/api/conversations/group", buildJsonObject {
                put("name", name)
                put("memberIds", JsonArray(memberIds.map { JsonPrimitive(it) }))
            }),
        ).conversationId

    suspend fun messages(conversationId: String): List<ChatMessage> =
        get<MessagesResponse>("/api/conversations/$conversationId/messages").messages

    suspend fun sendMessage(conversationId: String, body: String): ChatMessage =
        AppJson.decodeFromString<MessageResponse>(
            call("POST", "/api/conversations/$conversationId/messages", buildJsonObject { put("body", body) }),
        ).message

    suspend fun sendPlace(conversationId: String, lat: Double, lng: Double, label: String): ChatMessage =
        send<MessageResponse>("POST", "/api/conversations/$conversationId/messages", buildJsonObject {
            put("placeLat", lat)
            put("placeLng", lng)
            put("placeLabel", label)
        }).message

    suspend fun markConversationRead(conversationId: String) {
        call("POST", "/api/conversations/$conversationId/read")
    }

    // Notifications
    suspend fun notifications(): NotificationsResponse = get("/api/notifications")

    suspend fun markNotificationsRead() {
        call("POST", "/api/notifications/read")
    }

    suspend fun registerPushToken(token: String) {
        call("POST", "/api/notifications/token", buildJsonObject {
            put("token", token)
            put("platform", "android")
        })
    }
}
