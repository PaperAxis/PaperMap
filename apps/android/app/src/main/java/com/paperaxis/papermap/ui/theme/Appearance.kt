// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.theme

import android.content.Context
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import com.paperaxis.papermap.data.AppJson
import com.paperaxis.papermap.ui.common.parseHexColor
import kotlinx.serialization.Serializable

/** Stored theme value for "follow the device"; the web resolves it to the PaperAxis light theme. */
const val SYSTEM_THEME = "system"
const val BRAND_THEME = "paperaxis"
const val BRAND_DARK_THEME = "paperaxis-koyu"

@Serializable
data class ThemeColors(
    val bg: String,
    val surface: String,
    val surface2: String,
    val border: String,
    val muted: String,
    val fg: String,
    val brand: String,
    val brandFg: String,
    val danger: String,
    val dangerFg: String,
    val warn: String,
    val ok: String,
    val inputBorder: String,
    val brandHover: String,
)

@Serializable
data class ThemeDef(
    val id: String,
    val label: String,
    val category: String,
    val scheme: String,
    val colors: ThemeColors,
) {
    val dark: Boolean get() = scheme == "dark"
}

@Serializable
data class ThemeCategory(val key: String, val label: String)

/**
 * The web theme catalog (web/src/lib/appearance/themes.js), exported to
 * assets/themes.json by tools/gen-themes.mjs so ids, labels and the measured
 * contrast-safe colours match exactly.
 */
@Serializable
data class ThemeCatalog(
    val categories: List<ThemeCategory> = emptyList(),
    val themes: List<ThemeDef> = emptyList(),
    val aliases: Map<String, String> = emptyMap(),
) {
    private val byId by lazy { themes.associateBy { it.id } }

    fun find(id: String?): ThemeDef? = id?.let { byId[it] ?: aliases[it]?.let(byId::get) }

    /** Resolves a stored value; null, "" and "system" follow [systemDark]. */
    fun resolve(id: String?, systemDark: Boolean): ThemeDef? {
        if (id.isNullOrBlank() || id == SYSTEM_THEME) return byId[if (systemDark) BRAND_DARK_THEME else BRAND_THEME]
        return find(id) ?: byId[BRAND_THEME]
    }

    fun inCategory(key: String): List<ThemeDef> = themes.filter { it.category == key }

    companion object {
        @Volatile
        private var cached: ThemeCatalog? = null

        fun get(context: Context): ThemeCatalog = cached ?: synchronized(this) {
            cached ?: runCatching {
                context.assets.open("themes.json").bufferedReader().use {
                    AppJson.decodeFromString(serializer(), it.readText())
                }
            }.getOrDefault(ThemeCatalog()).also { cached = it }
        }
    }
}

fun ThemeDef.colorScheme(): ColorScheme {
    val c = colors
    fun hex(v: String): Color = parseHexColor(v)
    return if (dark) {
        darkColorScheme(
            primary = hex(c.brand),
            onPrimary = hex(c.brandFg),
            primaryContainer = hex(c.surface),
            onPrimaryContainer = hex(c.fg),
            secondary = hex(c.fg),
            onSecondary = hex(c.bg),
            secondaryContainer = hex(c.surface),
            onSecondaryContainer = hex(c.fg),
            background = hex(c.bg),
            onBackground = hex(c.fg),
            surface = hex(c.bg),
            onSurface = hex(c.fg),
            surfaceVariant = hex(c.surface),
            onSurfaceVariant = hex(c.muted),
            surfaceContainer = hex(c.surface),
            surfaceContainerLow = hex(c.surface),
            surfaceContainerLowest = hex(c.bg),
            surfaceContainerHigh = hex(c.surface2),
            surfaceContainerHighest = hex(c.surface2),
            outline = hex(c.inputBorder),
            outlineVariant = hex(c.border),
            error = hex(c.danger),
            onError = hex(c.dangerFg),
        )
    } else {
        lightColorScheme(
            primary = hex(c.brand),
            onPrimary = hex(c.brandFg),
            primaryContainer = hex(c.surface2),
            onPrimaryContainer = hex(c.fg),
            secondary = hex(c.fg),
            onSecondary = hex(c.bg),
            secondaryContainer = hex(c.surface2),
            onSecondaryContainer = hex(c.fg),
            background = hex(c.bg),
            onBackground = hex(c.fg),
            surface = hex(c.bg),
            onSurface = hex(c.fg),
            surfaceVariant = hex(c.surface2),
            onSurfaceVariant = hex(c.muted),
            surfaceContainer = hex(c.surface2),
            surfaceContainerLow = hex(c.surface),
            surfaceContainerLowest = hex(c.surface),
            surfaceContainerHigh = hex(c.surface2),
            surfaceContainerHighest = hex(c.surface2),
            outline = hex(c.inputBorder),
            outlineVariant = hex(c.border),
            error = hex(c.danger),
            onError = hex(c.dangerFg),
        )
    }
}

/** Font catalog; ids and order match web/src/lib/appearance/fonts.js. */
data class FontOption(val id: String, val label: String, val category: String)

val FONT_CATEGORIES = listOf(
    "okunabilirlik" to "Okunabilirlik",
    "sans" to "Sans-serif",
    "serif" to "Serif",
    "mono" to "Monospace",
)

val FONTS = listOf(
    FontOption("lexend", "Lexend (disleksi dostu)", "okunabilirlik"),
    FontOption("atkinson", "Atkinson Hyperlegible", "okunabilirlik"),
    FontOption("inter", "Inter ve Manrope (varsayılan)", "sans"),
    FontOption("sistem", "Sistem", "sans"),
    FontOption("roboto", "Roboto", "sans"),
    FontOption("open-sans", "Open Sans", "sans"),
    FontOption("lato", "Lato", "sans"),
    FontOption("montserrat", "Montserrat", "sans"),
    FontOption("poppins", "Poppins", "sans"),
    FontOption("nunito", "Nunito", "sans"),
    FontOption("work-sans", "Work Sans", "sans"),
    FontOption("rubik", "Rubik", "sans"),
    FontOption("dm-sans", "DM Sans", "sans"),
    FontOption("manrope", "Manrope", "sans"),
    FontOption("mulish", "Mulish", "sans"),
    FontOption("karla", "Karla", "sans"),
    FontOption("merriweather", "Merriweather", "serif"),
    FontOption("lora", "Lora", "serif"),
    FontOption("pt-serif", "PT Serif", "serif"),
    FontOption("roboto-slab", "Roboto Slab", "serif"),
    FontOption("bitter", "Bitter", "serif"),
    FontOption("eb-garamond", "EB Garamond", "serif"),
    FontOption("playfair", "Playfair Display", "serif"),
    FontOption("jetbrains-mono", "JetBrains Mono", "mono"),
    FontOption("ibm-plex-mono", "IBM Plex Mono", "mono"),
)

const val DEFAULT_FONT = "inter"

fun resolveFontId(value: String?): String =
    if (value != null && FONTS.any { it.id == value }) value else DEFAULT_FONT

/**
 * The app bundles no web fonts, so a choice is applied by its family:
 * serif and monospace picks switch to the platform serif / monospace face.
 */
fun fontFamilyFor(id: String?): FontFamily = when (FONTS.firstOrNull { it.id == resolveFontId(id) }?.category) {
    "serif" -> FontFamily.Serif
    "mono" -> FontFamily.Monospace
    else -> FontFamily.Default
}

/** Icon styles (web lib/iconStyles.js); stored with the profile. */
val ICON_STYLES = listOf(
    "normal" to "Normal",
    "thin" to "İnce",
    "bold" to "Kalın",
    "sharp" to "Keskin",
)
