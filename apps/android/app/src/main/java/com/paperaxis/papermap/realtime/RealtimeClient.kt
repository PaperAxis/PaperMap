// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.realtime

import com.paperaxis.papermap.data.AppJson
import com.paperaxis.papermap.data.AppNotification
import com.paperaxis.papermap.data.LocationRequestEvent
import com.paperaxis.papermap.data.MessageEvent
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.SosEvent
import com.paperaxis.papermap.data.TripEndedEvent
import com.paperaxis.papermap.data.TripUpdate
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import org.json.JSONObject

/**
 * Process-wide Socket.IO connection (owned by PaperMapApp): keeps the latest
 * location of every visible peer and relays chat messages and notifications.
 * Events follow server/src/socket.js, routes/conversations.js, notify.js,
 * routes/sos.js and routes/location.js.
 */
class RealtimeClient(private val baseUrl: String) {
    private var socket: Socket? = null

    private val _peers = MutableStateFlow<Map<String, Peer>>(emptyMap())
    val peers: StateFlow<Map<String, Peer>> = _peers.asStateFlow()

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected.asStateFlow()

    private val _messages = MutableSharedFlow<MessageEvent>(extraBufferCapacity = 64)
    val messages: SharedFlow<MessageEvent> = _messages.asSharedFlow()

    private val _notifications = MutableSharedFlow<AppNotification>(extraBufferCapacity = 64)
    val notifications: SharedFlow<AppNotification> = _notifications.asSharedFlow()

    private val _sos = MutableSharedFlow<SosEvent>(extraBufferCapacity = 16)
    val sos: SharedFlow<SosEvent> = _sos.asSharedFlow()

    private val _locationRequests = MutableSharedFlow<LocationRequestEvent>(extraBufferCapacity = 16)
    val locationRequests: SharedFlow<LocationRequestEvent> = _locationRequests.asSharedFlow()

    private val _tripUpdates = MutableSharedFlow<TripUpdate>(extraBufferCapacity = 64)
    val tripUpdates: SharedFlow<TripUpdate> = _tripUpdates.asSharedFlow()

    private val _tripEnded = MutableSharedFlow<TripEndedEvent>(extraBufferCapacity = 64)
    val tripEnded: SharedFlow<TripEndedEvent> = _tripEnded.asSharedFlow()

    @Synchronized
    fun connect(token: String) {
        if (socket != null) return
        val opts = IO.Options().apply {
            auth = mapOf("token" to token)
            reconnection = true
        }
        val s = IO.socket(baseUrl, opts)
        s.on(Socket.EVENT_CONNECT) { _connected.value = true }
        s.on(Socket.EVENT_DISCONNECT) { _connected.value = false }
        s.on("peers:snapshot") { args ->
            val list = args.firstOrNull()?.toString()?.let {
                runCatching { AppJson.decodeFromString(ListSerializer(Peer.serializer()), it) }.getOrNull()
            } ?: return@on
            _peers.value = list.associateBy { it.userId }
        }
        s.on("peer:location") { args ->
            val peer = args.firstOrNull()?.toString()?.let {
                runCatching { AppJson.decodeFromString(Peer.serializer(), it) }.getOrNull()
            } ?: return@on
            _peers.value = _peers.value + (peer.userId to peer)
        }
        s.on("peer:offline") { args ->
            val id = (args.firstOrNull() as? JSONObject)?.optString("userId").orEmpty()
            if (id.isNotEmpty()) _peers.value = _peers.value - id
        }
        s.on("peers:changed") { s.emit("refresh") }
        s.on("message") { args ->
            val event = args.firstOrNull()?.toString()?.let {
                runCatching { AppJson.decodeFromString(MessageEvent.serializer(), it) }.getOrNull()
            } ?: return@on
            _messages.tryEmit(event)
        }
        s.on("notification") { args ->
            val n = args.firstOrNull()?.toString()?.let {
                runCatching { AppJson.decodeFromString(AppNotification.serializer(), it) }.getOrNull()
            } ?: return@on
            _notifications.tryEmit(n)
        }
        s.relay("sos", SosEvent.serializer(), _sos)
        s.relay("location:request", LocationRequestEvent.serializer(), _locationRequests)
        s.relay("trip:update", TripUpdate.serializer(), _tripUpdates)
        s.relay("trip:ended", TripEndedEvent.serializer(), _tripEnded)
        socket = s
        s.connect()
    }

    /** Decodes the first argument of [event] and forwards it to [target]. */
    private fun <T> Socket.relay(
        event: String,
        serializer: kotlinx.serialization.KSerializer<T>,
        target: MutableSharedFlow<T>,
    ) {
        on(event) { args ->
            val value = args.firstOrNull()?.toString()?.let {
                runCatching { AppJson.decodeFromString(serializer, it) }.getOrNull()
            } ?: return@on
            target.tryEmit(value)
        }
    }

    fun refresh() {
        socket?.emit("refresh")
    }

    fun sendLocation(lat: Double, lng: Double, accuracy: Float?, battery: Int?, charging: Boolean?) {
        val s = socket ?: return
        if (!s.connected()) return
        val data = JSONObject().apply {
            put("lat", lat)
            put("lng", lng)
            if (accuracy != null) put("accuracy", accuracy.toDouble())
            if (battery != null) put("battery", battery)
            if (charging != null) put("charging", charging)
        }
        s.emit("location:update", data)
    }

    @Synchronized
    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
        _connected.value = false
        _peers.value = emptyMap()
    }
}
