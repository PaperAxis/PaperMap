// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.common

import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp
import java.util.concurrent.ConcurrentHashMap

/** A Lucide icon: 24x24 viewport stroke paths, drawn in the profile's [IconStyle]. */
class LucideIcon(val name: String, vararg val paths: String)

/**
 * Icon styles; ids, names and strokes match web/src/lib/iconStyles.js (Lucide at
 * a 1.5 stroke by default, "sharp" with miter joins and square caps).
 */
enum class IconStyle(
    val id: String,
    val label: String,
    val strokeWidth: Float,
    val cap: StrokeCap = StrokeCap.Round,
    val join: StrokeJoin = StrokeJoin.Round,
) {
    Normal("normal", "Normal", 1.5f),
    Thin("thin", "İnce", 1.15f),
    Bold("bold", "Kalın", 2.25f),
    Sharp("sharp", "Keskin", 1.5f, StrokeCap.Square, StrokeJoin.Miter),
    ;

    companion object {
        fun from(id: String?): IconStyle = entries.firstOrNull { it.id == id } ?: Normal
    }
}

/** The profile icon style; provided by PaperMapTheme, so a new pick redraws every icon at once. */
val LocalIconStyle = staticCompositionLocalOf { IconStyle.Normal }

private val vectors = ConcurrentHashMap<Pair<String, IconStyle>, ImageVector>()

/** The icon rebuilt with the style's stroke; built once per icon and style. */
fun LucideIcon.vector(style: IconStyle): ImageVector = vectors.computeIfAbsent(name to style) {
    ImageVector.Builder(
        name = "Lucide.$name.${style.id}",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply {
        paths.forEach { d ->
            addPath(
                pathData = addPathNodes(d),
                fill = null,
                // Icon() tints it with the content colour.
                stroke = SolidColor(Color.Black),
                strokeLineWidth = style.strokeWidth,
                strokeLineCap = style.cap,
                strokeLineJoin = style.join,
                strokeLineMiter = 4f,
            )
        }
    }.build()
}

/** The icon in the current profile style. */
val LucideIcon.styled: ImageVector
    @Composable
    @ReadOnlyComposable
    get() = vector(LocalIconStyle.current)

/** Material [Icon] for a Lucide icon in the profile's icon style; every app icon goes through this. */
@Composable
fun AppIcon(
    icon: LucideIcon,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
) {
    Icon(icon.styled, contentDescription, modifier, tint)
}
