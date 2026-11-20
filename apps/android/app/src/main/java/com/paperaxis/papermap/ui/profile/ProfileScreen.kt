// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.profile

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.BuildConfig
import com.paperaxis.papermap.data.IdentitiesResponse
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.SectionLabel
import java.time.Year

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(vm: AppViewModel, user: User) {
    val busy by vm.busy.collectAsStateWithLifecycle()
    val ssoProviders by vm.ssoProviders.collectAsStateWithLifecycle()
    val identities by vm.identities.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) {
        vm.refreshSsoProviders()
        vm.refreshIdentities()
    }
    var name by remember(user.displayName) { mutableStateOf(user.displayName) }
    var confirmLogout by remember { mutableStateOf(false) }

    Scaffold(topBar = { TopAppBar(title = { Text("Profil") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(user.displayName, user.avatarColor, size = 64.dp)
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(user.displayName, style = MaterialTheme.typography.headlineSmall)
                    user.username?.let {
                        Text("@$it", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    user.email?.let {
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            SectionLabel("Görünen ad")
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedButton(
                    onClick = { vm.updateDisplayName(name) },
                    enabled = !busy && name.isNotBlank() && name.trim() != user.displayName,
                    modifier = Modifier.padding(start = 8.dp),
                ) { Text("Kaydet") }
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
                "Hesabının şifresi yok; bağlı son hesabı kaldıramazsın. Şifre belirlemek için web'de " +
                    "\"Şifreni mi unuttun?\" bağlantısını kullan.",
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
