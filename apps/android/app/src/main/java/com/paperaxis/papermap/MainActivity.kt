// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.paperaxis.papermap.notify.Notifier
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.PaperMapRoot
import com.paperaxis.papermap.ui.theme.PaperMapTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PaperMapTheme {
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

    // Tapping a system notification opens the notifications page; SSO returns land here too.
    private fun handleOpen(intent: Intent?) {
        val i = intent ?: return
        // SSO return: papermap://sso?code=… (docs/SSO.md)
        val data = i.data
        if (i.action == Intent.ACTION_VIEW && data != null && data.scheme == "papermap" && data.host == "sso") {
            i.data = null
            vm.handleSsoReturn(data)
            return
        }
        if (i.getStringExtra(Notifier.EXTRA_OPEN) == Notifier.OPEN_NOTIFICATIONS) {
            i.removeExtra(Notifier.EXTRA_OPEN)
            vm.openNotifications()
        }
    }
}
