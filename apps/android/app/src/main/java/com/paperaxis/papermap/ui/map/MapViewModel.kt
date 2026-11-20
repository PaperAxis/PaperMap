// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.paperaxis.papermap.PaperMapApp
import com.paperaxis.papermap.data.Candidates
import com.paperaxis.papermap.data.Geofence
import com.paperaxis.papermap.data.HistoryPoint
import com.paperaxis.papermap.data.LocationRequestEvent
import com.paperaxis.papermap.data.Meeting
import com.paperaxis.papermap.data.MeetingDetail
import com.paperaxis.papermap.data.Place
import com.paperaxis.papermap.data.SosEvent
import com.paperaxis.papermap.data.TripUpdate
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Own active trip; etaMinutes arrives with the first trip:update. */
data class MyTrip(val destLabel: String, val etaMinutes: Int?)

/** A person's last 30 days of fixes, drawn as a trail. */
data class HistoryTrack(val userId: String, val name: String, val points: List<HistoryPoint>)

/** Which overlays the layers menu shows on the map. */
data class LayerVisibility(
    val people: Boolean = true,
    val geofences: Boolean = true,
    val places: Boolean = true,
    val meetings: Boolean = true,
)

/**
 * Map features beyond live peers (web pages/MapView.jsx and its panels):
 * geofences, saved places, trips, meetings, history, SOS and location requests.
 * Activity-scoped so the data survives tab switches.
 */
class MapViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as PaperMapApp
    private val api = app.api
    private val realtime = app.realtime

    private var myId: String? = null

    private val _geofences = MutableStateFlow<List<Geofence>>(emptyList())
    val geofences: StateFlow<List<Geofence>> = _geofences.asStateFlow()

    private val _places = MutableStateFlow<List<Place>>(emptyList())
    val places: StateFlow<List<Place>> = _places.asStateFlow()

    private val _meetings = MutableStateFlow<List<Meeting>>(emptyList())
    val meetings: StateFlow<List<Meeting>> = _meetings.asStateFlow()

    private val _candidates = MutableStateFlow(Candidates())
    val candidates: StateFlow<Candidates> = _candidates.asStateFlow()

    private val _myTrip = MutableStateFlow<MyTrip?>(null)
    val myTrip: StateFlow<MyTrip?> = _myTrip.asStateFlow()

    /** Other people's active trips, by user id. */
    private val _peerTrips = MutableStateFlow<Map<String, TripUpdate>>(emptyMap())
    val peerTrips: StateFlow<Map<String, TripUpdate>> = _peerTrips.asStateFlow()

    private val _history = MutableStateFlow<HistoryTrack?>(null)
    val history: StateFlow<HistoryTrack?> = _history.asStateFlow()

    private val _sos = MutableStateFlow<SosEvent?>(null)
    val sos: StateFlow<SosEvent?> = _sos.asStateFlow()

    private val _locationRequest = MutableStateFlow<LocationRequestEvent?>(null)
    val locationRequest: StateFlow<LocationRequestEvent?> = _locationRequest.asStateFlow()

    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice.asStateFlow()

    private val _layers = MutableStateFlow(LayerVisibility())
    val layers: StateFlow<LayerVisibility> = _layers.asStateFlow()

    private val _meetingDetail = MutableStateFlow<MeetingDetail?>(null)
    val meetingDetail: StateFlow<MeetingDetail?> = _meetingDetail.asStateFlow()

    private val _expandedMeeting = MutableStateFlow<String?>(null)
    val expandedMeeting: StateFlow<String?> = _expandedMeeting.asStateFlow()
    private var meetingPoll: Job? = null

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    /** Errors and results for the snackbar. */
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

    init {
        viewModelScope.launch { realtime.sos.collect { _sos.value = it } }
        viewModelScope.launch { realtime.locationRequests.collect { _locationRequest.value = it } }
        viewModelScope.launch {
            realtime.tripUpdates.collect { t ->
                if (t.userId == myId) {
                    _myTrip.value = MyTrip(t.destLabel, t.etaMinutes)
                } else {
                    _peerTrips.value = _peerTrips.value + (t.userId to t)
                }
            }
        }
        viewModelScope.launch {
            realtime.tripEnded.collect { e ->
                if (e.userId == myId) _myTrip.value = null else _peerTrips.value = _peerTrips.value - e.userId
            }
        }
    }

    /** Loads everything for [userId]; a different account starts from a clean slate. */
    fun start(userId: String) {
        if (myId != userId) {
            myId = userId
            _geofences.value = emptyList()
            _places.value = emptyList()
            _meetings.value = emptyList()
            _candidates.value = Candidates()
            _myTrip.value = null
            _peerTrips.value = emptyMap()
            _history.value = null
            _sos.value = null
            _locationRequest.value = null
            _notice.value = null
            expandMeeting(null)
        }
        loadGeofences()
        loadPlaces()
        loadMeetings()
        viewModelScope.launch {
            runCatching { api.myTrip() }.onSuccess { trip ->
                // Keep a live ETA if a trip:update already arrived.
                _myTrip.value = trip?.let { MyTrip(it.destLabel, _myTrip.value?.etaMinutes) }
            }
        }
    }

    private fun act(success: String? = null, block: suspend () -> Unit) {
        viewModelScope.launch {
            _busy.value = true
            try {
                block()
                if (success != null) _messages.emit(success)
            } catch (e: Exception) {
                _messages.emit(e.message ?: "Bir hata oluştu")
            } finally {
                _busy.value = false
            }
        }
    }

    fun loadGeofences() {
        viewModelScope.launch { runCatching { api.geofences() }.onSuccess { _geofences.value = it } }
    }

    fun loadPlaces() {
        viewModelScope.launch { runCatching { api.places() }.onSuccess { _places.value = it } }
    }

    fun loadMeetings() {
        viewModelScope.launch { runCatching { api.meetings() }.onSuccess { _meetings.value = it } }
    }

    fun loadCandidates() {
        viewModelScope.launch { runCatching { api.candidates() }.onSuccess { _candidates.value = it } }
    }

    fun setLayers(value: LayerVisibility) {
        _layers.value = value
    }

    fun dismissNotice() {
        _notice.value = null
    }

    // Geofences (web components/GeofencePanel.jsx)
    fun createGeofence(name: String, lat: Double, lng: Double, radius: Int, onDone: () -> Unit) = act {
        require(name.isNotBlank()) { "Alan adı zorunlu" }
        _geofences.value = listOf(api.createGeofence(name.trim(), lat, lng, radius)) + _geofences.value
        onDone()
    }

    fun updateGeofence(g: Geofence, name: String, radius: Int, enter: Boolean, exit: Boolean, onDone: () -> Unit) = act {
        require(name.isNotBlank()) { "Alan adı zorunlu" }
        api.updateGeofence(g.id, name.trim(), radius, enter, exit)
        _geofences.value = api.geofences()
        onDone()
    }

    fun deleteGeofence(id: String) = act {
        api.deleteGeofence(id)
        _geofences.value = api.geofences()
    }

    fun addWatches(geofenceId: String, userIds: List<String>, onDone: () -> Unit) = act {
        if (userIds.isEmpty()) return@act
        api.addWatches(geofenceId, userIds)
        _geofences.value = api.geofences()
        onDone()
    }

    fun removeWatch(geofenceId: String, userId: String) = act {
        api.removeWatch(geofenceId, userId)
        _geofences.value = api.geofences()
    }

    // Saved places (web components/PlacesPanel.jsx)
    fun createPlace(name: String, lat: Double, lng: Double, color: String, onDone: () -> Unit) = act {
        require(name.isNotBlank()) { "Yer adı zorunlu" }
        _places.value = listOf(api.createPlace(name.trim(), lat, lng, color)) + _places.value
        onDone()
    }

    fun updatePlace(id: String, name: String, color: String, onDone: () -> Unit) = act {
        require(name.isNotBlank()) { "Yer adı zorunlu" }
        api.updatePlace(id, name.trim(), color)
        _places.value = api.places()
        onDone()
    }

    fun deletePlace(id: String) = act {
        api.deletePlace(id)
        _places.value = api.places()
    }

    // Trips
    fun startTrip(place: Place) = act {
        api.startTrip(place.lat, place.lng, place.name)
        _myTrip.value = MyTrip(place.name, null)
    }

    fun cancelTrip() = act {
        api.cancelTrip()
        _myTrip.value = null
    }

    // Meetings (web components/MeetingsPanel.jsx)
    fun createMeeting(label: String, lat: Double, lng: Double, memberIds: List<String>, onDone: () -> Unit) = act {
        require(label.isNotBlank()) { "Buluşma adı zorunlu" }
        api.createMeeting(label.trim(), lat, lng, memberIds)
        _meetings.value = api.meetings()
        onDone()
    }

    fun deleteMeeting(id: String) = act {
        api.deleteMeeting(id)
        expandMeeting(null)
        _meetings.value = api.meetings()
    }

    fun leaveMeeting(id: String) = act {
        api.leaveMeeting(id)
        expandMeeting(null)
        _meetings.value = api.meetings()
    }

    /** Shows a meeting's members and refreshes their ETA every 20 s; null stops. */
    fun expandMeeting(id: String?) {
        meetingPoll?.cancel()
        _expandedMeeting.value = id
        _meetingDetail.value = null
        if (id == null) return
        meetingPoll = viewModelScope.launch {
            while (isActive) {
                runCatching { api.meeting(id) }.onSuccess { if (_expandedMeeting.value == id) _meetingDetail.value = it }
                delay(20_000)
            }
        }
    }

    // History
    fun showHistory(userId: String, name: String, onLoaded: (List<HistoryPoint>) -> Unit) = act {
        val points = api.locationHistory(userId)
        _history.value = HistoryTrack(userId, name, points)
        onLoaded(points)
    }

    fun closeHistory() {
        _history.value = null
    }

    // SOS and location requests
    fun sendSos(onDone: () -> Unit) = act {
        try {
            val notified = api.sendSos()
            _notice.value = "Acil durum çağrısı $notified kişiye gönderildi."
        } finally {
            onDone()
        }
    }

    fun dismissSos() {
        _sos.value = null
    }

    fun dismissLocationRequest() {
        _locationRequest.value = null
    }
}
