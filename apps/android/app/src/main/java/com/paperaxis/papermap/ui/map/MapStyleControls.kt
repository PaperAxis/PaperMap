// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.paperaxis.papermap.ui.common.AppIcon
import com.paperaxis.papermap.ui.common.Lucide

/**
 * Map styles the user can pick; ids match web/src/lib/mapStyle.js MAP_STYLES.
 * Every concrete style is bundled as apps/shared/map-style-<id>.json.
 */
enum class MapStyleChoice(
    val id: String,
    val label: String,
    val bg: Color,
    val water: Color,
    val road: Color,
) {
    Auto("auto", "Otomatik", Color(0xFFEEF0F2), Color(0xFF10131C), Color(0xFF9AA3B5)),
    Light("light", "Açık", Color(0xFFEEF0F2), Color(0xFFA9C9E8), Color(0xFFFFFFFF)),
    Dark("dark", "Koyu", Color(0xFF10131C), Color(0xFF0F1D2F), Color(0xFF3B4150)),
    Terrain("terrain", "Arazi", Color(0xFFF3EFE4), Color(0xFF94C0E6), Color(0xFFB3D19F)),
    Night("night", "Gece", Color(0xFF07090E), Color(0xFF08121F), Color(0xFFE8A33D)),
    Satellite("satellite", "Uydu", Color(0xFF4A5A3A), Color(0xFF1F4060), Color(0xB3FFFFFF)),
    ;

    /** Style file to draw; "auto" follows the app theme. */
    fun variant(darkTheme: Boolean): String = when (this) {
        Auto -> if (darkTheme) "dark" else "light"
        else -> id
    }

    companion object {
        fun fromId(id: String?): MapStyleChoice = entries.firstOrNull { it.id == id } ?: Auto
    }
}

/** Overlay labels (people, places) need light text on these styles. */
fun isDarkVariant(variant: String): Boolean = variant == "dark" || variant == "night" || variant == "satellite"

private const val PREFS = "papermap_map"
private const val KEY_STYLE = "mapStyle"

fun loadMapStyleChoice(context: Context): MapStyleChoice =
    MapStyleChoice.fromId(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STYLE, null))

fun saveMapStyleChoice(context: Context, choice: MapStyleChoice) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STYLE, choice.id).apply()
}

/** Bottom-left button that opens the 3x2 map style grid. */
@Composable
fun MapStylePicker(selected: MapStyleChoice, onSelect: (MapStyleChoice) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        SmallFloatingActionButton(onClick = { open = true }) {
            AppIcon(Lucide.Map, contentDescription = "Harita stili")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                "HARİTA STİLİ",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 14.dp, top = 4.dp, bottom = 6.dp),
            )
            MapStyleChoice.entries.chunked(3).forEach { row ->
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    row.forEach { choice ->
                        StyleOption(choice, choice == selected) {
                            open = false
                            onSelect(choice)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StyleOption(choice: MapStyleChoice, active: Boolean, onClick: () -> Unit) {
    val accent = MaterialTheme.colorScheme.primary
    val shape = RoundedCornerShape(10.dp)
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(72.dp)
            .clip(shape)
            .then(if (active) Modifier.border(BorderStroke(1.5.dp, accent), shape) else Modifier)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .padding(vertical = 6.dp),
    ) {
        StyleSwatch(choice, if (active) accent else MaterialTheme.colorScheme.outlineVariant)
        Text(
            choice.label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = if (active) accent else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/** Tiny map impression: ground, a strip of water and a diagonal road. */
@Composable
private fun StyleSwatch(choice: MapStyleChoice, border: Color) {
    val shape = RoundedCornerShape(7.dp)
    Canvas(
        modifier = Modifier
            .size(width = 48.dp, height = 34.dp)
            .clip(shape)
            .border(1.dp, border, shape),
    ) {
        if (choice == MapStyleChoice.Auto) {
            drawRect(choice.bg, size = size.copy(width = size.width / 2))
            drawRect(choice.water, topLeft = Offset(size.width / 2, 0f), size = size.copy(width = size.width / 2))
        } else {
            drawRect(choice.bg)
            if (choice == MapStyleChoice.Terrain) {
                drawCircle(choice.road, radius = size.height * 0.42f, center = Offset(size.width * 0.3f, size.height * 0.75f))
                drawCircle(Color(0xFF8A7356), radius = size.height * 0.16f, center = Offset(size.width * 0.72f, size.height * 0.35f))
            }
            if (choice == MapStyleChoice.Satellite) {
                drawCircle(Color(0xFF6D7F4E), radius = size.height * 0.3f, center = Offset(size.width * 0.25f, size.height * 0.3f))
                drawCircle(Color(0xFF8C7A5B), radius = size.height * 0.34f, center = Offset(size.width * 0.75f, size.height * 0.65f))
            }
            drawRect(choice.water, topLeft = Offset(0f, size.height * 0.74f), size = size.copy(height = size.height * 0.26f))
        }
        if (choice != MapStyleChoice.Terrain) {
            drawLine(
                choice.road,
                start = Offset(size.width * 0.35f, size.height),
                end = Offset(size.width * 0.65f, 0f),
                strokeWidth = size.width * 0.09f,
            )
        }
    }
}

/** Camera tilt (degrees) the 3D button switches to; the map's tilt gesture goes up to 60. */
const val TILT_3D = 55.0

/**
 * 3D / 2D toggle next to the compass. The map can also be tilted with two
 * fingers dragged up/down together and rotated with a two-finger twist; this
 * button makes the perspective discoverable and reachable with one tap.
 */
@Composable
fun TiltButton(tilt: Double, onClick: () -> Unit) {
    val active = tilt > 5.0
    SmallFloatingActionButton(
        onClick = onClick,
        modifier = Modifier.semantics {
            contentDescription = if (active) "2B görünüme geç" else "3B görünüme geç"
        },
    ) {
        Text(
            if (active) "3D" else "2D",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.ExtraBold,
            color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/**
 * Compass next to the style picker: the needle points north as the map turns.
 * Tapping it turns the map back to north-up and flat (as on the web).
 */
@Composable
fun CompassButton(bearing: Double, onClick: () -> Unit) {
    val north = Color(0xFFE5484D)
    val south = MaterialTheme.colorScheme.onSurfaceVariant
    SmallFloatingActionButton(
        onClick = onClick,
        modifier = Modifier.semantics { contentDescription = "Pusula: kuzeye döndür" },
    ) {
        Canvas(modifier = Modifier.size(22.dp).rotate(-bearing.toFloat())) {
            val cx = size.width / 2
            val cy = size.height / 2
            val half = size.width * 0.2f
            val top = Path().apply {
                moveTo(cx, 0f)
                lineTo(cx + half, cy)
                lineTo(cx - half, cy)
                close()
            }
            val bottom = Path().apply {
                moveTo(cx, size.height)
                lineTo(cx + half, cy)
                lineTo(cx - half, cy)
                close()
            }
            drawPath(top, north)
            drawPath(bottom, south)
        }
    }
}
