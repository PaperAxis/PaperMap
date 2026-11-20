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

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[tokenKey] }

    suspend fun token(): String? = tokenFlow.first()

    suspend fun setToken(token: String?) {
        context.dataStore.edit { prefs ->
            if (token == null) prefs.remove(tokenKey) else prefs[tokenKey] = token
        }
    }

    suspend fun updateCheckedAt(): Long =
        context.dataStore.data.map { it[updateCheckedKey] ?: 0L }.first()

    suspend fun setUpdateCheckedAt(value: Long) {
        context.dataStore.edit { it[updateCheckedKey] = value }
    }
}
