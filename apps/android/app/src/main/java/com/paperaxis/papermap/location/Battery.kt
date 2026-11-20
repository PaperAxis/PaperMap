// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.location

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager

data class BatteryState(val level: Int?, val charging: Boolean?)

fun readBattery(context: Context): BatteryState {
    val intent: Intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        ?: return BatteryState(null, null)
    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else null
    val charging = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING, BatteryManager.BATTERY_STATUS_FULL -> true
        -1 -> null
        else -> false
    }
    return BatteryState(pct, charging)
}
