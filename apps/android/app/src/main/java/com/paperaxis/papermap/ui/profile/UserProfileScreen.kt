// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.profile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.Avatar

/** A friend's or family member's profile (web pages/UserProfile.jsx). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserProfileScreen(vm: AppViewModel, userId: String) {
    val profile by vm.viewedProfile.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val isMe = vm.currentUserId() == userId
    BackHandler { vm.closeOverlay() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(profile?.displayName ?: "Profil") },
                navigationIcon = {
                    IconButton(onClick = vm::closeOverlay) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
            )
        },
    ) { padding ->
        val p = profile
        if (p == null) {
            Column(Modifier.fillMaxSize().padding(padding), horizontalAlignment = Alignment.CenterHorizontally) {
                if (busy) CircularProgressIndicator(Modifier.padding(32.dp))
            }
            return@Scaffold
        }
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
            ProfileBanner(p.bannerPath) {
                Avatar(p.displayName, p.avatarColor, size = 72.dp, imagePath = p.avatarPath)
            }
            Column(Modifier.padding(16.dp)) {
                Text(p.displayName, style = MaterialTheme.typography.headlineSmall)
                p.username?.let { Text("@$it", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            if (!isMe) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Button(
                        onClick = { vm.messageFriend(p.id, p.displayName) },
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Filled.Email, contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                        Text("Mesaj gönder", modifier = Modifier.padding(start = 8.dp))
                    }
                    OutlinedButton(
                        onClick = { vm.requestLocation(p.id) },
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Filled.LocationOn, contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                        Text("Konum iste", modifier = Modifier.padding(start = 8.dp))
                    }
                }
            }
        }
    }
}
