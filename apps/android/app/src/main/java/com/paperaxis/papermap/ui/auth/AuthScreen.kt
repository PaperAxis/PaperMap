// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.paperaxis.papermap.R
import com.paperaxis.papermap.ui.theme.Pa

@Composable
fun AuthScreen(
    busy: Boolean,
    initialLogin: String,
    onLogin: (login: String, password: String, remember: Boolean) -> Unit,
    onRegister: (email: String, username: String, displayName: String, password: String) -> Unit,
) {
    var registering by rememberSaveable { mutableStateOf(false) }
    var login by rememberSaveable(initialLogin) { mutableStateOf(initialLogin) }
    var rememberMe by rememberSaveable { mutableStateOf(true) }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf("") }
    var displayName by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var localError by rememberSaveable { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Adaptive mipmaps cannot be drawn by painterResource; use the foreground on ink.
        Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = null,
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Pa.Ink),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (registering) "Hesap oluştur" else "PaperMap'e giriş yap",
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(
            "Aile ve arkadaşlarınla karşılıklı konum paylaşımı.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))

        if (registering) {
            OutlinedTextField(
                value = displayName, onValueChange = { displayName = it },
                label = { Text("Görünen ad") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = username, onValueChange = { username = it },
                label = { Text("Kullanıcı adı") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = email, onValueChange = { email = it },
                label = { Text("E-posta") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            OutlinedTextField(
                value = login, onValueChange = { login = it },
                label = { Text("E-posta ya da kullanıcı adı") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Şifre") }, singleLine = true,
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                IconButton(onClick = { showPassword = !showPassword }) {
                    Icon(
                        painter = painterResource(if (showPassword) R.drawable.ic_eye_off else R.drawable.ic_eye),
                        contentDescription = if (showPassword) "Şifreyi gizle" else "Şifreyi göster",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            supportingText = { if (registering) Text("En az 8 karakter") },
            modifier = Modifier.fillMaxWidth(),
        )
        if (!registering) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .toggleable(value = rememberMe, role = Role.Checkbox, onValueChange = { rememberMe = it }),
            ) {
                Checkbox(checked = rememberMe, onCheckedChange = null)
                Spacer(Modifier.size(8.dp))
                Text("Beni hatırla", style = MaterialTheme.typography.bodyLarge)
            }
        }
        localError?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Button(
            onClick = {
                localError = null
                if (registering) {
                    when {
                        displayName.isBlank() || username.isBlank() || email.isBlank() ->
                            localError = "Tüm alanları doldur"
                        password.length < 8 -> localError = "Şifre en az 8 karakter olmalı"
                        else -> onRegister(email, username, displayName, password)
                    }
                } else {
                    if (login.isBlank() || password.isBlank()) localError = "Giriş bilgilerini gir"
                    else onLogin(login, password, rememberMe)
                }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().height(48.dp),
        ) {
            if (busy) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text(if (registering) "Hesap oluştur" else "Giriş yap")
            }
        }
        TextButton(onClick = { registering = !registering; localError = null }) {
            Text(if (registering) "Hesabın var mı? Giriş yap" else "Hesabın yok mu? Kayıt ol")
        }
        Spacer(Modifier.height(24.dp))
        Text(
            "Bir PaperAxis ürünüdür.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
