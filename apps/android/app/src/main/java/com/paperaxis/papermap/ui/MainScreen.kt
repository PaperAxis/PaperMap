// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.ui.auth.AuthScreen
import com.paperaxis.papermap.ui.family.FamilyScreen
import com.paperaxis.papermap.ui.friends.FriendsScreen
import com.paperaxis.papermap.ui.map.MapScreen
import com.paperaxis.papermap.ui.profile.ProfileScreen

private data class Tab(val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("Harita", Icons.Filled.LocationOn),
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

@Composable
private fun SignedInShell(vm: AppViewModel, user: User) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { index, t ->
                    NavigationBarItem(
                        selected = tab == index,
                        onClick = { tab = index },
                        icon = { Icon(t.icon, contentDescription = null) },
                        label = { Text(t.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(bottom = padding.calculateBottomPadding())) {
            when (tab) {
                0 -> MapScreen(vm, user)
                1 -> FriendsScreen(vm)
                2 -> FamilyScreen(vm)
                else -> ProfileScreen(vm, user)
            }
        }
    }
}
