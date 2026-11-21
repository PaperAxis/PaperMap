// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.common

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import com.paperaxis.papermap.R
import com.paperaxis.papermap.ui.common.AppIcon
import com.paperaxis.papermap.ui.common.Lucide

/** Password input with a show / hide toggle (web components/PasswordInput.jsx). */
@Composable
fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    supportingText: String? = null,
    imeAction: ImeAction = ImeAction.Done,
) {
    var show by rememberSaveable { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = { show = !show }) {
                AppIcon(
                    if (show) Lucide.EyeOff else Lucide.Eye,
                    contentDescription = if (show) "Şifreyi gizle" else "Şifreyi göster",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        supportingText = supportingText?.let { { Text(it) } },
        modifier = modifier,
    )
}
