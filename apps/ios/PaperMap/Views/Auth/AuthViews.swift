// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

struct AuthFlowView: View {
    var body: some View {
        NavigationStack {
            LoginView()
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var session: Session
    @State private var login = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Image("LaunchLogo")
                        .resizable()
                        .frame(width: 72, height: 72)
                        .accessibilityHidden(true)
                    Text("PaperMap")
                        .font(.largeTitle.weight(.bold))
                        .foregroundColor(Pa.text)
                    Text("Ailen ve arkadaşlarınla konumunu paylaş.")
                        .foregroundColor(Pa.muted)
                }
                VStack(spacing: 16) {
                    LabeledField(label: "E-posta ya da kullanıcı adı", text: $login, contentType: .username, keyboard: .emailAddress)
                    LabeledField(label: "Şifre", text: $password, secure: true, contentType: .password)
                }
                if let error { ErrorText(message: error) }
                Button {
                    Task { await submit() }
                } label: {
                    if busy { ProgressView().tint(Pa.onPrimary) } else { Text("Giriş yap") }
                }
                .buttonStyle(PaPrimaryButtonStyle())
                .disabled(busy || login.isEmpty || password.isEmpty)

                NavigationLink {
                    RegisterView()
                } label: {
                    Text("Hesap oluştur")
                }
                .buttonStyle(PaSecondaryButtonStyle())
            }
            .padding(24)
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationBarHidden(true)
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await session.login(login: login, password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct RegisterView: View {
    @EnvironmentObject private var session: Session
    @State private var email = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    private var valid: Bool {
        email.contains("@") && username.count >= 3 && !displayName.isEmpty && password.count >= 8
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                LabeledField(label: "E-posta", text: $email, contentType: .emailAddress, keyboard: .emailAddress)
                LabeledField(label: "Kullanıcı adı", text: $username, contentType: .username)
                LabeledField(label: "Görünen ad", text: $displayName, contentType: .name)
                VStack(alignment: .leading, spacing: 4) {
                    LabeledField(label: "Şifre", text: $password, secure: true, contentType: .newPassword)
                    Text("En az 8 karakter.").font(.caption).foregroundColor(Pa.muted)
                }
                if let error { ErrorText(message: error) }
                Button {
                    Task { await submit() }
                } label: {
                    if busy { ProgressView().tint(Pa.onPrimary) } else { Text("Hesap oluştur") }
                }
                .buttonStyle(PaPrimaryButtonStyle())
                .disabled(busy || !valid)
                .padding(.top, 8)
            }
            .padding(24)
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationTitle("Hesap oluştur")
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await session.register(email: email, username: username, displayName: displayName, password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
