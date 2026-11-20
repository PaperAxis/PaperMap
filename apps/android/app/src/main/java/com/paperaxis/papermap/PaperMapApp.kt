// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap

import android.app.Activity
import android.app.Application
import android.location.Location
import android.os.Bundle
import com.google.firebase.messaging.FirebaseMessaging
import com.paperaxis.papermap.data.ApiClient
import com.paperaxis.papermap.data.SessionStore
import com.paperaxis.papermap.notify.Notifier
import com.paperaxis.papermap.realtime.RealtimeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import org.maplibre.android.MapLibre

class PaperMapApp : Application() {
    lateinit var session: SessionStore
        private set
    lateinit var api: ApiClient
        private set
    lateinit var realtime: RealtimeClient
        private set

    /** Lives as long as the process; owns work that must outlast screens. */
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    /** Latest own location, written by the map screen and the location service. */
    val myLocation = MutableStateFlow<Location?>(null)

    private var startedActivities = 0

    /** True while any activity is visible. */
    val isForeground: Boolean get() = startedActivities > 0

    /** Set by the notifications screen while it is shown. */
    @Volatile
    var notificationsScreenVisible = false

    /** True once an FCM token was registered with the server. */
    @Volatile
    var pushActive = false
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        MapLibre.getInstance(this)
        session = SessionStore(this)
        api = ApiClient(session)
        realtime = RealtimeClient(BuildConfig.API_BASE)
        Notifier.ensureChannel(this)
        trackForeground()

        // The socket lives here, not in a screen, so notifications keep arriving
        // while the location service holds the process in the background.
        appScope.launch {
            realtime.notifications.collect { n ->
                val onScreen = isForeground && notificationsScreenVisible
                // In the background FCM (when configured) shows the same push itself.
                val fcmCovers = !isForeground && pushActive
                if (!onScreen && !fcmCovers) Notifier.show(this@PaperMapApp, n.id, n.title, n.body)
            }
        }
    }

    private fun trackForeground() {
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) {
                startedActivities++
            }

            override fun onActivityStopped(activity: Activity) {
                startedActivities = (startedActivities - 1).coerceAtLeast(0)
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }

    /** Fetches the FCM token and registers it; silently skipped without Firebase config. */
    fun registerPush() {
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) registerPushToken(token)
            }
        } catch (_: Exception) {
            // No google-services.json in this build: FirebaseApp is not initialised.
        }
    }

    fun registerPushToken(token: String) {
        appScope.launch {
            if (session.token() == null) return@launch
            runCatching { api.registerPushToken(token) }.onSuccess { pushActive = true }
        }
    }

    fun onSignedOut() {
        pushActive = false
    }

    companion object {
        lateinit var instance: PaperMapApp
            private set
    }
}
