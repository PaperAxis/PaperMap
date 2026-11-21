// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

/// Theme, font and icon style (web: Profile.jsx "Görünüm", ThemePicker.jsx).
/// Stored on the account so web and mobile share the choice.
struct AppearanceView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var fonts: FontStore
    @State private var openCategory: String?
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?

    private let columns = [GridItem(.adaptive(minimum: 52), spacing: 10)]

    private var currentThemeId: String? { Appearance.resolvedThemeId(session.user?.theme) }

    var body: some View {
        Form {
            if error != nil || info != nil {
                Section {
                    if let error { ErrorText(message: error) }
                    if let info { InfoText(message: info) }
                }
            }
            Section {
                HStack {
                    Text("Seçili").foregroundColor(Pa.muted)
                    Spacer()
                    Text(Appearance.theme(session.user?.theme)?.label ?? "Sistem ayarı")
                        .foregroundColor(Pa.text)
                }
                Button {
                    Task { await patch(ProfilePatch(theme: "system")) }
                } label: {
                    HStack {
                        Label("Sistem ayarı", symbol: "circle.lefthalf.filled")
                            .foregroundColor(Pa.text)
                        Spacer()
                        if currentThemeId == nil {
                            PaSymbol("checkmark").foregroundColor(Pa.primary)
                        }
                    }
                }
                .accessibilityAddTraits(currentThemeId == nil ? .isSelected : [])
                ForEach(Appearance.categories) { category in
                    DisclosureGroup(
                        isExpanded: Binding(
                            get: { openCategory == category.id },
                            set: { openCategory = $0 ? category.id : nil }
                        )
                    ) {
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(category.themes) { theme in
                                swatch(theme)
                            }
                        }
                        .padding(.vertical, 8)
                    } label: {
                        HStack {
                            Text(category.label).foregroundColor(Pa.text)
                            Spacer()
                            Text(verbatim: "\(category.themes.count)")
                                .paFont(.caption, monospacedDigit: true)
                                .foregroundColor(Pa.muted)
                        }
                    }
                }
            } header: {
                Text("Tema")
            } footer: {
                Text("Uygulama, seçtiğin temanın aydınlık ya da karanlık görünümünü kullanır; renk paletinin tamamı web uygulamasında uygulanır.")
            }

            Section {
                ForEach(0..<Appearance.fontCategories.count, id: \.self) { index in
                    let cat = Appearance.fontCategories[index]
                    let fonts = Appearance.fonts.filter { $0.category == cat.0 }
                    ForEach(fonts) { font in
                        optionRow(
                            title: font.label,
                            subtitle: cat.1,
                            selected: Appearance.resolvedFontId(session.user?.fontPref) == font.id
                        ) {
                            // Applied right away (and retried after a failed download);
                            // a failed save falls back to the account's font.
                            fonts.apply(fontId: font.id)
                            Task {
                                await patch(ProfilePatch(fontPref: font.id))
                                fonts.apply(fontId: session.user?.fontPref)
                            }
                        }
                    }
                }
            } header: {
                Text("Yazı tipi")
            } footer: {
                switch fonts.status {
                case .downloading:
                    Text("Yazı tipi indiriliyor; hazır olana kadar sistem yazı tipi görünür.")
                case .failed:
                    Text("Yazı tipi indirilemedi, sistem yazı tipi kullanılıyor. Bağlantın olduğunda yeniden seçebilirsin.")
                case .ready:
                    Text("Seçtiğin yazı tipi ilk kullanımda indirilir ve tüm uygulamada kullanılır.")
                }
            }

            Section {
                ForEach(Appearance.iconStyles) { style in
                    optionRow(
                        title: style.name,
                        iconWeight: style.weight,
                        selected: (session.user?.iconStyle ?? "normal") == style.id
                    ) {
                        Task { await patch(ProfilePatch(iconStyle: style.id)) }
                    }
                }
            } header: {
                Text("İkon stili")
            } footer: {
                Text("İkonlar seçtiğin çizgi kalınlığıyla gösterilir. iOS sembollerinde köşe şekli değişmediği için Keskin, biraz daha belirgin bir çizgiyle gösterilir.")
            }
        }
        .disabled(busy)
        .navigationTitle("Görünüm")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if openCategory == nil {
                openCategory = Appearance.theme(session.user?.theme)?.category ?? "paperaxis"
            }
        }
    }

    private func swatch(_ theme: ThemeOption) -> some View {
        let selected = theme.id == currentThemeId
        return Button {
            Task { await patch(ProfilePatch(theme: theme.id)) }
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: Pa.radiusSm)
                    .fill(LinearGradient(
                        gradient: Gradient(colors: theme.background),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                Circle().fill(theme.brand).frame(width: 16, height: 16)
                if selected {
                    PaSymbol("checkmark.circle.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(Pa.primary)
                        .background(Circle().fill(Color.white))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .padding(3)
                }
            }
            .frame(height: 52)
            .overlay(
                RoundedRectangle(cornerRadius: Pa.radiusSm)
                    .stroke(selected ? Pa.primary : Pa.muted.opacity(0.4), lineWidth: selected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(theme.label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func optionRow(
        title: String,
        subtitle: String? = nil,
        iconWeight: Font.Weight? = nil,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if let iconWeight {
                    Image(systemName: "star")
                        .font(.system(size: 20, weight: iconWeight))
                        .foregroundColor(Pa.text)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).foregroundColor(Pa.text)
                    if let subtitle { Text(subtitle).paFont(.caption).foregroundColor(Pa.muted) }
                }
                Spacer()
                if selected { PaSymbol("checkmark").foregroundColor(Pa.primary) }
            }
        }
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @MainActor
    private func patch(_ patch: ProfilePatch) async {
        busy = true
        defer { busy = false }
        do {
            try await session.updateProfile(patch)
            info = "Görünüm güncellendi."
            error = nil
        } catch {
            self.error = error.localizedDescription
            info = nil
        }
    }
}
