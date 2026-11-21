// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.paperaxis.papermap.notify.Notifier
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.PaperMapRoot
import com.paperaxis.papermap.ui.theme.LocalDarkTheme
import com.paperaxis.papermap.ui.theme.PaperMapTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val appearance by vm.appearance.collectAsState()
            PaperMapTheme(themeId = appearance.theme, fontId = appearance.font, iconStyle = appearance.iconStyle) {
                // Status / navigation bar icons follow the in-app theme, not only the device.
                val dark = LocalDarkTheme.current
                LaunchedEffect(dark) {
                    val transparent = android.graphics.Color.TRANSPARENT
                    val style = if (dark) {
                        SystemBarStyle.dark(transparent)
                    } else {
                        SystemBarStyle.light(transparent, transparent)
                    }
                    enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                }
                PaperMapRoot(vm)
            }
        }
        handleOpen(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOpen(intent)
    }

    // Tapping a system notification opens the notifications page; SSO returns and
    // account e-mail links land here too.
    private fun handleOpen(intent: Intent?) {
        val i = intent ?: return
        // SSO return: papermap://sso?code=… (docs/SSO.md)
        val data = i.data
        if (i.action == Intent.ACTION_VIEW && data != null && data.scheme == "papermap" && data.host == "sso") {
            i.data = null
            vm.handleSsoReturn(data)
            return
        }
        // Account e-mail links: …/reset/<token>, …/verify/<token> (https or papermap://).
        if (i.action == Intent.ACTION_VIEW && data != null && vm.handleAccountLink(data)) {
            i.data = null
            return
        }
        if (i.getStringExtra(Notifier.EXTRA_OPEN) == Notifier.OPEN_NOTIFICATIONS) {
            i.removeExtra(Notifier.EXTRA_OPEN)
            vm.openNotifications()
        }
    }
}
