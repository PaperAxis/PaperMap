// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap

import android.app.Application
import android.location.Location
import com.paperaxis.papermap.data.ApiClient
import com.paperaxis.papermap.data.SessionStore
import com.paperaxis.papermap.realtime.RealtimeClient
import kotlinx.coroutines.flow.MutableStateFlow
import org.maplibre.android.MapLibre

class PaperMapApp : Application() {
    lateinit var session: SessionStore
        private set
    lateinit var api: ApiClient
        private set
    lateinit var realtime: RealtimeClient
        private set

    /** Latest own location, written by the map screen and the location service. */
    val myLocation = MutableStateFlow<Location?>(null)

    override fun onCreate() {
        super.onCreate()
        instance = this
        MapLibre.getInstance(this)
        session = SessionStore(this)
        api = ApiClient(session)
        realtime = RealtimeClient(BuildConfig.API_BASE)
    }

    companion object {
        lateinit var instance: PaperMapApp
            private set
    }
}
