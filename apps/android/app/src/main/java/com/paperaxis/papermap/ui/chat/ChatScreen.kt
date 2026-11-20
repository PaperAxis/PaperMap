// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.chat

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.ChatMessage
import com.paperaxis.papermap.data.Conversation
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.EmptyState
import com.paperaxis.papermap.ui.common.relativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(vm: AppViewModel, chat: Conversation) {
    val messages by vm.chatMessages.collectAsStateWithLifecycle()
    val loading by vm.chatLoading.collectAsStateWithLifecycle()
    val myId = vm.currentUserId()
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    BackHandler { vm.closeChat() }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(chat.title.ifBlank { "Sohbet" }) },
                navigationIcon = {
                    IconButton(onClick = { vm.closeChat() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).imePadding()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                when {
                    loading && messages.isEmpty() -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                    messages.isEmpty() -> EmptyState("Henüz mesaj yok", "İlk mesajı sen yaz.")
                    else -> LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(messages, key = { it.id }) { m ->
                            MessageBubble(m, mine = m.senderId == myId, showSender = chat.type != "direct")
                        }
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = { Text("Mesaj yaz") },
                    maxLines = 4,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = {
                        vm.sendMessage(draft)
                        draft = ""
                    },
                    enabled = draft.isNotBlank(),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Gönder")
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(m: ChatMessage, mine: Boolean, showSender: Boolean) {
    val context = LocalContext.current
    val bg: Color = if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val fg: Color = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
    ) {
        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
            if (showSender && !mine) {
                Text(
                    m.senderName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 4.dp, bottom = 2.dp),
                )
            }
            Surface(
                color = bg,
                contentColor = fg,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.widthIn(max = 300.dp).then(
                    if (m.isPlace) {
                        Modifier.clickable {
                            val lat = m.placeLat ?: return@clickable
                            val lng = m.placeLng ?: return@clickable
                            val label = Uri.encode(m.placeLabel ?: "Konum")
                            val uri = Uri.parse("geo:$lat,$lng?q=$lat,$lng($label)")
                            try {
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            } catch (_: ActivityNotFoundException) {
                                // No maps app installed.
                            }
                        }
                    } else {
                        Modifier
                    },
                ),
            ) {
                Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    if (m.isPlace) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.LocationOn, contentDescription = null)
                            Text(
                                "Konum: ${m.placeLabel ?: "Konum"}",
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.padding(start = 6.dp),
                            )
                        }
                        Text(
                            "Haritada açmak için dokun",
                            style = MaterialTheme.typography.labelSmall,
                        )
                    } else {
                        Text(m.body.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
            Text(
                relativeTime(m.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}
