// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.notifications

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.PaperMapApp
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.EmptyState
import com.paperaxis.papermap.ui.common.relativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(vm: AppViewModel) {
    val items by vm.notifications.collectAsStateWithLifecycle()
    val unread by vm.unreadNotifications.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()

    BackHandler { vm.closeNotifications() }

    // While shown, incoming notifications are not repeated as system notifications.
    DisposableEffect(Unit) {
        PaperMapApp.instance.notificationsScreenVisible = true
        onDispose { PaperMapApp.instance.notificationsScreenVisible = false }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Bildirimler") },
                navigationIcon = {
                    IconButton(onClick = { vm.closeNotifications() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
                actions = {
                    if (unread > 0) {
                        TextButton(onClick = { vm.markAllNotificationsRead() }, enabled = !busy) {
                            Text("Tümünü okundu say")
                        }
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (items.isEmpty()) {
                item {
                    EmptyState(
                        "Bildirim yok",
                        "Yeni mesajlar, alan giriş-çıkışları ve düşük pil uyarıları burada görünür.",
                    )
                }
            }
            items(items, key = { it.id }) { n ->
                val isUnread = n.readAt == null
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text(
                        n.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = if (isUnread) FontWeight.SemiBold else FontWeight.Normal,
                    )
                    if (n.body.isNotBlank()) {
                        Text(
                            n.body,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isUnread) FontWeight.Medium else FontWeight.Normal,
                            color = if (isUnread) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    Text(
                        relativeTime(n.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }
}
