// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "papermap")

/** Persists the session token and small app preferences. */
class SessionStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("token")
    private val updateCheckedKey = longPreferencesKey("update_checked_at")
    private val loginKey = stringPreferencesKey("remembered_login")

    // "Beni hatirla" off: the token lives only in this process and is gone
    // when the app process ends.
    @Volatile private var memoryToken: String? = null

    val tokenFlow: Flow<String?> = context.dataStore.data.map { memoryToken ?: it[tokenKey] }

    suspend fun token(): String? = memoryToken ?: context.dataStore.data.map { it[tokenKey] }.first()

    suspend fun setToken(token: String?, remember: Boolean = true) {
        memoryToken = if (token != null && !remember) token else null
        context.dataStore.edit { prefs ->
            if (token == null || !remember) prefs.remove(tokenKey) else prefs[tokenKey] = token
        }
    }

    /** Login name to prefill the login form; empty when not remembered. */
    suspend fun rememberedLogin(): String =
        context.dataStore.data.map { it[loginKey] ?: "" }.first()

    suspend fun setRememberedLogin(login: String?) {
        context.dataStore.edit { prefs ->
            if (login.isNullOrBlank()) prefs.remove(loginKey) else prefs[loginKey] = login
        }
    }

    suspend fun updateCheckedAt(): Long =
        context.dataStore.data.map { it[updateCheckedKey] ?: 0L }.first()

    suspend fun setUpdateCheckedAt(value: Long) {
        context.dataStore.edit { it[updateCheckedKey] = value }
    }
}
