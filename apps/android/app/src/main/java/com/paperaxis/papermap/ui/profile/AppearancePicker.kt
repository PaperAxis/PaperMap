// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.paperaxis.papermap.ui.common.AppIcon
import com.paperaxis.papermap.ui.common.IconStyle
import com.paperaxis.papermap.ui.common.Lucide
import com.paperaxis.papermap.ui.common.parseHexColor
import com.paperaxis.papermap.ui.common.vector
import com.paperaxis.papermap.ui.theme.FONTS
import com.paperaxis.papermap.ui.theme.FONT_CATEGORIES
import com.paperaxis.papermap.ui.theme.SYSTEM_THEME
import com.paperaxis.papermap.ui.theme.ThemeCatalog
import com.paperaxis.papermap.ui.theme.ThemeDef
import com.paperaxis.papermap.ui.theme.fontFamilyFor
import com.paperaxis.papermap.ui.theme.resolveFontId

/** Category folders of the web theme catalog, plus "follow the device" (web components/ThemePicker.jsx). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ThemePicker(value: String?, onSelect: (String) -> Unit) {
    val context = LocalContext.current
    val catalog = remember { ThemeCatalog.get(context) }
    val followsSystem = value.isNullOrBlank() || value == SYSTEM_THEME
    val current = if (followsSystem) null else catalog.find(value)
    var open by rememberSaveable { mutableStateOf(current?.category ?: "paperaxis") }

    Column(Modifier.fillMaxWidth()) {
        Text(
            "Seçili: " + (current?.label ?: "Cihaz teması"),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FilterChip(
            selected = followsSystem,
            onClick = { onSelect(SYSTEM_THEME) },
            label = { Text("Cihaz temasını izle") },
            modifier = Modifier.padding(top = 4.dp),
        )
        catalog.categories.forEach { cat ->
            val themes = catalog.inCategory(cat.key)
            if (themes.isEmpty()) return@forEach
            val expanded = open == cat.key
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { open = if (expanded) "" else cat.key }
                    .padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(cat.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Text(
                    themes.size.toString(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                AppIcon(
                    if (expanded) Lucide.ChevronDown else Lucide.ChevronRight,
                    contentDescription = null,
                )
            }
            if (expanded) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 8.dp),
                ) {
                    themes.forEach { t ->
                        ThemeSwatch(t, selected = t.id == current?.id, wide = cat.key == "paperaxis") { onSelect(t.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ThemeSwatch(theme: ThemeDef, selected: Boolean, wide: Boolean, onClick: () -> Unit) {
    val c = theme.colors
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .then(if (wide) Modifier.width(150.dp) else Modifier.size(48.dp))
            .clip(shape)
            .background(parseHexColor(c.bg))
            .border(
                width = if (selected) 3.dp else 1.dp,
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                shape = shape,
            )
            .clickable(onClick = onClick)
            .semantics { contentDescription = theme.label }
            .padding(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(parseHexColor(c.surface)),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(parseHexColor(c.brand)))
            }
            if (wide) {
                Text(
                    theme.label,
                    color = parseHexColor(c.fg),
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }
        if (selected) {
            AppIcon(
                Lucide.Check,
                contentDescription = null,
                tint = parseHexColor(c.brand),
                modifier = Modifier.size(14.dp).align(Alignment.TopEnd),
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FontPicker(value: String?, onSelect: (String) -> Unit) {
    val current = resolveFontId(value)
    Column(Modifier.fillMaxWidth()) {
        FONT_CATEGORIES.forEach { (key, label) ->
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FONTS.filter { it.category == key }.forEach { f ->
                    FilterChip(
                        selected = f.id == current,
                        onClick = { onSelect(f.id) },
                        label = {
                            Text(f.label, fontFamily = fontFamilyFor(f.id))
                        },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IconStylePicker(value: String?, onSelect: (String) -> Unit) {
    val current = IconStyle.from(value)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        IconStyle.entries.forEach { style ->
            FilterChip(
                selected = style == current,
                onClick = { onSelect(style.id) },
                leadingIcon = {
                    // Each chip previews its own stroke, whatever style is active.
                    Icon(Lucide.Star.vector(style), contentDescription = null)
                },
                label = { Text(style.label) },
            )
        }
    }
}
