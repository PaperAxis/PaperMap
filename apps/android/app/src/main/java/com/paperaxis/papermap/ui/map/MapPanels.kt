// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.paperaxis.papermap.data.CandidatePerson
import com.paperaxis.papermap.data.Candidates
import com.paperaxis.papermap.data.Geofence
import com.paperaxis.papermap.data.Meeting
import com.paperaxis.papermap.data.MeetingDetail
import com.paperaxis.papermap.data.MeetingMember
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.Place
import com.paperaxis.papermap.data.TripUpdate
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.batteryLabel
import com.paperaxis.papermap.ui.common.parseHexColor
import com.paperaxis.papermap.ui.common.relativeTime
import kotlin.math.roundToInt

/** web components/PlacesPanel.jsx */
val PLACE_COLORS = listOf("#7c3aed", "#2563eb", "#059669", "#dc2626", "#ea580c", "#0891b2")

/** Scrollable sheet body with a title and a close action. */
@Composable
fun PanelBody(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
            TextButton(onClick = onClose) { Text("Kapat") }
        }
        content()
    }
}

@Composable
private fun Muted(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

fun peerMeta(battery: Int?, charging: Boolean?, updatedAt: String?): String {
    val b = batteryLabel(battery, charging)
    val t = relativeTime(updatedAt)
    return listOf(b, t).filter { it.isNotEmpty() }.joinToString(" · ")
}

fun tripLabel(t: TripUpdate): String =
    "→ ${t.destLabel}" + (t.etaMinutes?.let { " · ~$it dk" } ?: "")

/** web PeerList.jsx inside the "Haritadaki kişiler" panel. */
@Composable
fun PeoplePanel(
    peers: List<Peer>,
    trips: Map<String, TripUpdate>,
    onClose: () -> Unit,
    onMyHistory: () -> Unit,
    onSelect: (Peer) -> Unit,
    onHistory: (Peer) -> Unit,
) {
    PanelBody("Haritadaki kişiler", onClose) {
        OutlinedButton(onClick = onMyHistory) { Text("Konum geçmişim") }
        if (peers.isEmpty()) {
            Muted(
                "Henüz haritada kimse yok. Arkadaş ekle veya bir aileye katıl; konum paylaşımı açık olan " +
                    "kişiler burada görünür.",
            )
        }
        peers.forEach { p ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Row(
                    Modifier.weight(1f).clickable { onSelect(p) }.padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(p.displayName, p.avatarColor, imagePath = p.avatarPath)
                    Column(Modifier.padding(start = 12.dp)) {
                        Text(p.displayName, style = MaterialTheme.typography.titleMedium)
                        if (!p.statusText.isNullOrBlank()) {
                            Text(p.statusText, style = MaterialTheme.typography.bodyMedium)
                        }
                        Muted(peerMeta(p.battery, p.charging, p.updatedAt))
                        trips[p.userId]?.let {
                            Text(tripLabel(it), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                OutlinedButton(onClick = { onHistory(p) }) { Text("Geçmiş") }
            }
        }
    }
}

@Composable
private fun CheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = checked, role = Role.Checkbox, onValueChange = onChange),
    ) {
        Checkbox(checked = checked, onCheckedChange = null)
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 8.dp))
    }
}

/** Radius slider, 50–5000 m in 50 m steps (web GeofencePanel / MapView). */
@Composable
fun RadiusSlider(radius: Int, onChange: (Int) -> Unit) {
    Text("Yarıçap: $radius m", style = MaterialTheme.typography.labelLarge)
    Slider(
        value = radius.toFloat(),
        onValueChange = { onChange(((it / 50f).roundToInt() * 50).coerceIn(50, 5000)) },
        valueRange = 50f..5000f,
        steps = (5000 - 50) / 50 - 1,
    )
}

/** web components/GeofencePanel.jsx */
@Composable
fun GeofencePanel(
    geofences: List<Geofence>,
    candidates: Candidates,
    busy: Boolean,
    onClose: () -> Unit,
    onStartPlacing: () -> Unit,
    onFocus: (Geofence) -> Unit,
    onSave: (Geofence, name: String, radius: Int, enter: Boolean, exit: Boolean, onDone: () -> Unit) -> Unit,
    onDelete: (Geofence) -> Unit,
    onAddWatches: (Geofence, List<String>, onDone: () -> Unit) -> Unit,
    onRemoveWatch: (Geofence, String) -> Unit,
) {
    var expanded by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<String?>(null) }
    PanelBody("Alanlar", onClose) {
        Button(onClick = onStartPlacing) { Text("+ Yeni alan (haritada nokta seç)") }
        if (geofences.isEmpty()) {
            Muted("Henüz alan yok. Yeni bir alan ekleyip seçtiğin kişiler girince/çıkınca bildirim al.")
        }
        geofences.forEach { g ->
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Column(Modifier.clickable { onFocus(g) }) {
                Text(g.name, style = MaterialTheme.typography.titleMedium)
                Muted("${g.radius.roundToInt()} m · ${g.watches.size} kişi izleniyor")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = {
                    expanded = null
                    editing = if (editing == g.id) null else g.id
                }) { Text(if (editing == g.id) "Vazgeç" else "Düzenle") }
                TextButton(onClick = {
                    editing = null
                    expanded = if (expanded == g.id) null else g.id
                }) { Text(if (expanded == g.id) "Gizle" else "Kişiler") }
                TextButton(onClick = { onDelete(g) }) { Text("Sil", color = MaterialTheme.colorScheme.error) }
            }
            if (editing == g.id) GeofenceEditor(g, busy, onCancel = { editing = null }) { name, radius, enter, exit ->
                onSave(g, name, radius, enter, exit) { editing = null }
            }
            if (expanded == g.id) GeofencePeople(g, candidates, busy, onAddWatches, onRemoveWatch)
        }
    }
}

@Composable
private fun GeofenceEditor(
    g: Geofence,
    busy: Boolean,
    onCancel: () -> Unit,
    onSave: (name: String, radius: Int, enter: Boolean, exit: Boolean) -> Unit,
) {
    var name by remember(g.id) { mutableStateOf(g.name) }
    var radius by remember(g.id) { mutableStateOf(g.radius.roundToInt().coerceIn(50, 5000)) }
    var enter by remember(g.id) { mutableStateOf(g.notifyOnEnter) }
    var exit by remember(g.id) { mutableStateOf(g.notifyOnExit) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Alan adı") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        RadiusSlider(radius) { radius = it }
        CheckRow("Girişte bildir", enter) { enter = it }
        CheckRow("Çıkışta bildir", exit) { exit = it }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onCancel) { Text("İptal") }
            Button(onClick = { onSave(name, radius, enter, exit) }, enabled = !busy) { Text("Kaydet") }
        }
    }
}

@Composable
private fun GeofencePeople(
    g: Geofence,
    candidates: Candidates,
    busy: Boolean,
    onAddWatches: (Geofence, List<String>, onDone: () -> Unit) -> Unit,
    onRemoveWatch: (Geofence, String) -> Unit,
) {
    var selected by remember(g.id) { mutableStateOf(setOf<String>()) }
    val watched = g.watches.map { it.userId }.toSet()
    val familyAll = candidates.family?.members.orEmpty()
    val famIds = familyAll.map { it.id }.toSet()
    val famMembers = familyAll.filter { it.id !in watched }
    val friendOpts = candidates.friends.filter { it.id !in watched && it.id !in famIds }

    Column(Modifier.padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (g.watches.isEmpty()) Muted("Kimse izlenmiyor.")
        g.watches.forEach { w ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(w.displayName, w.avatarColor, size = 32.dp, imagePath = w.avatarPath)
                Column(Modifier.weight(1f).padding(start = 8.dp)) {
                    Text(w.displayName, style = MaterialTheme.typography.titleMedium)
                    Muted(
                        when (w.inside) {
                            true -> "içeride"
                            false -> "dışarıda"
                            null -> "henüz bilinmiyor"
                        },
                    )
                }
                TextButton(onClick = { onRemoveWatch(g, w.userId) }) { Text("Çıkar") }
            }
        }
        if (famMembers.isEmpty() && friendOpts.isEmpty()) {
            Muted("Eklenebilecek kişi yok.")
        } else {
            Text("Kişi ekle", style = MaterialTheme.typography.titleMedium)
            if (famMembers.isNotEmpty()) {
                val allIn = famMembers.all { it.id in selected }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${candidates.family?.name.orEmpty()} (aile)", modifier = Modifier.weight(1f))
                    TextButton(onClick = {
                        selected = if (allIn) selected - famMembers.map { it.id }.toSet() else selected + famMembers.map { it.id }
                    }) { Text(if (allIn) "Kaldır" else "Tümünü seç") }
                }
                famMembers.forEach { m -> CheckRow(m.displayName, m.id in selected) { selected = selected.toggle(m.id, it) } }
            }
            if (friendOpts.isNotEmpty()) {
                Text("Arkadaşlar")
                friendOpts.forEach { f -> CheckRow(f.displayName, f.id in selected) { selected = selected.toggle(f.id, it) } }
            }
            Button(
                onClick = { onAddWatches(g, selected.toList()) { selected = emptySet() } },
                enabled = selected.isNotEmpty() && !busy,
            ) { Text("Seçilenleri ekle (${selected.size})") }
        }
    }
}

private fun Set<String>.toggle(id: String, on: Boolean): Set<String> = if (on) this + id else this - id

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ColorChoices(selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PLACE_COLORS.forEach { c ->
            val isSelected = c.equals(selected, ignoreCase = true)
            Box(
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(parseHexColor(c))
                    .border(if (isSelected) 3.dp else 0.dp, MaterialTheme.colorScheme.onBackground, CircleShape)
                    .clickable { onSelect(c) }
                    .semantics { contentDescription = "Renk $c" },
            )
        }
    }
}

/** web components/PlacesPanel.jsx */
@Composable
fun PlacesPanel(
    places: List<Place>,
    busy: Boolean,
    onClose: () -> Unit,
    onStartPlacing: () -> Unit,
    onFocus: (Place) -> Unit,
    onNavigate: (Place) -> Unit,
    onSave: (Place, name: String, color: String, onDone: () -> Unit) -> Unit,
    onDelete: (Place) -> Unit,
) {
    var editing by remember { mutableStateOf<String?>(null) }
    PanelBody("Kayıtlı yerler", onClose) {
        Button(onClick = onStartPlacing) { Text("+ Yeni yer (haritada nokta seç)") }
        if (places.isEmpty()) Muted("Henüz kayıtlı yer yok. Sık gittiğin yerleri haritaya işaretle.")
        places.forEach { p ->
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Row(
                Modifier.fillMaxWidth().clickable { onFocus(p) }.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(14.dp).clip(CircleShape).background(parseHexColor(p.color)))
                Text(p.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 12.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Button(onClick = { onNavigate(p) }, enabled = !busy) { Text("Yola çık") }
                TextButton(onClick = { editing = if (editing == p.id) null else p.id }) {
                    Text(if (editing == p.id) "Vazgeç" else "Düzenle")
                }
                TextButton(onClick = { onDelete(p) }) { Text("Sil", color = MaterialTheme.colorScheme.error) }
            }
            if (editing == p.id) {
                var name by remember(p.id) { mutableStateOf(p.name) }
                var color by remember(p.id) { mutableStateOf(p.color) }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Ad") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Renk", style = MaterialTheme.typography.labelLarge)
                ColorChoices(color) { color = it }
                Button(onClick = { onSave(p, name, color) { editing = null } }, enabled = !busy) { Text("Kaydet") }
            }
        }
    }
}

private fun meetingEta(m: MeetingMember): String = when {
    m.locationOff -> "konum paylaşımı kapalı"
    m.etaMinutes == null -> "konum bilinmiyor"
    m.arrived -> "buluşma noktasında"
    else -> {
        val d = m.distanceMeters ?: 0.0
        val dist = if (d >= 1000) String.format(java.util.Locale.US, "%.1f km", d / 1000) else "${d.roundToInt()} m"
        "~${m.etaMinutes} dk · $dist"
    }
}

/** web components/MeetingsPanel.jsx */
@Composable
fun MeetingsPanel(
    meetings: List<Meeting>,
    expandedId: String?,
    detail: MeetingDetail?,
    busy: Boolean,
    onClose: () -> Unit,
    onStartPlacing: () -> Unit,
    onFocus: (Meeting) -> Unit,
    onExpand: (String?) -> Unit,
    onDelete: (Meeting) -> Unit,
    onLeave: (Meeting) -> Unit,
) {
    PanelBody("Buluşmalar", onClose) {
        Button(onClick = onStartPlacing) { Text("+ Yeni buluşma (haritada nokta seç)") }
        if (meetings.isEmpty()) {
            Muted("Henüz buluşma yok. Bir nokta seçip kişileri davet et; herkesin oraya varış süresini birlikte görün.")
        }
        meetings.forEach { mt ->
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Text(mt.label, style = MaterialTheme.typography.titleMedium)
            Muted("${mt.memberCount} kişi" + if (mt.isOwner) " · sahibisin" else "")
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { onFocus(mt) }) { Text("Haritada gör") }
                TextButton(onClick = { onExpand(if (expandedId == mt.id) null else mt.id) }) {
                    Text(if (expandedId == mt.id) "Gizle" else "Detay")
                }
                if (mt.isOwner) {
                    TextButton(onClick = { onDelete(mt) }, enabled = !busy) { Text("Sil", color = MaterialTheme.colorScheme.error) }
                } else {
                    TextButton(onClick = { onLeave(mt) }, enabled = !busy) { Text("Ayrıl", color = MaterialTheme.colorScheme.error) }
                }
            }
            if (expandedId == mt.id) {
                if (detail == null || detail.meeting.id != mt.id) {
                    Muted("Yükleniyor…")
                } else {
                    detail.members.forEach { m ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 8.dp)) {
                            Avatar(m.displayName, m.avatarColor, size = 36.dp, imagePath = m.avatarPath)
                            Column(Modifier.padding(start = 8.dp)) {
                                Text(m.displayName + if (m.isOwner) " (sahip)" else "", style = MaterialTheme.typography.titleMedium)
                                Muted(meetingEta(m))
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Invitee checkboxes for a new meeting: family first, then friends. */
@Composable
fun InviteePicker(candidates: Candidates, selected: Set<String>, onChange: (Set<String>) -> Unit) {
    val family = candidates.family
    if (family != null && family.members.isNotEmpty()) {
        Text("${family.name} (aile)", style = MaterialTheme.typography.labelLarge)
        family.members.forEach { m -> CheckRow(m.displayName, m.id in selected) { onChange(selected.toggle(m.id, it)) } }
    }
    val famIds = family?.members.orEmpty().map(CandidatePerson::id).toSet()
    val friends = candidates.friends.filter { it.id !in famIds }
    if (friends.isNotEmpty()) {
        Text("Arkadaşlar", style = MaterialTheme.typography.labelLarge)
        friends.forEach { f -> CheckRow(f.displayName, f.id in selected) { onChange(selected.toggle(f.id, it)) } }
    }
    if (candidates.friends.isEmpty() && family?.members.isNullOrEmpty()) {
        Muted("Davet edebileceğin arkadaş ya da aile üyen yok.")
    }
}
