// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.paperaxis.papermap.PaperMapApp
import com.paperaxis.papermap.data.AndroidRelease
import com.paperaxis.papermap.data.AppSettings
import com.paperaxis.papermap.data.ApiException
import com.paperaxis.papermap.data.AppNotification
import com.paperaxis.papermap.data.ChatMessage
import com.paperaxis.papermap.data.Conversation
import com.paperaxis.papermap.data.FamilyDetail
import com.paperaxis.papermap.data.FamilySummary
import com.paperaxis.papermap.data.FriendsResponse
import com.paperaxis.papermap.data.IdentitiesResponse
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.PrivacyPerson
import com.paperaxis.papermap.data.PublicProfile
import com.paperaxis.papermap.data.ShareLink
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.location.LocationService
import com.paperaxis.papermap.location.readBattery
import com.paperaxis.papermap.update.Updater
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import com.paperaxis.papermap.ui.common.readImageForUpload

/** Account e-mail links opened in the app: reset password, verify e-mail. */
sealed interface AuthLink {
    data class Reset(val token: String) : AuthLink
    data class Verify(val token: String) : AuthLink
}

/** Full-screen pages opened above the tabs. */
sealed interface Overlay {
    data object Admin : Overlay
    data class UserProfile(val userId: String) : Overlay
}

/** A point the map tab should fly to (chat place messages). */
data class MapFocus(val lat: Double, val lng: Double)

/** Theme id, font id and icon style; applied by PaperMapTheme. */
data class Appearance(val theme: String? = null, val font: String? = null, val iconStyle: String? = null)

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

    /** Login name saved by "Beni hatırla"; prefills the login form. */
    private val _rememberedLogin = MutableStateFlow("")
    val rememberedLogin: StateFlow<String> = _rememberedLogin.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _update = MutableStateFlow<AndroidRelease?>(null)
    val update: StateFlow<AndroidRelease?> = _update.asStateFlow()

    // Chat
    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations.asStateFlow()

    /** The chat shown full screen, or null. */
    private val _openChat = MutableStateFlow<Conversation?>(null)
    val openChat: StateFlow<Conversation?> = _openChat.asStateFlow()

    private val _chatMessages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val chatMessages: StateFlow<List<ChatMessage>> = _chatMessages.asStateFlow()

    private val _chatLoading = MutableStateFlow(false)
    val chatLoading: StateFlow<Boolean> = _chatLoading.asStateFlow()

    // Notifications
    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    private val _unreadNotifications = MutableStateFlow(0)
    val unreadNotifications: StateFlow<Int> = _unreadNotifications.asStateFlow()

    private val _showNotifications = MutableStateFlow(false)
    val showNotifications: StateFlow<Boolean> = _showNotifications.asStateFlow()

    // SSO (docs/SSO.md)
    /** Providers the server has configured: "google", "paperapp". */
    private val _ssoProviders = MutableStateFlow<List<String>>(emptyList())
    val ssoProviders: StateFlow<List<String>> = _ssoProviders.asStateFlow()

    private val _identities = MutableStateFlow<IdentitiesResponse?>(null)
    val identities: StateFlow<IdentitiesResponse?> = _identities.asStateFlow()

    /** A browser URL the UI should open (SSO start); consumed with [consumeOpenUrl]. */
    private val _openUrl = MutableStateFlow<String?>(null)
    val openUrl: StateFlow<String?> = _openUrl.asStateFlow()

    /** Server branding (app name and logo) set in the admin panel. */
    private val _appSettings = MutableStateFlow(AppSettings())
    val appSettings: StateFlow<AppSettings> = _appSettings.asStateFlow()

    private val _authLink = MutableStateFlow<AuthLink?>(null)
    val authLink: StateFlow<AuthLink?> = _authLink.asStateFlow()

    private val _appearance = MutableStateFlow(Appearance())
    val appearance: StateFlow<Appearance> = _appearance.asStateFlow()

    private val _overlay = MutableStateFlow<Overlay?>(null)
    val overlay: StateFlow<Overlay?> = _overlay.asStateFlow()

    /** Profile shown by [Overlay.UserProfile]; null while loading. */
    private val _viewedProfile = MutableStateFlow<PublicProfile?>(null)
    val viewedProfile: StateFlow<PublicProfile?> = _viewedProfile.asStateFlow()

    private val _privacyPeople = MutableStateFlow<List<PrivacyPerson>>(emptyList())
    val privacyPeople: StateFlow<List<PrivacyPerson>> = _privacyPeople.asStateFlow()

    private val _mapFocus = MutableStateFlow<MapFocus?>(null)
    val mapFocus: StateFlow<MapFocus?> = _mapFocus.asStateFlow()

    /** API or socket unreachable for a few seconds (web components/OfflineBanner.jsx). */
    val socketConnected: StateFlow<Boolean> = realtime.connected

    private val _shareLinks = MutableStateFlow<List<ShareLink>>(emptyList())
    val shareLinks: StateFlow<List<ShareLink>> = _shareLinks.asStateFlow()

    init {
        viewModelScope.launch {
            // Cached appearance avoids a flash of the default theme before /me returns.
            app.session.appearance().let { _appearance.value = Appearance(it.first, it.second, it.third) }
        }
        viewModelScope.launch {
            session.collect { s ->
                val user = (s as? SessionState.SignedIn)?.user ?: return@collect
                val next = Appearance(user.theme, user.fontPref, user.iconStyle)
                if (next != _appearance.value) {
                    _appearance.value = next
                    app.session.setAppearance(user.theme, user.fontPref, user.iconStyle)
                }
            }
        }
        refreshAppSettings()
        viewModelScope.launch {
            _rememberedLogin.value = app.session.rememberedLogin()
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
        refreshSsoProviders()
        viewModelScope.launch {
            realtime.messages.collect { event ->
                val open = _openChat.value
                if (open != null && open.id == event.conversationId) {
                    appendMessage(event.message)
                    runCatching { api.markConversationRead(open.id) }
                }
                refreshConversations()
            }
        }
        viewModelScope.launch {
            realtime.notifications.collect { n ->
                if (_notifications.value.none { it.id == n.id }) {
                    _notifications.value = listOf(n) + _notifications.value
                }
                if (_showNotifications.value) {
                    runCatching { api.markNotificationsRead() }
                } else {
                    _unreadNotifications.value = _unreadNotifications.value + 1
                }
            }
        }
    }

    private fun signedIn(token: String, user: User) {
        _session.value = SessionState.SignedIn(user)
        realtime.connect(token)
        syncLocationService(user)
        refreshFriends()
        refreshFamilies()
        refreshConversations()
        refreshNotifications()
        app.registerPush()
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

    fun login(login: String, password: String, remember: Boolean) = launchAction {
        val res = api.login(login.trim(), password)
        app.session.setToken(res.token, remember)
        app.session.setRememberedLogin(if (remember) login.trim() else null)
        _rememberedLogin.value = if (remember) login.trim() else ""
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
            _conversations.value = emptyList()
            _openChat.value = null
            _chatMessages.value = emptyList()
            _notifications.value = emptyList()
            _unreadNotifications.value = 0
            _showNotifications.value = false
            _identities.value = null
            _overlay.value = null
            _privacyPeople.value = emptyList()
            _shareLinks.value = emptyList()
            app.onSignedOut()
            _session.value = SessionState.SignedOut
        }
    }

    private fun currentUser(): User? = (session.value as? SessionState.SignedIn)?.user

    fun refreshAppSettings() {
        viewModelScope.launch { runCatching { api.appSettings() }.onSuccess { _appSettings.value = it } }
    }

    /** Runs [block] and reports null on success or the error text (forms that show errors inline). */
    private fun attempt(block: suspend () -> Unit, onResult: (String?) -> Unit) {
        viewModelScope.launch {
            val error = try {
                block()
                null
            } catch (e: Exception) {
                e.message ?: "Bir hata oluştu"
            }
            onResult(error)
        }
    }

    fun forgotPassword(email: String, onResult: (String?) -> Unit) =
        attempt({ api.forgotPassword(email) }, onResult)

    fun resetPassword(token: String, password: String, onResult: (String?) -> Unit) =
        attempt({ api.resetPassword(token, password) }, onResult)

    fun verifyEmail(token: String, onResult: (String?) -> Unit) = attempt({
        api.verifyEmail(token)
        if (currentUser() != null) _session.value = SessionState.SignedIn(api.me())
    }, onResult)

    /**
     * Handles https://maps.paperaxis.com/reset/<token>, /verify/<token> and the
     * papermap://reset/<token>, papermap://verify/<token> forms. Returns false for other URIs.
     */
    fun handleAccountLink(uri: android.net.Uri): Boolean {
        val parts = if (uri.scheme == "papermap") {
            listOfNotNull(uri.host) + uri.pathSegments
        } else {
            uri.pathSegments
        }
        if (parts.size < 2) return false
        val token = parts[1]
        _authLink.value = when (parts[0]) {
            "reset" -> AuthLink.Reset(token)
            "verify" -> AuthLink.Verify(token)
            else -> return false
        }
        return true
    }

    fun closeAuthLink() {
        _authLink.value = null
    }

    // SSO: Google / PaperApp via the server-side flow (docs/SSO.md).
    fun refreshSsoProviders() {
        viewModelScope.launch {
            runCatching { api.ssoProviders() }.onSuccess { _ssoProviders.value = it }
        }
    }

    fun startSsoLogin(provider: String) {
        _openUrl.value = api.ssoStartUrl(provider, "login")
    }

    fun linkProvider(provider: String) = launchAction {
        val ticket = api.linkTicket(provider)
        _openUrl.value = api.ssoStartUrl(provider, "link", ticket)
    }

    fun unlinkProvider(provider: String) = launchAction {
        api.unlinkIdentity(provider)
        _identities.value = api.identities()
        _message.value = "Bağlantı kaldırıldı"
    }

    fun refreshIdentities() {
        viewModelScope.launch { runCatching { api.identities() }.onSuccess { _identities.value = it } }
    }

    fun consumeOpenUrl() {
        _openUrl.value = null
    }

    fun showMessage(text: String) {
        _message.value = text
    }

    /** Handles papermap://sso?code=…&mode=…&provider=… or ?error=… */
    fun handleSsoReturn(uri: android.net.Uri) {
        val error = uri.getQueryParameter("error")
        if (error != null) {
            _message.value = ssoErrorMessage(error)
            return
        }
        val code = uri.getQueryParameter("code") ?: return
        val mode = uri.getQueryParameter("mode") ?: "login"
        launchAction {
            val res = api.ssoExchange(code)
            if (mode == "link" || res.linked) {
                res.user?.let { _session.value = SessionState.SignedIn(it) }
                _identities.value = api.identities()
                _message.value = "Hesap bağlandı"
            } else {
                val token = res.token ?: throw IllegalStateException("Giriş tamamlanamadı")
                val user = res.user ?: api.me()
                app.session.setToken(token, true)
                signedIn(token, user)
            }
        }
    }

    private fun ssoErrorMessage(code: String): String = when (code) {
        "access_denied" -> "Giriş iptal edildi."
        "invalid_state" -> "Oturumun süresi doldu. Yeniden dene."
        "email_missing" -> "Hesaptan e-posta adresi alınamadı."
        "email_in_use" ->
            "Bu e-postayla bir PaperMap hesabı var. Şifrenle giriş yapıp Profil > Bağlı hesaplar'dan bağla."
        "identity_in_use" -> "Bu hesap başka bir PaperMap hesabına bağlı."
        "account_disabled" -> "Bu hesap devre dışı bırakılmış."
        "not_configured" -> "Bu giriş yöntemi şu an kullanılamıyor."
        else -> "Giriş tamamlanamadı. Yeniden dene."
    }

    /** durationMinutes: 60, 480 or null for unlimited (web MapView share menu). */
    fun setSharing(enabled: Boolean, durationMinutes: Int? = null) = launchAction {
        val user = api.setSharing(enabled, durationMinutes)
        _session.value = SessionState.SignedIn(user)
        syncLocationService(user)
    }

    /** Re-reads the user, e.g. when timed sharing has run out. */
    fun refreshMe() {
        viewModelScope.launch {
            runCatching { api.me() }.onSuccess { user ->
                if (currentUser() == null) return@onSuccess
                _session.value = SessionState.SignedIn(user)
                syncLocationService(user)
            }
        }
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

    private suspend fun patchProfile(patch: JsonObject) {
        _session.value = SessionState.SignedIn(api.updateProfile(patch))
    }

    /** Profile info card: display name, username and (without a photo) avatar colour. */
    fun saveProfileInfo(displayName: String, username: String, avatarColor: String?) = launchAction {
        val name = displayName.trim()
        require(name.isNotEmpty()) { "Görünen ad boş olamaz" }
        val uname = username.trim().lowercase()
        require(Regex("^[a-z0-9_]{3,20}$").matches(uname)) { "Kullanıcı adı 3-20 karakter: küçük harf, rakam ve alt çizgi" }
        if (avatarColor != null) require(Regex("^#[0-9a-fA-F]{6}$").matches(avatarColor)) { "Geçersiz renk kodu" }
        patchProfile(buildJsonObject {
            put("displayName", name)
            put("username", uname)
            if (avatarColor != null) put("avatarColor", avatarColor)
        })
        _message.value = "Profil bilgileri kaydedildi."
    }

    fun saveStatus(value: String) = launchAction {
        val text = value.trim()
        patchProfile(buildJsonObject { put("statusText", text) })
        _message.value = if (text.isNotEmpty()) "Durum güncellendi." else "Durum temizlendi."
    }

    /** Theme, font or icon style; null fields are left unchanged. */
    fun changeAppearance(theme: String? = null, font: String? = null, iconStyle: String? = null) = launchAction {
        patchProfile(buildJsonObject {
            if (theme != null) put("theme", theme)
            if (font != null) put("fontPref", font)
            if (iconStyle != null) put("iconStyle", iconStyle)
        })
        _message.value = "Görünüm güncellendi."
    }

    fun resendVerification() = launchAction {
        api.resendVerification()
        _message.value = "Doğrulama e-postası gönderildi."
    }

    fun changePassword(current: String, new: String, onDone: () -> Unit) = launchAction {
        val user = currentUser() ?: return@launchAction
        val firstPassword = !user.hasPassword
        require(new.length >= 8) { "Yeni şifre en az 8 karakter olmalı" }
        if (!firstPassword) require(current.isNotEmpty()) { "Mevcut şifreni gir" }
        api.changePassword(if (firstPassword) null else current, new)
        if (firstPassword) {
            _session.value = SessionState.SignedIn(user.copy(hasPassword = true))
            refreshIdentities()
        }
        _message.value = if (firstPassword) "Şifre belirlendi." else "Şifre değiştirildi."
        onDone()
    }

    fun uploadAvatar(uri: android.net.Uri) = launchAction {
        val image = readImageForUpload(app, uri, maxSide = 768)
        _session.value = SessionState.SignedIn(api.uploadAvatar(image.bytes, image.mime))
        _message.value = "Profil fotoğrafı güncellendi."
    }

    fun removeAvatar() = launchAction {
        _session.value = SessionState.SignedIn(api.removeAvatar())
        _message.value = "Profil fotoğrafı kaldırıldı."
    }

    fun uploadBanner(uri: android.net.Uri) = launchAction {
        val image = readImageForUpload(app, uri, maxSide = 1600)
        _session.value = SessionState.SignedIn(api.uploadBanner(image.bytes, image.mime))
        _message.value = "Banner güncellendi."
    }

    fun removeBanner() = launchAction {
        _session.value = SessionState.SignedIn(api.removeBanner())
        _message.value = "Banner kaldırıldı."
    }

    // Per-person location privacy
    fun refreshPrivacy() {
        viewModelScope.launch { runCatching { api.privacyPeople() }.onSuccess { _privacyPeople.value = it } }
    }

    fun setHidden(personId: String, hidden: Boolean) {
        fun apply(value: Boolean) {
            _privacyPeople.value = _privacyPeople.value.map { if (it.id == personId) it.copy(hidden = value) else it }
        }
        apply(hidden)
        viewModelScope.launch {
            try {
                api.setHidden(personId, hidden)
            } catch (e: Exception) {
                apply(!hidden)
                _message.value = e.message ?: "Bir hata oluştu"
            }
        }
    }

    // Temporary public share links
    fun refreshShareLinks() {
        viewModelScope.launch { runCatching { api.shareLinks() }.onSuccess { _shareLinks.value = it } }
    }

    fun createShareLink(minutes: Int) = launchAction {
        _shareLinks.value = listOf(api.createShareLink(minutes)) + _shareLinks.value
        _message.value = "Konum bağlantısı oluşturuldu."
    }

    fun revokeShareLink(id: String) = launchAction {
        api.revokeShareLink(id)
        _shareLinks.value = _shareLinks.value.filter { it.id != id }
    }

    fun shareLinkUrl(link: ShareLink): String = api.shareLinkUrl(link.token)

    // Pages above the tabs
    fun openAdmin() {
        _overlay.value = Overlay.Admin
    }

    fun openUserProfile(userId: String) {
        _viewedProfile.value = null
        _overlay.value = Overlay.UserProfile(userId)
        launchAction { _viewedProfile.value = api.publicProfile(userId) }
    }

    fun closeOverlay() {
        _overlay.value = null
        _viewedProfile.value = null
    }

    /** Closes full-screen pages and shows [lat],[lng] on the in-app map. */
    fun focusOnMap(lat: Double, lng: Double) {
        _openChat.value = null
        _chatMessages.value = emptyList()
        _showNotifications.value = false
        _overlay.value = null
        _mapFocus.value = MapFocus(lat, lng)
        refreshConversations()
    }

    fun consumeMapFocus() {
        _mapFocus.value = null
    }

    fun requestLocation(userId: String) = launchAction {
        api.requestLocation(userId)
        _message.value = "Konum isteği gönderildi."
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

    // Chat
    fun refreshConversations() {
        viewModelScope.launch {
            runCatching { api.conversations() }.onSuccess { _conversations.value = it }
        }
    }

    fun openChat(conversation: Conversation) {
        _openChat.value = conversation
        _chatMessages.value = emptyList()
        _chatLoading.value = true
        viewModelScope.launch {
            try {
                _chatMessages.value = api.messages(conversation.id)
                api.markConversationRead(conversation.id)
                _conversations.value = _conversations.value.map {
                    if (it.id == conversation.id) it.copy(unread = 0) else it
                }
            } catch (e: Exception) {
                _message.value = e.message ?: "Mesajlar yüklenemedi"
            } finally {
                _chatLoading.value = false
            }
        }
    }

    fun closeChat() {
        _openChat.value = null
        _chatMessages.value = emptyList()
        refreshConversations()
    }

    /** Opens (or creates) the direct chat with a friend. */
    fun messageFriend(userId: String, name: String) = launchAction {
        val id = api.openDirect(userId)
        openChat(_conversations.value.firstOrNull { it.id == id } ?: Conversation(id = id, title = name))
        refreshConversations()
    }

    fun createGroup(name: String, memberIds: List<String>) = launchAction {
        require(name.isNotBlank()) { "Grup adı gir" }
        require(memberIds.isNotEmpty()) { "En az bir arkadaş seç" }
        val id = api.createGroup(name.trim(), memberIds)
        openChat(Conversation(id = id, type = "group", title = name.trim(), memberCount = memberIds.size + 1))
        refreshConversations()
    }

    fun sendMessage(text: String) {
        val chat = _openChat.value ?: return
        val body = text.trim()
        if (body.isEmpty()) return
        viewModelScope.launch {
            try {
                appendMessage(api.sendMessage(chat.id, body))
                refreshConversations()
            } catch (e: Exception) {
                _message.value = e.message ?: "Mesaj gönderilemedi"
            }
        }
    }

    /** Sends a location message: the current position or a saved place. */
    fun sendPlace(lat: Double, lng: Double, label: String, onDone: () -> Unit) = launchAction {
        val chat = _openChat.value ?: return@launchAction
        appendMessage(api.sendPlace(chat.id, lat, lng, label))
        refreshConversations()
        onDone()
    }

    suspend fun savedPlaces(): List<com.paperaxis.papermap.data.Place> = api.places()

    // The sender also receives its own message over the socket; dedupe by id.
    private fun appendMessage(m: ChatMessage) {
        if (_chatMessages.value.none { it.id == m.id }) {
            _chatMessages.value = _chatMessages.value + m
        }
    }

    fun currentUserId(): String? = currentUser()?.id

    // Notifications
    fun refreshNotifications() {
        viewModelScope.launch {
            runCatching { api.notifications() }.onSuccess {
                _notifications.value = it.notifications
                _unreadNotifications.value = it.unread
            }
        }
    }

    fun openNotifications() {
        _openChat.value = null
        _showNotifications.value = true
        refreshNotifications()
    }

    fun closeNotifications() {
        _showNotifications.value = false
    }

    fun markAllNotificationsRead() = launchAction {
        api.markNotificationsRead()
        _unreadNotifications.value = 0
        val now = java.time.Instant.now().toString()
        _notifications.value = _notifications.value.map { if (it.readAt == null) it.copy(readAt = now) else it }
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
