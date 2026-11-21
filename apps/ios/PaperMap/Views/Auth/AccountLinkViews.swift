// Copyright (c) 2026 PaperAxis. All rights reserved.
// Forgot password, reset password and e-mail verification (web: Forgot.jsx,
// ResetPassword.jsx, VerifyEmail.jsx).

import SwiftUI

/// App logo (admin-uploaded logo when set) and app name.
struct BrandHeader: View {
    @EnvironmentObject private var branding: Branding
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let url = Config.uploadURL(branding.settings.logoPath) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        Image("LaunchLogo").resizable().scaledToFit()
                    }
                }
                .frame(height: 72)
                .accessibilityHidden(true)
            } else {
                Image("LaunchLogo")
                    .resizable()
                    .frame(width: 72, height: 72)
                    .accessibilityHidden(true)
            }
            Text(branding.appName)
                .paFont(.largeTitle, weight: .bold)
                .foregroundColor(Pa.text)
            if let subtitle {
                Text(subtitle).foregroundColor(Pa.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Success / info message: icon + text.
struct InfoText: View {
    let message: String
    var body: some View {
        Label(message, symbol: "checkmark.circle")
            .paFont(.subheadline)
            .foregroundColor(Pa.text)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ForgotPasswordView: View {
    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var sent = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BrandHeader(subtitle: "Şifre sıfırlama")
                if sent {
                    InfoText(message: "E-posta adresin kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.")
                    Button("Girişe dön") { dismiss() }
                        .buttonStyle(PaSecondaryButtonStyle())
                } else {
                    LabeledField(label: "E-posta", text: $email, contentType: .emailAddress, keyboard: .emailAddress)
                    if let error { ErrorText(message: error) }
                    Button {
                        Task { await submit() }
                    } label: {
                        if busy { ProgressView().tint(Pa.onPrimary) } else { Text("Sıfırlama bağlantısı gönder") }
                    }
                    .buttonStyle(PaPrimaryButtonStyle())
                    .disabled(busy || !email.contains("@"))
                }
            }
            .padding(24)
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationTitle("Şifremi unuttum")
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await session.requestPasswordReset(email: email)
            error = nil
            sent = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct ResetPasswordView: View {
    let token: String

    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @State private var newPassword = ""
    @State private var done = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BrandHeader(subtitle: "Yeni şifre belirle")
                    if done {
                        InfoText(message: "Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.")
                        Button(session.isSignedIn ? "Tamam" : "Girişe git") { dismiss() }
                            .buttonStyle(PaPrimaryButtonStyle())
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            LabeledField(label: "Yeni şifre", text: $newPassword, secure: true, contentType: .newPassword)
                            Text("En az 8 karakter.").paFont(.caption).foregroundColor(Pa.muted)
                        }
                        if let error { ErrorText(message: error) }
                        Button {
                            Task { await submit() }
                        } label: {
                            if busy { ProgressView().tint(Pa.onPrimary) } else { Text("Şifreyi güncelle") }
                        }
                        .buttonStyle(PaPrimaryButtonStyle())
                        .disabled(busy || newPassword.count < 8)
                    }
                }
                .padding(24)
            }
            .background(Pa.bg.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await session.resetPassword(token: token, newPassword: newPassword)
            error = nil
            done = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct VerifyEmailView: View {
    let token: String

    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @State private var status: Status = .loading
    @State private var error = ""

    private enum Status { case loading, ok, failed }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    BrandHeader(subtitle: "E-posta doğrulama")
                    switch status {
                    case .loading:
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Doğrulanıyor…").foregroundColor(Pa.muted)
                        }
                    case .ok:
                        InfoText(message: "E-posta adresin doğrulandı. Teşekkürler!")
                    case .failed:
                        ErrorText(message: error)
                    }
                    if status != .loading {
                        Button(session.isSignedIn ? "Tamam" : "Girişe dön") { dismiss() }
                            .buttonStyle(PaSecondaryButtonStyle())
                    }
                }
                .padding(24)
            }
            .background(Pa.bg.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
        .task { await verify() }
    }

    @MainActor
    private func verify() async {
        do {
            try await session.verifyEmail(token: token)
            status = .ok
        } catch {
            self.error = error.localizedDescription
            status = .failed
        }
    }
}

/// Sheet content for a deep link.
struct DeepLinkView: View {
    let link: DeepLink

    var body: some View {
        switch link {
        case .resetPassword(let token): ResetPasswordView(token: token)
        case .verifyEmail(let token): VerifyEmailView(token: token)
        }
    }
}
