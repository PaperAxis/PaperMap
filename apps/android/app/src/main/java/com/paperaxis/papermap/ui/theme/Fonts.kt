// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.theme

import androidx.compose.ui.text.font.DeviceFontFamilyName
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import com.paperaxis.papermap.R

private val FULL = listOf(400, 500, 600, 700)
private val RG_BD = listOf(400, 700)

/**
 * Font catalog; ids, labels and order match web/src/lib/appearance/fonts.js.
 * [family] is the Google Fonts family (null = the platform font), [weights] the
 * static weights Google Fonts serves for it, and [display] the headline family
 * when it differs from the body (the default pairs Inter with Manrope).
 */
data class FontOption(
    val id: String,
    val label: String,
    val category: String,
    val family: String? = null,
    val weights: List<Int> = FULL,
    val display: String? = null,
)

val FONT_CATEGORIES = listOf(
    "okunabilirlik" to "Okunabilirlik",
    "sans" to "Sans-serif",
    "serif" to "Serif",
    "mono" to "Monospace",
)

val FONTS = listOf(
    FontOption("lexend", "Lexend (disleksi dostu)", "okunabilirlik", "Lexend"),
    FontOption("atkinson", "Atkinson Hyperlegible", "okunabilirlik", "Atkinson Hyperlegible", RG_BD),
    FontOption("inter", "Inter ve Manrope (varsayılan)", "sans", "Inter", display = "Manrope"),
    FontOption("sistem", "Sistem", "sans"),
    FontOption("roboto", "Roboto", "sans", "Roboto"),
    FontOption("open-sans", "Open Sans", "sans", "Open Sans"),
    FontOption("lato", "Lato", "sans", "Lato", RG_BD),
    FontOption("montserrat", "Montserrat", "sans", "Montserrat"),
    FontOption("poppins", "Poppins", "sans", "Poppins"),
    FontOption("nunito", "Nunito", "sans", "Nunito"),
    FontOption("work-sans", "Work Sans", "sans", "Work Sans"),
    FontOption("rubik", "Rubik", "sans", "Rubik"),
    FontOption("dm-sans", "DM Sans", "sans", "DM Sans"),
    FontOption("manrope", "Manrope", "sans", "Manrope"),
    FontOption("mulish", "Mulish", "sans", "Mulish"),
    FontOption("karla", "Karla", "sans", "Karla"),
    FontOption("merriweather", "Merriweather", "serif", "Merriweather"),
    FontOption("lora", "Lora", "serif", "Lora"),
    FontOption("pt-serif", "PT Serif", "serif", "PT Serif", RG_BD),
    FontOption("roboto-slab", "Roboto Slab", "serif", "Roboto Slab"),
    FontOption("bitter", "Bitter", "serif", "Bitter"),
    FontOption("eb-garamond", "EB Garamond", "serif", "EB Garamond"),
    FontOption("playfair", "Playfair Display", "serif", "Playfair Display"),
    FontOption("jetbrains-mono", "JetBrains Mono", "mono", "JetBrains Mono"),
    FontOption("ibm-plex-mono", "IBM Plex Mono", "mono", "IBM Plex Mono"),
)

const val DEFAULT_FONT = "inter"

private val FONT_BY_ID = FONTS.associateBy { it.id }

/** Unknown and legacy values ("default", "") resolve to the default font, as on the web. */
fun resolveFontId(value: String?): String = if (value != null && value in FONT_BY_ID) value else DEFAULT_FONT

fun fontOption(id: String?): FontOption = FONT_BY_ID.getValue(resolveFontId(id))

/** Body and headline families for a font choice. */
data class FontPair(val body: FontFamily, val display: FontFamily)

/**
 * Downloadable fonts through Google Play services: the provider caches fonts
 * device-wide, so a family is fetched once and shared with other apps.
 */
private val googleFontsProvider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs,
)

private fun genericFamilyName(category: String): String = when (category) {
    "serif" -> "serif"
    "mono" -> "monospace"
    else -> "sans-serif"
}

/**
 * The Google font at each of its weights, followed by the platform face of the
 * same category at the same weights. Compose shows the platform face while the
 * download runs and keeps it when the provider is missing (no Play services)
 * or the request fails.
 */
private fun googleFamily(name: String, weights: List<Int>, category: String): FontFamily {
    val font = GoogleFont(name)
    val generic = DeviceFontFamilyName(genericFamilyName(category))
    val fonts = weights.map { Font(googleFont = font, fontProvider = googleFontsProvider, weight = FontWeight(it)) } +
        weights.map { Font(familyName = generic, weight = FontWeight(it)) }
    return FontFamily(fonts)
}

private fun platformFamily(category: String): FontFamily = when (category) {
    "serif" -> FontFamily.Serif
    "mono" -> FontFamily.Monospace
    else -> FontFamily.Default
}

/** Built once per id so recompositions reuse the same (already loaded) families. */
private val FONT_PAIRS: Map<String, FontPair> = FONTS.associate { f ->
    val body = f.family?.let { googleFamily(it, f.weights, f.category) } ?: platformFamily(f.category)
    val display = f.display?.let { googleFamily(it, FULL, f.category) } ?: body
    f.id to FontPair(body, display)
}

fun fontPairFor(id: String?): FontPair = FONT_PAIRS.getValue(resolveFontId(id))

/** Body family of a font choice (picker previews). */
fun fontFamilyFor(id: String?): FontFamily = fontPairFor(id).body
