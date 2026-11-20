// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// PaperAxis design tokens (apps/README.md).
object Pa {
    val Paper = Color(0xFFF5F3EE)
    val Ink = Color(0xFF171918)
    val Soft = Color(0xFFE6E4DE)
    val Blue = Color(0xFF315BDB)
    val BlueLight = Color(0xFF7A9BF0)
    val Graphite = Color(0xFF666963)
    val GraphiteLight = Color(0xFF9A9D96)
    val InkSurface = Color(0xFF232625)
    val InkBorder = Color(0xFF3A3E3C)
    val BorderStrong = Color(0xFFC9C6BD)
    val Danger = Color(0xFFB3261E)
    val DangerDark = Color(0xFFF0736B)
    val Success = Color(0xFF4F6A44)
}

private val Light = lightColorScheme(
    primary = Pa.Blue,
    onPrimary = Color.White,
    primaryContainer = Pa.Soft,
    onPrimaryContainer = Pa.Ink,
    secondary = Pa.Ink,
    onSecondary = Pa.Paper,
    secondaryContainer = Pa.Soft,
    onSecondaryContainer = Pa.Ink,
    background = Pa.Paper,
    onBackground = Pa.Ink,
    surface = Pa.Paper,
    onSurface = Pa.Ink,
    surfaceVariant = Pa.Soft,
    onSurfaceVariant = Pa.Graphite,
    surfaceContainer = Pa.Soft,
    surfaceContainerLow = Color.White,
    surfaceContainerHigh = Pa.Soft,
    outline = Color(0xFF7E817A),
    outlineVariant = Pa.BorderStrong,
    error = Pa.Danger,
    onError = Color.White,
)

private val Dark = darkColorScheme(
    primary = Pa.BlueLight,
    onPrimary = Pa.Ink,
    primaryContainer = Pa.InkSurface,
    onPrimaryContainer = Pa.Paper,
    secondary = Pa.Paper,
    onSecondary = Pa.Ink,
    secondaryContainer = Pa.InkSurface,
    onSecondaryContainer = Pa.Paper,
    background = Pa.Ink,
    onBackground = Pa.Paper,
    surface = Pa.Ink,
    onSurface = Pa.Paper,
    surfaceVariant = Pa.InkSurface,
    onSurfaceVariant = Pa.GraphiteLight,
    surfaceContainer = Pa.InkSurface,
    surfaceContainerLow = Pa.InkSurface,
    surfaceContainerHigh = Color(0xFF2D3130),
    outline = Color(0xFF7E817A),
    outlineVariant = Pa.InkBorder,
    error = Pa.DangerDark,
    onError = Pa.Ink,
)

private val PaTypography = Typography(
    headlineMedium = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp),
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.8.sp),
)

private val PaShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(20.dp),
)

@Composable
fun PaperMapTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (dark) Dark else Light,
        typography = PaTypography,
        shapes = PaShapes,
        content = content,
    )
}
