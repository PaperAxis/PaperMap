// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.profile

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.paperaxis.papermap.BuildConfig
import com.paperaxis.papermap.data.IdentitiesResponse
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.AppIcon
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.Lucide
import com.paperaxis.papermap.ui.common.PasswordField
import com.paperaxis.papermap.ui.common.SectionLabel
import com.paperaxis.papermap.ui.common.parseHexColor
import com.paperaxis.papermap.ui.common.shortDateTime
import com.paperaxis.papermap.ui.common.uploadUrl
import java.time.Year

private val STATUS_PRESETS = listOf("Evdeyim", "Yoldayım", "İşteyim", "Müsait değilim")

private val AVATAR_COLORS = listOf(
    "#315bdb", "#171918", "#4f6a44", "#b3261e", "#7c3aed", "#2563eb",
    "#059669", "#dc2626", "#ea580c", "#0891b2", "#db2777", "#ca8a04",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(vm: AppViewModel, user: User) {
    val busy by vm.busy.collectAsStateWithLifecycle()
    val ssoProviders by vm.ssoProviders.collectAsStateWithLifecycle()
    val identities by vm.identities.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        vm.refreshSsoProviders()
        vm.refreshIdentities()
        vm.refreshPrivacy()
        vm.refreshShareLinks()
    }
    var confirmLogout by remember { mutableStateOf(false) }

    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.uploadAvatar(uri)
    }
    val bannerPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.uploadBanner(uri)
    }
    val imagesOnly = PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)

    Scaffold(topBar = { TopAppBar(title = { Text("Profil") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()),
        ) {
            if (user.isAdmin) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { vm.openAdmin() }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AppIcon(Lucide.Wrench, contentDescription = null)
                    Text(
                        "Yönetim paneli",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f).padding(start = 12.dp),
                    )
                    AppIcon(Lucide.ChevronRight, contentDescription = null)
                }
            }

            ProfileBanner(user.bannerPath) {
                Avatar(user.displayName, user.avatarColor, size = 72.dp, imagePath = user.avatarPath)
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(onClick = { bannerPicker.launch(imagesOnly) }, enabled = !busy) { Text("Banner yükle") }
                if (user.bannerPath != null) {
                    OutlinedButton(onClick = vm::removeBanner, enabled = !busy) { Text("Kaldır") }
                }
            }
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(user.displayName, style = MaterialTheme.typography.headlineSmall)
                user.username?.let { Text("@$it", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                user.email?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (!user.emailVerified && !user.email.isNullOrBlank()) {
                ProfileCard("E-posta doğrulama") {
                    Text(
                        "E-posta adresin (${user.email}) henüz doğrulanmadı. Doğrulama bağlantısını e-postandan onayla.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Button(onClick = vm::resendVerification, enabled = !busy) {
                        Text("Doğrulama e-postası gönder")
                    }
                }
            }

            ProfileInfoCard(
                user = user,
                busy = busy,
                onPickPhoto = { avatarPicker.launch(imagesOnly) },
                onRemovePhoto = vm::removeAvatar,
                onSave = vm::saveProfileInfo,
            )

            StatusCard(user.statusText.orEmpty(), onSave = vm::saveStatus)

            ProfileCard("Görünüm") {
                FieldLabel("Tema")
                ThemePicker(user.theme) { vm.changeAppearance(theme = it) }
                FieldLabel("Yazı tipi")
                FontPicker(user.fontPref) { vm.changeAppearance(font = it) }
                FieldLabel("İkon stili")
                IconStylePicker(user.iconStyle) { vm.changeAppearance(iconStyle = it) }
            }

            SectionLabel("Gizlilik")
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Konum paylaşımı", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (user.sharingEnabled) "Açık" else "Kapalı",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = user.sharingEnabled, onCheckedChange = { vm.setSharing(it) }, enabled = !busy)
            }

            PrivacyCard(vm)
            ShareLinksCard(vm, busy)

            if (ssoProviders.isNotEmpty() || identities?.identities?.isNotEmpty() == true) {
                SectionLabel("Bağlı hesaplar")
                LinkedAccounts(
                    providers = ssoProviders,
                    identities = identities,
                    hasPassword = identities?.hasPassword ?: user.hasPassword,
                    busy = busy,
                    onLink = vm::linkProvider,
                    onUnlink = vm::unlinkProvider,
                )
            }

            PasswordCard(hasPassword = user.hasPassword, busy = busy, onSubmit = vm::changePassword)

            SectionLabel("Hesap")
            TextButton(onClick = { confirmLogout = true }, modifier = Modifier.padding(horizontal = 8.dp)) {
                Text("Oturumu kapat", color = MaterialTheme.colorScheme.error)
            }

            HorizontalDivider(
                modifier = Modifier.padding(top = 24.dp),
                color = MaterialTheme.colorScheme.outlineVariant,
            )
            About()
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Oturumu kapat") },
            text = { Text("Oturum kapanınca konum paylaşımı da durur.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmLogout = false
                    vm.signOut()
                }) { Text("Kapat", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Vazgeç") } },
        )
    }
}

/** Banner image (or a plain band) with the avatar over its lower edge; shared with user profiles. */
@Composable
fun ProfileBanner(bannerPath: String?, avatar: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth().height(176.dp)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(140.dp)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            val url = uploadUrl(bannerPath)
            if (url != null) {
                AsyncImage(
                    model = url,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Box(
            Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp)
                .clip(CircleShape)
                .border(3.dp, MaterialTheme.colorScheme.background, CircleShape),
        ) {
            avatar()
        }
    }
}

@Composable
private fun ProfileCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            content()
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ProfileInfoCard(
    user: User,
    busy: Boolean,
    onPickPhoto: () -> Unit,
    onRemovePhoto: () -> Unit,
    onSave: (displayName: String, username: String, avatarColor: String?) -> Unit,
) {
    var displayName by remember(user.displayName) { mutableStateOf(user.displayName) }
    var username by remember(user.username) { mutableStateOf(user.username.orEmpty()) }
    var color by remember(user.avatarColor) { mutableStateOf(user.avatarColor ?: "#315bdb") }

    ProfileCard("Profil bilgileri") {
        FieldLabel("Profil fotoğrafı")
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Avatar(user.displayName, user.avatarColor, size = 56.dp, imagePath = user.avatarPath)
            OutlinedButton(onClick = onPickPhoto, enabled = !busy) { Text("Fotoğraf yükle") }
            if (user.avatarPath != null) {
                OutlinedButton(onClick = onRemovePhoto, enabled = !busy) { Text("Kaldır") }
            }
        }
        OutlinedTextField(
            value = displayName,
            onValueChange = { displayName = it },
            label = { Text("Görünen ad") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = username,
            onValueChange = { username = it.lowercase() },
            label = { Text("Kullanıcı adı") },
            singleLine = true,
            supportingText = { Text("Arkadaşların seni @$username ile bulur.") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            modifier = Modifier.fillMaxWidth(),
        )
        if (user.avatarPath == null) {
            FieldLabel("Avatar rengi")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AVATAR_COLORS.forEach { hex ->
                    val selected = hex.equals(color, ignoreCase = true)
                    Box(
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(parseHexColor(hex))
                            .border(
                                if (selected) 3.dp else 0.dp,
                                MaterialTheme.colorScheme.onBackground,
                                CircleShape,
                            )
                            .clickable { color = hex }
                            .semantics { contentDescription = "Renk $hex" },
                    )
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = color,
                    onValueChange = { color = it.trim().take(7) },
                    label = { Text("Renk kodu") },
                    singleLine = true,
                    modifier = Modifier.width(160.dp),
                )
                Spacer(Modifier.width(12.dp))
                Avatar(displayName, color, size = 36.dp)
            }
        }
        Button(
            onClick = { onSave(displayName, username, if (user.avatarPath == null) color else null) },
            enabled = !busy,
        ) { Text("Kaydet") }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StatusCard(current: String, onSave: (String) -> Unit) {
    var text by remember(current) { mutableStateOf(current) }
    ProfileCard("Durum") {
        Text(
            "Arkadaşların ve aile üyelerin durumunu haritada ve kişi listesinde görür.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            STATUS_PRESETS.forEach { preset ->
                FilterChip(selected = current == preset, onClick = { onSave(preset) }, label = { Text(preset) })
            }
        }
        OutlinedTextField(
            value = text,
            onValueChange = { text = it.take(60) },
            label = { Text("Özel durum") },
            placeholder = { Text("Örn. Tatildeyim") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { onSave("") }) { Text("Temizle") }
            Button(onClick = { onSave(text.trim()) }) { Text("Kaydet") }
        }
    }
}

@Composable
private fun PrivacyCard(vm: AppViewModel) {
    val people by vm.privacyPeople.collectAsStateWithLifecycle()
    ProfileCard("Konum gizliliği") {
        Text(
            "İşareti kaldırdığın kişiler konumunu haritada göremez.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (people.isEmpty()) {
            Text("Henüz arkadaşın ya da aile üyen yok.", style = MaterialTheme.typography.bodyMedium)
        }
        people.forEach { p ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Avatar(p.displayName, p.avatarColor, imagePath = p.avatarPath)
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(p.displayName, style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (p.hidden) "Konumunu göremez" else "Konumunu görebilir",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(checked = !p.hidden, onCheckedChange = { vm.setHidden(p.id, !it) })
            }
        }
    }
}

@Composable
private fun ShareLinksCard(vm: AppViewModel, busy: Boolean) {
    val links by vm.shareLinks.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    ProfileCard("Geçici konum bağlantısı") {
        Text(
            "Uygulaması olmayan birine, süreli bir bağlantıyla canlı konumunu gösterebilirsin. " +
                "Süre dolunca bağlantı kendiliğinden geçersizleşir.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            listOf(60 to "1 saat", 8 * 60 to "8 saat", 24 * 60 to "24 saat").forEach { (minutes, label) ->
                Button(onClick = { vm.createShareLink(minutes) }, enabled = !busy, modifier = Modifier.weight(1f)) {
                    Text(label)
                }
            }
        }
        links.forEach { link ->
            val url = vm.shareLinkUrl(link)
            Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Text("Bağlantı", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Bitiş: ${shortDateTime(link.expiresAt)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = {
                        clipboard.setText(AnnotatedString(url))
                        vm.showMessage("Bağlantı panoya kopyalandı.")
                    }) { Text("Kopyala") }
                    TextButton(onClick = {
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, url)
                        }
                        context.startActivity(Intent.createChooser(send, "Konum bağlantısını paylaş"))
                    }) { Text("Paylaş") }
                    TextButton(onClick = { vm.revokeShareLink(link.id) }) {
                        Text("İptal", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

@Composable
private fun PasswordCard(
    hasPassword: Boolean,
    busy: Boolean,
    onSubmit: (current: String, new: String, onDone: () -> Unit) -> Unit,
) {
    var current by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    ProfileCard(if (hasPassword) "Şifre değiştir" else "Şifre belirle") {
        if (!hasPassword) {
            Text(
                "Hesabını Google ya da PaperApp ile açtın. Şifre belirlersen kullanıcı adınla da giriş yapabilirsin.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            PasswordField(current, { current = it }, "Mevcut şifre", Modifier.fillMaxWidth())
        }
        PasswordField(new, { new = it }, "Yeni şifre (en az 8 karakter)", Modifier.fillMaxWidth())
        Button(
            onClick = {
                onSubmit(current, new) {
                    current = ""
                    new = ""
                }
            },
            enabled = !busy && new.isNotEmpty(),
        ) { Text(if (hasPassword) "Şifreyi değiştir" else "Şifreyi belirle") }
    }
}

private fun providerName(provider: String): String = when (provider) {
    "google" -> "Google"
    "paperapp" -> "PaperApp"
    else -> provider
}

/** Google / PaperApp rows: state, then Bağla or Kaldır. */
@Composable
private fun LinkedAccounts(
    providers: List<String>,
    identities: IdentitiesResponse?,
    hasPassword: Boolean,
    busy: Boolean,
    onLink: (String) -> Unit,
    onUnlink: (String) -> Unit,
) {
    val linked = identities?.identities.orEmpty()
    // Configured providers first, then any linked one the server no longer offers.
    val rows = (providers + linked.map { it.provider }).distinct()
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        rows.forEach { provider ->
            val identity = linked.firstOrNull { it.provider == provider }
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(providerName(provider), style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (identity != null) "Bağlı" + (identity.email?.let { ": $it" } ?: "") else "Bağlı değil",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (identity != null) {
                    TextButton(onClick = { onUnlink(provider) }, enabled = !busy) {
                        Text("Kaldır", color = MaterialTheme.colorScheme.error)
                    }
                } else if (provider in providers) {
                    OutlinedButton(onClick = { onLink(provider) }, enabled = !busy) { Text("Bağla") }
                }
            }
        }
        if (!hasPassword) {
            Text(
                "Hesabının şifresi yok; bağlı son hesabı kaldıramazsın. Aşağıdan bir şifre belirleyebilirsin.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun About() {
    val year = Year.now().value
    val copyright = if (year > 2026) "© 2026–$year PaperAxis" else "© 2026 PaperAxis"
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
        Text("PaperMap", style = MaterialTheme.typography.titleMedium)
        Text(
            "Sürüm ${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.bodyMedium,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Text("Bir PaperAxis ürünüdür.", style = MaterialTheme.typography.bodyMedium)
        Text(
            "$copyright. Tüm hakları saklıdır.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "info@paperaxis.com",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
