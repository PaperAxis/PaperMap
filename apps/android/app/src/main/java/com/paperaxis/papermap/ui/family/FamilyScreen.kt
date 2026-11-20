// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.family

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.FamilyDetail
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.EmptyState
import com.paperaxis.papermap.ui.common.PersonRow
import com.paperaxis.papermap.ui.common.SectionLabel

@Composable
fun FamilyScreen(vm: AppViewModel) {
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val id = openId
    if (id == null) {
        FamilyList(vm) { openId = it; vm.openFamily(it) }
    } else {
        BackHandler { openId = null; vm.openFamily(null) }
        FamilyDetailScreen(vm, onBack = { openId = null; vm.openFamily(null) })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FamilyList(vm: AppViewModel, onOpen: (String) -> Unit) {
    val families by vm.families.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    LaunchedEffect(Unit) { vm.refreshFamilies() }

    Scaffold(topBar = { TopAppBar(title = { Text("Aile") }) }) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            item { SectionLabel("Ailelerin") }
            if (families.isEmpty()) {
                item {
                    EmptyState(
                        "Henüz bir ailede değilsin",
                        "Bir aile oluştur ve davet kodunu paylaş ya da sana verilen kodla katıl.",
                    )
                }
            }
            items(families, key = { it.id }) { f ->
                PersonRow(
                    name = f.name,
                    subtitle = "${f.memberCount} üye" + if (f.role == "owner") " · Yönetici" else "",
                    color = "#171918",
                    modifier = Modifier.clickable { onOpen(f.id) },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            }

            item { SectionLabel("Aile oluştur") }
            item {
                InputRow(name, { name = it }, "Aile adı", "Oluştur", enabled = !busy) {
                    vm.createFamily(name)
                    name = ""
                }
            }
            item { SectionLabel("Davet koduyla katıl") }
            item {
                InputRow(code, { code = it.uppercase() }, "Davet kodu", "Katıl", enabled = !busy) {
                    vm.joinFamily(code)
                    code = ""
                }
            }
        }
    }
}

@Composable
private fun InputRow(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    action: String,
    enabled: Boolean,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(label) },
            singleLine = true,
            modifier = Modifier.weight(1f),
        )
        OutlinedButton(
            onClick = onAction,
            enabled = enabled && value.isNotBlank(),
            modifier = Modifier.padding(start = 8.dp),
        ) { Text(action) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FamilyDetailScreen(vm: AppViewModel, onBack: () -> Unit) {
    val family by vm.family.collectAsStateWithLifecycle()
    var confirmLeave by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(family?.name ?: "Aile") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
            )
        },
    ) { padding ->
        val f = family
        if (f == null) {
            Column(Modifier.padding(padding)) { EmptyState("Yükleniyor", "Aile bilgileri alınıyor.") }
        } else {
            FamilyDetailContent(f, Modifier.padding(padding), onLeave = { confirmLeave = true })
        }
    }

    val f = family
    if (confirmLeave && f != null) {
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text("Aileden ayrıl") },
            text = { Text("${f.name} ailesinden ayrılırsan üyeler seni haritada göremez.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmLeave = false
                    vm.leaveFamily(f.id)
                    onBack()
                }) { Text("Ayrıl", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text("Vazgeç") } },
        )
    }
}

@Composable
private fun FamilyDetailContent(f: FamilyDetail, modifier: Modifier, onLeave: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    LazyColumn(modifier = modifier.fillMaxSize()) {
        f.inviteCode?.let { code ->
            item { SectionLabel("Davet kodu") }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(code, style = MaterialTheme.typography.headlineSmall, fontFamily = FontFamily.Monospace)
                    TextButton(onClick = { clipboard.setText(AnnotatedString(code)) }) { Text("Kopyala") }
                }
            }
        }
        item { SectionLabel("Üyeler") }
        items(f.members, key = { it.id }) { m ->
            PersonRow(
                m.displayName,
                listOfNotNull(m.username?.let { "@$it" }, if (m.role == "owner") "Yönetici" else null)
                    .joinToString(" · "),
                m.avatarColor,
            )
        }
        item {
            Button(
                onClick = onLeave,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
            ) { Text("Aileden ayrıl") }
        }
    }
}
