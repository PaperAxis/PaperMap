// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.auth

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.paperaxis.papermap.R
import com.paperaxis.papermap.data.AppSettings
import com.paperaxis.papermap.ui.common.PasswordField
import com.paperaxis.papermap.ui.common.uploadUrl
import com.paperaxis.papermap.ui.theme.Pa

/** Server logo (Admin > Logo) or the app icon, then the app name (web components/Brand.jsx). */
@Composable
fun BrandHeader(settings: AppSettings) {
    val logo = uploadUrl(settings.logoPath)
    if (logo != null) {
        AsyncImage(
            model = logo,
            contentDescription = settings.appName,
            modifier = Modifier.heightIn(max = 64.dp),
        )
    } else {
        // Adaptive mipmaps cannot be drawn by painterResource; use the foreground on ink.
        Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = null,
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Pa.Ink),
        )
    }
    Spacer(Modifier.height(8.dp))
    Text(settings.appName, style = MaterialTheme.typography.headlineMedium)
}

@Composable
private fun AuthPage(settings: AppSettings, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            BrandHeader(settings)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

/** Success message box (web .badge). */
@Composable
fun NoticeBox(text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)) {
        Text(text, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(16.dp))
    }
}

@Composable
private fun SubmitButton(label: String, busyLabel: String, busy: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !busy && enabled,
        modifier = Modifier.fillMaxWidth().height(48.dp),
    ) {
        if (busy) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.size(8.dp))
            Text(busyLabel)
        } else {
            Text(label)
        }
    }
}

/** web pages/Forgot.jsx */
@Composable
fun ForgotPasswordScreen(
    settings: AppSettings,
    onSubmit: (email: String, onResult: (String?) -> Unit) -> Unit,
    onBack: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var sent by rememberSaveable { mutableStateOf(false) }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(onBack = onBack)

    AuthPage(settings, "Şifre sıfırlama") {
        if (sent) {
            NoticeBox("E-posta adresin kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.")
        } else {
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("E-posta") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            SubmitButton("Sıfırlama bağlantısı gönder", "Gönderiliyor…", busy, enabled = email.isNotBlank()) {
                error = null
                busy = true
                onSubmit(email.trim()) { err ->
                    busy = false
                    if (err == null) sent = true else error = err
                }
            }
        }
        TextButton(onClick = onBack) { Text("Girişe dön") }
    }
}

/** web pages/ResetPassword.jsx; opened from https://…/reset/<token> or papermap://reset/<token>. */
@Composable
fun ResetPasswordScreen(
    settings: AppSettings,
    token: String,
    onSubmit: (token: String, password: String, onResult: (String?) -> Unit) -> Unit,
    onClose: () -> Unit,
) {
    var password by rememberSaveable { mutableStateOf("") }
    var done by rememberSaveable { mutableStateOf(false) }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(onBack = onClose)

    AuthPage(settings, "Yeni şifre belirle") {
        if (done) {
            NoticeBox("Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.")
            Button(onClick = onClose, modifier = Modifier.fillMaxWidth().height(48.dp)) { Text("Girişe git") }
        } else {
            PasswordField(
                value = password,
                onValueChange = { password = it },
                label = "Yeni şifre (en az 8 karakter)",
                modifier = Modifier.fillMaxWidth(),
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            SubmitButton("Şifreyi güncelle", "Kaydediliyor…", busy) {
                if (password.length < 8) {
                    error = "Yeni şifre en az 8 karakter olmalı"
                    return@SubmitButton
                }
                error = null
                busy = true
                onSubmit(token, password) { err ->
                    busy = false
                    if (err == null) done = true else error = err
                }
            }
            TextButton(onClick = onClose) { Text("Girişe dön") }
        }
    }
}

/** web pages/VerifyEmail.jsx; opened from https://…/verify/<token> or papermap://verify/<token>. */
@Composable
fun VerifyEmailScreen(
    settings: AppSettings,
    token: String,
    signedIn: Boolean,
    onVerify: (token: String, onResult: (String?) -> Unit) -> Unit,
    onClose: () -> Unit,
) {
    // null: still verifying, "" : verified, otherwise the error.
    var result by rememberSaveable(token) { mutableStateOf<String?>(null) }
    BackHandler(onBack = onClose)
    LaunchedEffect(token) {
        if (result == null) onVerify(token) { err -> result = err ?: "" }
    }

    AuthPage(settings, "E-posta doğrulama") {
        when (val r = result) {
            null -> Text("Doğrulanıyor…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            "" -> NoticeBox("E-posta adresin doğrulandı. Teşekkürler!")
            else -> Text(r, color = MaterialTheme.colorScheme.error)
        }
        TextButton(onClick = onClose) { Text(if (signedIn) "Uygulamaya dön" else "Girişe dön") }
    }
}
