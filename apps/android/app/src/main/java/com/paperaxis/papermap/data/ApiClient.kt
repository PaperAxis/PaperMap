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
                method == "POST" || method == "PATCH" -> "{}".toRequestBody(jsonType)
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

    suspend fun updateDisplayName(name: String): User =
        AppJson.decodeFromString<UserResponse>(
            call("PATCH", "/api/auth/profile", buildJsonObject { put("displayName", name) }),
        ).user

    // Location
    suspend fun setSharing(enabled: Boolean): User =
        AppJson.decodeFromString<UserResponse>(
            call("PATCH", "/api/location/sharing", buildJsonObject { put("enabled", enabled) }),
        ).user

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
