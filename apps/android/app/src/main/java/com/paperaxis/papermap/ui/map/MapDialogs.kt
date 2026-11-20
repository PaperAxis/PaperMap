// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.materialIcon
import androidx.compose.material.icons.materialPath
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.paperaxis.papermap.data.Candidates
import com.paperaxis.papermap.data.SosEvent
import com.paperaxis.papermap.ui.common.shortDateTime

/** Material "Pause" (not part of material-icons-core). */
val PauseIcon: ImageVector = materialIcon(name = "Filled.Pause") {
    materialPath {
        moveTo(6f, 19f)
        horizontalLineToRelative(4f)
        verticalLineTo(5f)
        horizontalLineTo(6f)
        verticalLineToRelative(14f)
        close()
        moveTo(14f, 5f)
        verticalLineToRelative(14f)
        horizontalLineToRelative(4f)
        verticalLineTo(5f)
        horizontalLineToRelative(-4f)
        close()
    }
}

val SosRed = Color(0xFFC62828)

/** Thin info strip on the map (web .geo-banner) with optional actions. */
@Composable
fun MapBanner(text: String, actions: @Composable () -> Unit = {}) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            actions()
        }
    }
}

/** Incoming emergency call (socket `sos`); shown on every tab. */
@Composable
fun SosBanner(event: SosEvent, onShow: (() -> Unit)?, onClose: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = SosRed, contentColor = Color.White)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Warning, contentDescription = null)
            val msg = event.message?.takeIf { it.isNotBlank() }
            Text(
                "${event.displayName} acil durum bildirdi" + (msg?.let { ": $it" } ?: "."),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f).padding(start = 8.dp),
            )
            if (onShow != null && event.lat != null && event.lng != null) {
                TextButton(onClick = onShow) { Text("Haritada gör", color = Color.White) }
            }
            TextButton(onClick = onClose) { Text("Kapat", color = Color.White) }
        }
    }
}

/** web MapView share menu: 1 h, 8 h or unlimited. */
@Composable
fun ShareDurationDialog(onPick: (Int?) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Konum paylaşımını aç") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Ne kadar süreyle paylaşmak istersin?")
                Button(onClick = { onPick(60) }, modifier = Modifier.fillMaxWidth()) { Text("1 saat") }
                Button(onClick = { onPick(8 * 60) }, modifier = Modifier.fillMaxWidth()) { Text("8 saat") }
                Button(onClick = { onPick(null) }, modifier = Modifier.fillMaxWidth()) { Text("Süresiz") }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } },
    )
}

@Composable
fun SosConfirmDialog(busy: Boolean, onSend: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Acil durum çağrısı") },
        text = {
            Text(
                "Tüm arkadaşlarına ve aile üyelerine acil durum bildirimi ve son konumun gönderilecek. Onaylıyor musun?",
            )
        },
        confirmButton = {
            Button(
                onClick = onSend,
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = SosRed, contentColor = Color.White),
            ) { Text(if (busy) "Gönderiliyor…" else "Acil durum gönder") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Vazgeç") } },
    )
}

@Composable
fun NewGeofenceDialog(busy: Boolean, onDismiss: () -> Unit, onCreate: (name: String, radius: Int) -> Unit) {
    var name by remember { mutableStateOf("") }
    var radius by remember { mutableIntStateOf(300) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni alan") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Alan adı") },
                    placeholder = { Text("Örn. Ev, Okul") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                RadiusSlider(radius) { radius = it }
            }
        },
        confirmButton = {
            Button(onClick = { onCreate(name, radius) }, enabled = !busy && name.isNotBlank()) { Text("Oluştur") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } },
    )
}

@Composable
fun NewPlaceDialog(busy: Boolean, onDismiss: () -> Unit, onCreate: (name: String, color: String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var color by remember { mutableStateOf(PLACE_COLORS[0]) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni yer") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Yer adı") },
                    placeholder = { Text("Örn. Ev, İş, Spor salonu") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Renk", style = MaterialTheme.typography.labelLarge)
                ColorChoices(color) { color = it }
            }
        },
        confirmButton = {
            Button(onClick = { onCreate(name, color) }, enabled = !busy && name.isNotBlank()) { Text("Kaydet") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } },
    )
}

@Composable
fun NewMeetingDialog(
    candidates: Candidates,
    busy: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, memberIds: List<String>) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf(setOf<String>()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Yeni buluşma") },
        text = {
            Column(
                Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Buluşma adı") },
                    placeholder = { Text("Örn. Akşam yemeği") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Kimleri davet etmek istersin?", style = MaterialTheme.typography.titleSmall)
                InviteePicker(candidates, selected) { selected = it }
            }
        },
        confirmButton = {
            Button(onClick = { onCreate(name, selected.toList()) }, enabled = !busy && name.isNotBlank()) {
                Text("Oluştur")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } },
    )
}

/** History playback: play / pause, scrubber and the fix time (web .playback-bar). */
@Composable
fun PlaybackBar(
    count: Int,
    index: Int,
    playing: Boolean,
    time: String?,
    onToggle: () -> Unit,
    onSeek: (Int) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onToggle) {
                Icon(
                    if (playing) PauseIcon else Icons.Filled.PlayArrow,
                    contentDescription = if (playing) "Duraklat" else "Oynat",
                )
            }
            Slider(
                value = index.toFloat(),
                onValueChange = { onSeek(it.toInt()) },
                valueRange = 0f..(count - 1).coerceAtLeast(1).toFloat(),
                modifier = Modifier.weight(1f),
            )
            Text(
                shortDateTime(time),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(start = 8.dp, end = 8.dp),
            )
        }
    }
}

/** Small outlined action used inside banners. */
@Composable
fun BannerAction(label: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.padding(end = 4.dp)) { Text(label) }
}
