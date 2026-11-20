// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.admin

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.paperaxis.papermap.PaperMapApp
import com.paperaxis.papermap.data.AdminStats
import com.paperaxis.papermap.data.AdminUser
import com.paperaxis.papermap.data.AppSettings
import com.paperaxis.papermap.ui.common.readImageForUpload
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Admin panel state (web pages/Admin.jsx); every call needs an admin account. */
class AdminViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as PaperMapApp
    private val api = app.api

    private val _stats = MutableStateFlow<AdminStats?>(null)
    val stats: StateFlow<AdminStats?> = _stats.asStateFlow()

    private val _users = MutableStateFlow<List<AdminUser>>(emptyList())
    val users: StateFlow<List<AdminUser>> = _users.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    /** Snackbar texts: results and errors. */
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val messages: SharedFlow<String> = _messages.asSharedFlow()

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

    fun load() {
        viewModelScope.launch { runCatching { api.adminStats() }.onSuccess { _stats.value = it } }
        search("")
    }

    fun search(query: String) = act { _users.value = api.adminUsers(query) }

    fun setDisabled(user: AdminUser, disabled: Boolean) = act {
        val updated = api.adminUpdateUser(user.id, disabled = disabled)
        _users.value = _users.value.map { if (it.id == user.id) updated else it }
    }

    fun setAdmin(user: AdminUser, isAdmin: Boolean) = act {
        val updated = api.adminUpdateUser(user.id, isAdmin = isAdmin)
        _users.value = _users.value.map { if (it.id == user.id) updated else it }
    }

    fun deleteUser(user: AdminUser) = act("Kullanıcı silindi.") {
        api.adminDeleteUser(user.id)
        _users.value = _users.value.filter { it.id != user.id }
    }

    fun saveAppName(name: String, onSaved: (AppSettings) -> Unit) = act("Uygulama adı kaydedildi.") {
        onSaved(api.updateAppName(name.trim()))
    }

    fun uploadLogo(uri: Uri, onSaved: (AppSettings) -> Unit) = act("Logo güncellendi.") {
        val image = readImageForUpload(app, uri, maxSide = 512, keepAlpha = true)
        onSaved(api.uploadLogo(image.bytes, image.mime))
    }

    fun removeLogo(onSaved: (AppSettings) -> Unit) = act("Logo kaldırıldı.") {
        onSaved(api.removeLogo())
    }
}
