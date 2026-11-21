// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.admin

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.paperaxis.papermap.data.AdminUser
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.SectionLabel
import com.paperaxis.papermap.ui.common.uploadUrl

/** Admin panel (web pages/Admin.jsx): stats, branding and user management. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AdminScreen(vm: AppViewModel, admin: AdminViewModel = viewModel()) {
    val stats by admin.stats.collectAsStateWithLifecycle()
    val users by admin.users.collectAsStateWithLifecycle()
    val busy by admin.busy.collectAsStateWithLifecycle()
    val settings by vm.appSettings.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var name by remember(settings.appName) { mutableStateOf(settings.appName) }
    var query by remember { mutableStateOf("") }
    var deleting by remember { mutableStateOf<AdminUser?>(null) }
    val myId = vm.currentUserId()

    BackHandler { vm.closeOverlay() }
    LaunchedEffect(Unit) {
        admin.load()
        vm.refreshAppSettings()
    }
    LaunchedEffect(Unit) { admin.messages.collect { snackbar.showSnackbar(it) } }

    val logoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) admin.uploadLogo(uri) { vm.refreshAppSettings() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Yönetim") },
                navigationIcon = {
                    IconButton(onClick = vm::closeOverlay) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding)) {
            stats?.let { s ->
                item { SectionLabel("İstatistik") }
                item {
                    FlowRow(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        StatTile(s.users, "kullanıcı")
                        StatTile(s.families, "aile")
                        StatTile(s.conversations, "sohbet")
                        StatTile(s.messages, "mesaj")
                    }
                }
            }

            item { SectionLabel("Uygulama ayarları") }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Uygulama adı") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedButton(
                        onClick = { admin.saveAppName(name) { vm.refreshAppSettings() } },
                        enabled = !busy && name.isNotBlank(),
                        modifier = Modifier.padding(start = 8.dp),
                    ) { Text("Kaydet") }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Logo", style = MaterialTheme.typography.titleMedium)
                    val logo = uploadUrl(settings.logoPath)
                    if (logo != null) {
                        AsyncImage(model = logo, contentDescription = "logo", modifier = Modifier.heightIn(max = 40.dp))
                    } else {
                        Text("Logo yok", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    OutlinedButton(
                        onClick = { logoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        enabled = !busy,
                    ) { Text("Yükle") }
                    if (logo != null) {
                        OutlinedButton(onClick = { admin.removeLogo { vm.refreshAppSettings() } }, enabled = !busy) {
                            Text("Kaldır")
                        }
                    }
                }
            }

            item { SectionLabel("Kullanıcılar (${users.size})") }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text("Ad, kullanıcı adı veya e-posta ara") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { admin.search(query) }),
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedButton(
                        onClick = { admin.search(query) },
                        enabled = !busy,
                        modifier = Modifier.padding(start = 8.dp),
                    ) { Text("Ara") }
                }
            }
            items(users, key = { it.id }) { u ->
                AdminUserRow(
                    user = u,
                    isMe = u.id == myId,
                    busy = busy,
                    onToggleDisabled = { admin.setDisabled(u, !u.disabled) },
                    onToggleAdmin = { admin.setAdmin(u, !u.isAdmin) },
                    onDelete = { deleting = u },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }
        }
    }

    deleting?.let { u ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Kullanıcıyı sil") },
            text = { Text("${u.displayName} silinsin mi? Bu işlem geri alınamaz.") },
            confirmButton = {
                TextButton(onClick = {
                    admin.deleteUser(u)
                    deleting = null
                }) { Text("Sil", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Vazgeç") } },
        )
    }
}

@Composable
private fun StatTile(value: Int, label: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(value.toString(), style = MaterialTheme.typography.titleLarge)
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AdminUserRow(
    user: AdminUser,
    isMe: Boolean,
    busy: Boolean,
    onToggleDisabled: () -> Unit,
    onToggleAdmin: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(user.displayName, user.avatarColor, imagePath = user.avatarPath)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                val tags = listOfNotNull(
                    if (user.isAdmin) "Yönetici" else null,
                    if (user.disabled) "Devre dışı" else null,
                )
                Text(user.displayName, style = MaterialTheme.typography.titleMedium)
                if (tags.isNotEmpty()) {
                    Text(
                        tags.joinToString(" · "),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (user.disabled) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    )
                }
                Text(
                    "@${user.username.orEmpty()} · ${user.email.orEmpty()}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        if (!isMe) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onToggleDisabled, enabled = !busy) {
                    Text(if (user.disabled) "Aktifleştir" else "Devre dışı")
                }
                TextButton(onClick = onToggleAdmin, enabled = !busy) {
                    Text(if (user.isAdmin) "Yöneticiliği al" else "Yönetici yap")
                }
                TextButton(onClick = onDelete, enabled = !busy) {
                    Text("Sil", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
