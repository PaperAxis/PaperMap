// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.paperaxis.papermap.PaperMapApp
import com.paperaxis.papermap.data.AndroidRelease
import com.paperaxis.papermap.data.ApiException
import com.paperaxis.papermap.data.FamilyDetail
import com.paperaxis.papermap.data.FamilySummary
import com.paperaxis.papermap.data.FriendsResponse
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.location.LocationService
import com.paperaxis.papermap.location.readBattery
import com.paperaxis.papermap.update.Updater
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val user: User) : SessionState
}

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as PaperMapApp
    private val api = app.api
    private val realtime = app.realtime
    private val updater = Updater(application, api.http, app.session)

    private val _session = MutableStateFlow<SessionState>(SessionState.Loading)
    val session: StateFlow<SessionState> = _session.asStateFlow()

    val peers: StateFlow<Map<String, Peer>> = realtime.peers
    val myLocation = app.myLocation

    private val _friends = MutableStateFlow(FriendsResponse())
    val friends: StateFlow<FriendsResponse> = _friends.asStateFlow()

    private val _families = MutableStateFlow<List<FamilySummary>>(emptyList())
    val families: StateFlow<List<FamilySummary>> = _families.asStateFlow()

    private val _family = MutableStateFlow<FamilyDetail?>(null)
    val family: StateFlow<FamilyDetail?> = _family.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _update = MutableStateFlow<AndroidRelease?>(null)
    val update: StateFlow<AndroidRelease?> = _update.asStateFlow()

    init {
        viewModelScope.launch {
            val token = app.session.token()
            if (token == null) {
                _session.value = SessionState.SignedOut
            } else {
                try {
                    signedIn(token, api.me())
                } catch (e: ApiException) {
                    if (e.status == 401) signOut() else _session.value = SessionState.SignedOut
                } catch (e: Exception) {
                    // Offline: keep the token, retry on next launch.
                    _message.value = "Sunucuya ulaşılamadı. İnternet bağlantını kontrol et."
                    _session.value = SessionState.SignedOut
                }
            }
        }
        viewModelScope.launch {
            runCatching { updater.check() }.getOrNull()?.let { _update.value = it }
        }
    }

    private fun signedIn(token: String, user: User) {
        _session.value = SessionState.SignedIn(user)
        realtime.connect(token)
        syncLocationService(user)
        refreshFriends()
        refreshFamilies()
    }

    private fun syncLocationService(user: User) {
        if (user.sharingEnabled) LocationService.start(app) else LocationService.stop(app)
    }

    fun clearMessage() {
        _message.value = null
    }

    private fun launchAction(block: suspend () -> Unit) {
        viewModelScope.launch {
            _busy.value = true
            try {
                block()
            } catch (e: Exception) {
                _message.value = e.message ?: "Bir hata oluştu"
            } finally {
                _busy.value = false
            }
        }
    }

    fun login(login: String, password: String) = launchAction {
        val res = api.login(login.trim(), password)
        app.session.setToken(res.token)
        signedIn(res.token, res.user)
    }

    fun register(email: String, username: String, displayName: String, password: String) = launchAction {
        val res = api.register(email.trim(), username.trim().lowercase(), displayName.trim(), password)
        app.session.setToken(res.token)
        signedIn(res.token, res.user)
    }

    fun signOut() {
        viewModelScope.launch {
            LocationService.stop(app)
            realtime.disconnect()
            app.session.setToken(null)
            _friends.value = FriendsResponse()
            _families.value = emptyList()
            _family.value = null
            _session.value = SessionState.SignedOut
        }
    }

    private fun currentUser(): User? = (session.value as? SessionState.SignedIn)?.user

    fun setSharing(enabled: Boolean) = launchAction {
        val user = api.setSharing(enabled)
        _session.value = SessionState.SignedIn(user)
        syncLocationService(user)
    }

    /** Called with foreground location fixes from the map screen. */
    fun onForegroundLocation(location: android.location.Location) {
        app.myLocation.value = location
        if (currentUser()?.sharingEnabled == true) {
            val battery = readBattery(app)
            realtime.sendLocation(
                location.latitude,
                location.longitude,
                if (location.hasAccuracy()) location.accuracy else null,
                battery.level,
                battery.charging,
            )
        }
    }

    fun updateDisplayName(name: String) = launchAction {
        val trimmed = name.trim()
        require(trimmed.isNotEmpty()) { "Görünen ad boş olamaz" }
        _session.value = SessionState.SignedIn(api.updateDisplayName(trimmed))
        _message.value = "Görünen ad kaydedildi"
    }

    // Friends
    fun refreshFriends() {
        viewModelScope.launch { runCatching { api.friends() }.onSuccess { _friends.value = it } }
    }

    fun addFriend(username: String) = launchAction {
        val clean = username.trim().removePrefix("@")
        require(clean.isNotEmpty()) { "Kullanıcı adı gir" }
        api.addFriend(clean)
        _message.value = "İstek gönderildi"
        _friends.value = api.friends()
    }

    fun acceptFriend(id: String) = launchAction {
        api.acceptFriend(id)
        _friends.value = api.friends()
        realtime.refresh()
    }

    fun removeFriend(id: String) = launchAction {
        api.removeFriend(id)
        _friends.value = api.friends()
        realtime.refresh()
    }

    // Families
    fun refreshFamilies() {
        viewModelScope.launch { runCatching { api.families() }.onSuccess { _families.value = it } }
    }

    fun openFamily(id: String?) {
        _family.value = null
        if (id == null) return
        launchAction { _family.value = api.family(id) }
    }

    fun createFamily(name: String) = launchAction {
        require(name.isNotBlank()) { "Aile adı gir" }
        api.createFamily(name.trim())
        _families.value = api.families()
        realtime.refresh()
    }

    fun joinFamily(code: String) = launchAction {
        require(code.isNotBlank()) { "Davet kodunu gir" }
        api.joinFamily(code.trim())
        _families.value = api.families()
        realtime.refresh()
    }

    fun leaveFamily(id: String) = launchAction {
        api.leaveFamily(id)
        _family.value = null
        _families.value = api.families()
        realtime.refresh()
    }

    // Updates
    fun dismissUpdate() {
        _update.value = null
    }

    fun installUpdate() {
        val release = _update.value ?: return
        _update.value = null
        viewModelScope.launch {
            _message.value = "Güncelleme indiriliyor"
            updater.downloadAndInstall(release).onFailure {
                _message.value = it.message ?: "Güncelleme kurulamadı"
            }
        }
    }
}
