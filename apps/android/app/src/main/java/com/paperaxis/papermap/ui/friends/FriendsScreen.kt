// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.friends

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.FriendEntry
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.EmptyState
import com.paperaxis.papermap.ui.common.PersonRow
import com.paperaxis.papermap.ui.common.SectionLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendsScreen(vm: AppViewModel) {
    val data by vm.friends.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    var username by remember { mutableStateOf("") }
    var removing by remember { mutableStateOf<FriendEntry?>(null) }

    LaunchedEffect(Unit) { vm.refreshFriends() }

    Scaffold(topBar = { TopAppBar(title = { Text("Arkadaşlar") }) }) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("Kullanıcı adı") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            vm.addFriend(username)
                            username = ""
                        },
                        enabled = !busy && username.isNotBlank(),
                        modifier = Modifier.padding(start = 8.dp),
                    ) { Text("Ekle") }
                }
            }

            if (data.incoming.isNotEmpty()) {
                item { SectionLabel("Gelen istekler") }
                items(data.incoming, key = { "in-" + it.friendshipId }) { entry ->
                    PersonRow(entry.user.displayName, entry.user.username?.let { "@$it" }, entry.user.avatarColor) {
                        TextButton(onClick = { vm.removeFriend(entry.friendshipId) }) { Text("Reddet") }
                        TextButton(onClick = { vm.acceptFriend(entry.friendshipId) }) { Text("Kabul et") }
                    }
                }
            }

            item { SectionLabel("Arkadaşlar") }
            if (data.friends.isEmpty()) {
                item {
                    EmptyState(
                        "Henüz arkadaşın yok",
                        "Kullanıcı adıyla istek gönder. Kabul edildiğinde birbirinizi haritada görürsünüz.",
                    )
                }
            }
            items(data.friends, key = { "f-" + it.friendshipId }) { entry ->
                PersonRow(entry.user.displayName, entry.user.username?.let { "@$it" }, entry.user.avatarColor) {
                    TextButton(onClick = { removing = entry }) { Text("Çıkar") }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }

            if (data.outgoing.isNotEmpty()) {
                item { SectionLabel("Gönderilen istekler") }
                items(data.outgoing, key = { "out-" + it.friendshipId }) { entry ->
                    PersonRow(entry.user.displayName, "Yanıt bekleniyor", entry.user.avatarColor) {
                        TextButton(onClick = { vm.removeFriend(entry.friendshipId) }) { Text("Geri al") }
                    }
                }
            }
        }
    }

    removing?.let { entry ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Arkadaşlıktan çıkar") },
            text = { Text("${entry.user.displayName} artık konumunu göremeyecek, sen de onunkini.") },
            confirmButton = {
                TextButton(onClick = {
                    vm.removeFriend(entry.friendshipId)
                    removing = null
                }) { Text("Çıkar", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Vazgeç") } },
        )
    }
}
