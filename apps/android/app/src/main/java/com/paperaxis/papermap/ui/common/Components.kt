// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.paperaxis.papermap.BuildConfig
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Absolute URL of a server upload ("/uploads/…"), or null. */
fun uploadUrl(path: String?): String? = if (path.isNullOrBlank()) null else BuildConfig.API_BASE + path

private val trLocale: Locale = Locale.forLanguageTag("tr")

/** "12 Kas 14:05" (web: toLocaleString tr-TR, day numeric, month short). */
fun shortDateTime(iso: String?): String {
    val t = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
    return DateTimeFormatter.ofPattern("d MMM HH:mm", trLocale).withZone(ZoneId.systemDefault()).format(t)
}

/** "Pil %85" / "Pil %85 (şarjda)" (web lib/battery.js). */
fun batteryLabel(battery: Int?, charging: Boolean?): String =
    if (battery == null) "" else "Pil %$battery" + if (charging == true) " (şarjda)" else ""

/** Parses "#RRGGBB" into a color; falls back to Axis Blue. */
fun parseHexColor(hex: String?, fallback: Color = Color(0xFF315BDB)): Color {
    val clean = hex?.removePrefix("#") ?: return fallback
    val value = clean.toLongOrNull(16) ?: return fallback
    return when (clean.length) {
        6 -> Color(0xFF000000 or value)
        8 -> Color(value)
        else -> fallback
    }
}

fun initials(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return when {
        parts.isEmpty() -> "?"
        parts.size == 1 -> parts[0].take(1).uppercase()
        else -> (parts[0].take(1) + parts[1].take(1)).uppercase()
    }
}

/** "az önce", "5 dk önce", "2 sa önce", "3 gün önce". */
fun relativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val then = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
    val mins = Duration.between(then, Instant.now()).toMinutes()
    return when {
        mins < 1 -> "az önce"
        mins < 60 -> "$mins dk önce"
        mins < 60 * 24 -> "${mins / 60} sa önce"
        else -> "${mins / (60 * 24)} gün önce"
    }
}

/** Profile photo when [imagePath] is set, otherwise initials on the avatar colour. */
@Composable
fun Avatar(name: String, color: String?, size: Dp = 40.dp, imagePath: String? = null) {
    val bg = parseHexColor(color)
    Box(
        modifier = Modifier.size(size).clip(CircleShape).background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            initials(name),
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            fontSize = (size.value * 0.38f).sp,
        )
        val url = uploadUrl(imagePath)
        if (url != null) {
            // Drawn over the initials; a failed load leaves the initials visible.
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(size).clip(CircleShape),
            )
        }
    }
}

@Composable
fun PersonRow(
    name: String,
    subtitle: String?,
    color: String?,
    modifier: Modifier = Modifier,
    avatarPath: String? = null,
    trailing: @Composable () -> Unit = {},
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(name, color, imagePath = avatarPath)
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(name, style = MaterialTheme.typography.titleMedium)
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        trailing()
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text.uppercase(java.util.Locale.forLanguageTag("tr")),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 6.dp),
    )
}

@Composable
fun EmptyState(title: String, body: String) {
    Column(modifier = Modifier.fillMaxWidth().padding(24.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
