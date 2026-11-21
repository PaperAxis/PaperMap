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
    @State private var rememberMe = true
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BrandHeader(subtitle: "Ailen ve arkadaşlarınla konumunu paylaş.")
                VStack(spacing: 16) {
                    LabeledField(label: "E-posta ya da kullanıcı adı", text: $login, contentType: .username, keyboard: .emailAddress)
                    LabeledField(label: "Şifre", text: $password, secure: true, contentType: .password)
                    HStack {
                        Toggle(isOn: $rememberMe) {
                            Text("Beni hatırla").foregroundColor(Pa.text)
                        }
                        .toggleStyle(CheckboxToggleStyle())
                        NavigationLink {
                            ForgotPasswordView()
                        } label: {
                            Text("Şifreni mi unuttun?")
                                .paFont(.subheadline)
                                .frame(minHeight: 44)
                        }
                    }
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

                SSOButtons(error: $error)
            }
            .padding(24)
        }
        .background(Pa.bg.ignoresSafeArea())
        .navigationBarHidden(true)
        .onAppear {
            if login.isEmpty { login = session.rememberedLogin }
        }
    }

    @MainActor
    private func submit() async {
        busy = true
        defer { busy = false }
        do {
            try await session.login(login: login, password: password, remember: rememberMe)
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
                    Text("En az 8 karakter.").paFont(.caption).foregroundColor(Pa.muted)
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

                SSOButtons(error: $error)
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

/// "ya da" divider and one button per configured external provider (docs/SSO.md).
struct SSOButtons: View {
    @EnvironmentObject private var session: Session
    @Binding var error: String?
    @State private var providers: [SSOProvider] = []
    @State private var busyProvider: SSOProvider?

    var body: some View {
        Group {
            if !providers.isEmpty {
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        Rectangle().fill(Pa.muted.opacity(0.4)).frame(height: 1)
                        Text("ya da").paFont(.subheadline).foregroundColor(Pa.muted)
                        Rectangle().fill(Pa.muted.opacity(0.4)).frame(height: 1)
                    }
                    .accessibilityHidden(true)
                    ForEach(providers) { provider in
                        Button {
                            Task { await start(provider) }
                        } label: {
                            if busyProvider == provider {
                                ProgressView()
                            } else {
                                Text(provider.continueLabel)
                            }
                        }
                        .buttonStyle(PaSecondaryButtonStyle())
                        .disabled(busyProvider != nil)
                    }
                }
            }
        }
        .task { providers = await session.ssoProviders() }
    }

    @MainActor
    private func start(_ provider: SSOProvider) async {
        busyProvider = provider
        defer { busyProvider = nil }
        do {
            try await session.loginWithProvider(provider)
            error = nil
        } catch SSOError.cancelled {
            // User closed the sign-in sheet; nothing to report.
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// Square checkbox (iOS has no native one); whole row is the 44 pt tap target.
struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .paFont(.title3)
                    .foregroundColor(configuration.isOn ? Pa.primary : Pa.muted)
                configuration.label
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(configuration.isOn ? [.isButton, .isSelected] : .isButton)
    }
}
