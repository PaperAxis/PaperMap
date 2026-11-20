// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
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
    }
}
