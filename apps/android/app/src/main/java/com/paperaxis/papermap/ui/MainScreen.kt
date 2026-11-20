// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.notify.Notifier
import com.paperaxis.papermap.ui.auth.AuthScreen
import com.paperaxis.papermap.ui.chat.ChatScreen
import com.paperaxis.papermap.ui.chat.ConversationsScreen
import com.paperaxis.papermap.ui.family.FamilyScreen
import com.paperaxis.papermap.ui.friends.FriendsScreen
import com.paperaxis.papermap.ui.map.MapScreen
import com.paperaxis.papermap.ui.notifications.NotificationsScreen
import com.paperaxis.papermap.ui.profile.ProfileScreen

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
                SessionState.SignedOut -> AuthScreen(
                    busy = busy,
                    initialLogin = vm.rememberedLogin.collectAsState().value,
                    onLogin = vm::login,
                    onRegister = vm::register,
                )
                is SessionState.SignedIn -> SignedInShell(vm, s.user)
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
                0 -> MapScreen(vm, user)
                1 -> ConversationsScreen(vm)
                2 -> FriendsScreen(vm)
                3 -> FamilyScreen(vm)
                else -> ProfileScreen(vm, user)
            }
        }
    }
}
