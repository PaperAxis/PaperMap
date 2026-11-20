// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.Conversation
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.EmptyState
import com.paperaxis.papermap.ui.common.relativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationsScreen(vm: AppViewModel) {
    val conversations by vm.conversations.collectAsStateWithLifecycle()
    var creatingGroup by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.refreshConversations() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sohbet") },
                actions = {
                    IconButton(onClick = { creatingGroup = true }) {
                        Icon(Icons.Filled.Add, contentDescription = "Yeni grup")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (conversations.isEmpty()) {
                item {
                    EmptyState(
                        "Henüz sohbet yok",
                        "Arkadaşlar sekmesinden birine mesaj yaz ya da sağ üstten grup oluştur. Aile sohbetleri kendiliğinden görünür.",
                    )
                }
            }
            items(conversations, key = { it.id }) { c ->
                ConversationRow(c) { vm.openChat(c) }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }

    if (creatingGroup) {
        NewGroupDialog(vm) { creatingGroup = false }
    }
}

@Composable
private fun ConversationRow(c: Conversation, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(c.title, c.otherUser?.avatarColor ?: if (c.type == "family") "#4F6A44" else null)
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    c.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = if (c.unread > 0) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    relativeTime(c.lastMessage?.createdAt ?: c.updatedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                val preview = c.lastMessage?.let { last ->
                    if (c.type != "direct" && !last.senderName.isNullOrBlank()) "${last.senderName}: ${last.body}" else last.body
                } ?: typeLabel(c)
                Text(
                    preview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (c.unread > 0) {
                    Box(
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (c.unread > 99) "99+" else c.unread.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                }
            }
        }
    }
}

private fun typeLabel(c: Conversation): String = when (c.type) {
    "family" -> "Aile sohbeti"
    "group" -> "${c.memberCount} kişi"
    else -> "Henüz mesaj yok"
}

@Composable
private fun NewGroupDialog(vm: AppViewModel, onDismiss: () -> Unit) {
    val friends by vm.friends.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }
    val selected = remember { mutableStateListOf<String>() }

    LaunchedEffect(Unit) { vm.refreshFriends() }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni grup") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Grup adı") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    "Üyeler",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                )
                if (friends.friends.isEmpty()) {
                    Text(
                        "Gruba eklemek için önce arkadaş ekle.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Column(modifier = Modifier.heightIn(max = 280.dp).verticalScroll(rememberScrollState())) {
                    friends.friends.forEach { entry ->
                        val id = entry.user.id
                        val checked = id in selected
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { if (checked) selected.remove(id) else selected.add(id) },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = checked,
                                onCheckedChange = { on -> if (on) selected.add(id) else selected.remove(id) },
                            )
                            Text(entry.user.displayName, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    vm.createGroup(name, selected.toList())
                    onDismiss()
                },
                enabled = name.isNotBlank() && selected.isNotEmpty(),
            ) { Text("Oluştur") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } },
    )
}
