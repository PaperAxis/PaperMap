// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.notify.Notifier
import com.paperaxis.papermap.ui.admin.AdminScreen
import com.paperaxis.papermap.ui.auth.AuthScreen
import com.paperaxis.papermap.ui.auth.ForgotPasswordScreen
import com.paperaxis.papermap.ui.auth.ResetPasswordScreen
import com.paperaxis.papermap.ui.auth.VerifyEmailScreen
import com.paperaxis.papermap.ui.chat.ChatScreen
import com.paperaxis.papermap.ui.chat.ConversationsScreen
import com.paperaxis.papermap.ui.family.FamilyScreen
import com.paperaxis.papermap.ui.friends.FriendsScreen
import com.paperaxis.papermap.ui.map.MapScreen
import com.paperaxis.papermap.ui.map.MapViewModel
import com.paperaxis.papermap.ui.map.SosBanner
import com.paperaxis.papermap.ui.notifications.NotificationsScreen
import com.paperaxis.papermap.ui.profile.ProfileScreen
import com.paperaxis.papermap.ui.profile.UserProfileScreen

private data class Tab(val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("Harita", Icons.Filled.LocationOn),
    Tab("Sohbet", Icons.Filled.Email),
    Tab("Arkadaşlar", Icons.Filled.Face),
    Tab("Aile", Icons.Filled.Home),
    Tab("Profil", Icons.Filled.AccountCircle),
)

@Composable
fun PaperMapRoot(vm: AppViewModel) {
    val session by vm.session.collectAsStateWithLifecycle()
    val message by vm.message.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val update by vm.update.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val openUrl by vm.openUrl.collectAsStateWithLifecycle()
    val authLink by vm.authLink.collectAsStateWithLifecycle()
    val appSettings by vm.appSettings.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // SSO start: hand the server URL to the browser; it returns via papermap://sso.
    LaunchedEffect(openUrl) {
        val url = openUrl ?: return@LaunchedEffect
        vm.consumeOpenUrl()
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (e: ActivityNotFoundException) {
            vm.showMessage("Tarayıcı bulunamadı.")
        }
    }

    LaunchedEffect(message) {
        message?.let {
            snackbar.showSnackbar(it)
            vm.clearMessage()
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { outer ->
        Box(Modifier.fillMaxSize().padding(bottom = outer.calculateBottomPadding())) {
            when (val s = session) {
                SessionState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                SessionState.SignedOut -> {
                    var forgot by rememberSaveable { mutableStateOf(false) }
                    LaunchedEffect(Unit) {
                        vm.refreshSsoProviders()
                        vm.refreshAppSettings()
                    }
                    if (forgot) {
                        ForgotPasswordScreen(
                            settings = appSettings,
                            onSubmit = vm::forgotPassword,
                            onBack = { forgot = false },
                        )
                    } else {
                        AuthScreen(
                            busy = busy,
                            initialLogin = vm.rememberedLogin.collectAsState().value,
                            ssoProviders = vm.ssoProviders.collectAsState().value,
                            onLogin = vm::login,
                            onRegister = vm::register,
                            onSso = vm::startSsoLogin,
                            settings = appSettings,
                            onForgot = { forgot = true },
                        )
                    }
                }
                is SessionState.SignedIn -> SignedInShell(vm, s.user)
            }
            // Account e-mail links open above everything, signed in or not.
            when (val link = authLink) {
                is AuthLink.Reset -> ResetPasswordScreen(
                    settings = appSettings,
                    token = link.token,
                    onSubmit = vm::resetPassword,
                    onClose = vm::closeAuthLink,
                )
                is AuthLink.Verify -> VerifyEmailScreen(
                    settings = appSettings,
                    token = link.token,
                    signedIn = session is SessionState.SignedIn,
                    onVerify = vm::verifyEmail,
                    onClose = vm::closeAuthLink,
                )
                null -> Unit
            }
        }
    }

    update?.let { release ->
        AlertDialog(
            onDismissRequest = vm::dismissUpdate,
            title = { Text("PaperMap ${release.version} hazır") },
            text = { Text("Yeni sürümü indirip kurmak ister misin? Kurulumu Android onaylamanı isteyecek.") },
            confirmButton = { TextButton(onClick = vm::installUpdate) { Text("İndir ve kur") } },
            dismissButton = { TextButton(onClick = vm::dismissUpdate) { Text("Sonra") } },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignedInShell(vm: AppViewModel, user: User) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val conversations by vm.conversations.collectAsStateWithLifecycle()
    val openChat by vm.openChat.collectAsStateWithLifecycle()
    val showNotifications by vm.showNotifications.collectAsStateWithLifecycle()
    val overlay by vm.overlay.collectAsStateWithLifecycle()
    val mapFocus by vm.mapFocus.collectAsStateWithLifecycle()
    val connected by vm.socketConnected.collectAsStateWithLifecycle()
    val mapVm: MapViewModel = viewModel()
    val sos by mapVm.sos.collectAsStateWithLifecycle()
    var offline by remember { mutableStateOf(false) }

    // A chat place message asks for the map tab.
    LaunchedEffect(mapFocus) { if (mapFocus != null) tab = 0 }
    // Grace period so a reconnect or a cold start does not flash the banner.
    LaunchedEffect(connected) {
        if (connected) {
            offline = false
        } else {
            delay(4_000)
            offline = true
        }
    }
    val chatUnread = conversations.sumOf { it.unread }
    val context = LocalContext.current

    // Ask once per launch for the notification permission (Android 13+).
    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 && !Notifier.canPost(context)) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    // Full-screen pages above the tabs.
    openChat?.let { chat ->
        ChatScreen(vm, chat)
        return
    }
    if (showNotifications) {
        NotificationsScreen(vm)
        return
    }
    when (val page = overlay) {
        Overlay.Admin -> {
            AdminScreen(vm)
            return
        }
        is Overlay.UserProfile -> {
            UserProfileScreen(vm, page.userId)
            return
        }
        null -> Unit
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { index, t ->
                    NavigationBarItem(
                        selected = tab == index,
                        onClick = { tab = index },
                        icon = {
                            if (index == 1 && chatUnread > 0) {
                                BadgedBox(badge = { Badge { Text(if (chatUnread > 99) "99+" else chatUnread.toString()) } }) {
                                    Icon(t.icon, contentDescription = null)
                                }
                            } else {
                                Icon(t.icon, contentDescription = null)
                            }
                        },
                        label = { Text(t.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(bottom = padding.calculateBottomPadding())) {
            when (tab) {
                0 -> MapScreen(vm, user, mapVm)
                1 -> ConversationsScreen(vm)
                2 -> FriendsScreen(vm)
                3 -> FamilyScreen(vm)
                else -> ProfileScreen(vm, user)
            }
            // The map shows SOS calls in its own banner column; other tabs get it on top.
            val alert = sos
            if (alert != null && tab != 0) {
                Box(Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(8.dp)) {
                    SosBanner(
                        alert,
                        onShow = { if (alert.lat != null && alert.lng != null) vm.focusOnMap(alert.lat, alert.lng) },
                        onClose = mapVm::dismissSos,
                    )
                }
            }
            if (offline) OfflineBanner(Modifier.align(Alignment.BottomCenter))
        }
    }
}

/** web components/OfflineBanner.jsx: shown while the server socket is unreachable. */
@Composable
private fun OfflineBanner(modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.inverseSurface,
        contentColor = MaterialTheme.colorScheme.inverseOnSurface,
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(
            "Çevrimdışısın — internet bağlantısı bekleniyor…",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}
