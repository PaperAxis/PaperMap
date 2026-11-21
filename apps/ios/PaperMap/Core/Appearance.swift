// Copyright (c) 2026 PaperAxis. All rights reserved.
// Theme, font and icon-style catalog shared with the web app
// (web/src/lib/appearance/themes.js, fonts.js, lib/iconStyles.js). The ids are
// stored on the user record; iOS applies the theme's light/dark scheme, the font
// (Fonts.swift) and the icon style; the web app also applies the full palette.

import SwiftUI
import UIKit

struct ThemeOption: Identifiable, Hashable {
    let id: String
    let label: String
    let category: String
    let dark: Bool
    /// Swatch colors: background stops (one, or two for gradients) and the brand dot.
    let background: [Color]
    let brand: Color
}

struct ThemeCategory: Identifiable {
    let id: String
    let label: String
    let themes: [ThemeOption]
}

struct FontOption: Identifiable, Hashable {
    let id: String
    let label: String
    let category: String
    /// Google Fonts family; nil uses the system font.
    var family: String? = nil
    /// Static weights Google Fonts serves for the family.
    var weights: [Int] = Appearance.fullFontWeights
    /// Headline family when it differs from the body (the default pairs Inter with Manrope).
    var display: String? = nil
}

struct IconStyleOption: Identifiable, Hashable {
    let id: String
    let name: String
    /// SF Symbol weight used for the preview.
    let weight: Font.Weight
}

enum Appearance {
    // MARK: Theme scheme

    private static let themeKey = "papermap.theme"

    /// Values that mean "no explicit choice": the database default ("light"),
    /// the old "system" option and empty. iOS follows the system scheme for them.
    static let systemThemeIds: Set<String> = ["", "light", "system"]

    static var cachedThemeId: String? { UserDefaults.standard.string(forKey: themeKey) }

    static func cache(themeId: String?) {
        if let themeId { UserDefaults.standard.set(themeId, forKey: themeKey) } else {
            UserDefaults.standard.removeObject(forKey: themeKey)
        }
    }

    /// Color scheme to force for a stored theme id; nil follows the system.
    static func colorScheme(for themeId: String?) -> ColorScheme? {
        guard let themeId, !systemThemeIds.contains(themeId) else { return nil }
        if let theme = themeById[themeId] { return theme.dark ? .dark : .light }
        if let mapped = legacyAliases[themeId], let theme = themeById[mapped] {
            return theme.dark ? .dark : .light
        }
        return nil
    }

    /// Catalog id for a stored value (legacy ids map to their successor); nil when unknown or "system".
    static func resolvedThemeId(_ themeId: String?) -> String? {
        guard let themeId, !systemThemeIds.contains(themeId) else { return nil }
        if themeById[themeId] != nil { return themeId }
        return legacyAliases[themeId]
    }

    static func theme(_ id: String?) -> ThemeOption? {
        resolvedThemeId(id).flatMap { themeById[$0] }
    }

    // MARK: Catalog

    private static let hues: [(Double, String, String)] = [
        (0, "Kırmızı", "kirmizi"), (18, "Mercan", "mercan"), (32, "Turuncu", "turuncu"),
        (44, "Kehribar", "kehribar"), (52, "Altın", "altin"), (64, "Limon", "limon"),
        (80, "Fıstık", "fistik"), (100, "Çimen", "cimen"), (130, "Yeşil", "yesil"),
        (150, "Zümrüt", "zumrut"), (165, "Nane", "nane"), (178, "Turkuaz", "turkuaz"),
        (190, "Camgöbeği", "camgobegi"), (202, "Gökyüzü", "gokyuzu"), (214, "Okyanus", "okyanus"),
        (226, "Mavi", "mavi"), (240, "Kobalt", "kobalt"), (252, "Çivit", "civit"),
        (264, "Menekşe", "menekse"), (276, "Mor", "mor"), (290, "Erik", "erik"),
        (304, "Orkide", "orkide"), (320, "Fuşya", "fusya"), (334, "Gül", "gul"), (348, "Kiraz", "kiraz"),
    ]

    /// name, background hue override, bg saturation, bg lightness, brand saturation, brand lightness.
    private typealias Style = (String, Double?, Double, Double, Double, Double)

    private static let lightStyles: [Style] = [
        ("Klasik", nil, 34, 97, 70, 43), ("Pastel", nil, 56, 94, 56, 55), ("Papirüs", 38, 44, 95, 54, 40),
        ("Mono", nil, 7, 96, 80, 45), ("Canlı", nil, 50, 95, 88, 44), ("Buz", 205, 26, 98, 58, 48),
        ("Krem", 44, 30, 96, 52, 42), ("Mineral", nil, 22, 93, 46, 40), ("Sade", nil, 12, 98, 64, 46),
        ("Sıcak Kum", 28, 40, 95, 60, 44), ("Toprak", 32, 30, 92, 44, 38), ("Tebeşir", nil, 16, 96, 50, 48),
        ("Lavanta", 270, 30, 96, 52, 52), ("Çiğ", nil, 44, 96, 62, 50), ("İnci", nil, 10, 99, 66, 44),
        ("Limonata", 54, 48, 96, 72, 46), ("Vitray", nil, 62, 92, 86, 46), ("Bulut", 215, 14, 97, 54, 52),
        ("Keten", 40, 18, 95, 48, 40), ("Bal", 42, 54, 94, 64, 42), ("Ferah", nil, 38, 97, 58, 46),
        ("Mermer", nil, 8, 97, 60, 42), ("Şeftali", 20, 46, 95, 60, 50), ("Gül Kurusu", 350, 28, 95, 52, 46),
        ("Kuvars", 304, 24, 97, 56, 50),
    ]

    private static let darkStyles: [Style] = [
        ("Gece", nil, 22, 8, 64, 60), ("OLED", nil, 0, 0, 84, 64), ("Alacakaranlık", nil, 30, 14, 60, 66),
        ("Neon", nil, 44, 6, 100, 64), ("Arduvaz", nil, 9, 12, 56, 64), ("Orman Gecesi", nil, 40, 7, 58, 58),
        ("Şarap", 350, 34, 9, 60, 58), ("Füme", nil, 6, 14, 52, 62), ("Mürekkep", 224, 32, 9, 62, 62),
        ("Kömür", nil, 4, 9, 70, 64), ("Gece Mavisi", 220, 42, 11, 66, 64), ("Bordo", 356, 32, 10, 58, 56),
        ("Antrasit", nil, 10, 16, 54, 64), ("Espresso", 28, 34, 9, 56, 56), ("Derin Gece", nil, 26, 9, 64, 60),
        ("Galaksi", 262, 36, 8, 74, 66), ("Zift", nil, 14, 5, 66, 60), ("Pus", nil, 16, 18, 52, 66),
        ("Volkan", 12, 42, 7, 88, 58), ("Derin Deniz", 200, 42, 9, 64, 60), ("Yosun", 158, 34, 8, 58, 58),
        ("Gölge", nil, 12, 11, 58, 62), ("Yakut", 348, 40, 8, 82, 60), ("Lacivert", 232, 46, 10, 68, 64),
        ("Obsidyen", nil, 20, 4, 72, 62),
    ]

    /// label, background (hue nil = theme hue), brand saturation/lightness.
    private typealias Contrast = (String, (Double?, Double, Double), (Double, Double))

    private static let a11yLight: [Contrast] = [
        ("Yüksek Kontrast", (0, 0, 100), (95, 30)),
        ("Sepya Kontrast", (40, 56, 95), (92, 28)),
        ("Kağıt Kontrast", (40, 22, 97), (90, 30)),
        ("Buz Kontrast", (205, 30, 98), (92, 30)),
    ]

    private static let a11yDark: [Contrast] = [
        ("Yüksek Kontrast", (0, 0, 4), (100, 64)),
        ("Kömür Kontrast", (nil, 12, 9), (92, 66)),
        ("Sıcak Kontrast", (28, 42, 7), (96, 66)),
        ("Gece Mavisi Kontrast", (224, 48, 6), (96, 68)),
        ("Orman Kontrast", (150, 44, 6), (94, 66)),
        ("Mor Kontrast", (276, 42, 7), (96, 68)),
    ]

    private static let lightGradOffsets: [Double] = [34, 52, 150, 26, 90, 44, 18, 66]
    private static let darkGradOffsets: [Double] = [44, 150, 28, 90, 60, 22, 120, 52]

    static let categories: [ThemeCategory] = {
        let brand = [
            ThemeOption(
                id: "paperaxis", label: "PaperAxis Aydınlık", category: "paperaxis", dark: false,
                background: [hex("#F5F3EE")], brand: hex("#315BDB")
            ),
            ThemeOption(
                id: "paperaxis-koyu", label: "PaperAxis Koyu", category: "paperaxis", dark: true,
                background: [hex("#171918")], brand: hex("#7A9BF0")
            ),
        ]
        func rot(_ h: Double, _ d: Double) -> Double { ((h + d).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) }

        var light: [ThemeOption] = [], dark: [ThemeOption] = []
        var lightGrad: [ThemeOption] = [], darkGrad: [ThemeOption] = []
        var accLight: [ThemeOption] = [], accDark: [ThemeOption] = []
        for (idx, hue) in hues.enumerated() {
            let (h, name, slug) = hue
            let ls = lightStyles[idx]
            let lightBg = hsl(ls.1 ?? h, ls.2, ls.3)
            let lightBrand = hsl(h, ls.4, ls.5)
            light.append(ThemeOption(
                id: "light-\(slug)", label: "\(name) \(ls.0)", category: "light", dark: false,
                background: [lightBg], brand: lightBrand
            ))
            lightGrad.append(ThemeOption(
                id: "light-grad-\(slug)", label: "\(name) \(ls.0) Gradyan", category: "light-grad", dark: false,
                background: [hsl(rot(h, -14), 64, 93), hsl(rot(h, lightGradOffsets[idx % 8]), 58, 84)],
                brand: lightBrand
            ))

            let ds = darkStyles[idx]
            let darkBrand = hsl(h, ds.4, ds.5)
            dark.append(ThemeOption(
                id: "dark-\(slug)", label: "\(name) \(ds.0)", category: "dark", dark: true,
                background: [hsl(ds.1 ?? h, ds.2, ds.3)], brand: darkBrand
            ))
            darkGrad.append(ThemeOption(
                id: "dark-grad-\(slug)", label: "\(name) \(ds.0) Gradyan", category: "dark-grad", dark: true,
                background: [hsl(rot(h, -16), 44, 9), hsl(rot(h, darkGradOffsets[idx % 8]), 46, 15)],
                brand: darkBrand
            ))

            let al = a11yLight[idx % a11yLight.count]
            accLight.append(ThemeOption(
                id: "a11y-light-\(slug)", label: "\(name) \(al.0)", category: "a11y-light", dark: false,
                background: [hsl(al.1.0 ?? h, al.1.1, al.1.2)], brand: hsl(h, al.2.0, al.2.1)
            ))
            let ad = a11yDark[idx % a11yDark.count]
            accDark.append(ThemeOption(
                id: "a11y-\(slug)", label: "\(name) \(ad.0)", category: "a11y-dark", dark: true,
                background: [hsl(ad.1.0 ?? h, ad.1.1, ad.1.2)], brand: hsl(h, ad.2.0, ad.2.1)
            ))
        }
        return [
            ThemeCategory(id: "paperaxis", label: "PaperAxis", themes: brand),
            ThemeCategory(id: "light", label: "Aydınlık", themes: light),
            ThemeCategory(id: "dark", label: "Karanlık", themes: dark),
            ThemeCategory(id: "light-grad", label: "Aydınlık gradyan", themes: lightGrad),
            ThemeCategory(id: "dark-grad", label: "Karanlık gradyan", themes: darkGrad),
            ThemeCategory(id: "a11y-light", label: "Erişilebilir aydınlık", themes: accLight),
            ThemeCategory(id: "a11y-dark", label: "Erişilebilir karanlık", themes: accDark),
        ]
    }()

    private static let themeById: [String: ThemeOption] = {
        var map: [String: ThemeOption] = [:]
        for cat in categories { for t in cat.themes { map[t.id] = t } }
        return map
    }()

    /// PaperMap's earlier 60 theme ids (category-accent) mapped to the catalog, as on the web.
    private static let legacyAliases: [String: String] = {
        let accents = [
            "emerald": "zumrut", "teal": "turkuaz", "blue": "mavi", "indigo": "civit", "violet": "menekse",
            "fuchsia": "fusya", "pink": "gul", "rose": "kiraz", "orange": "turuncu", "amber": "kehribar",
        ]
        let cats = [
            "light": "light", "dark": "dark", "light-gradient": "light-grad", "dark-gradient": "dark-grad",
            "light-access": "a11y-light", "dark-access": "a11y",
        ]
        var map = ["dark": "paperaxis-koyu"]
        for (oldCat, prefix) in cats {
            for (oldAccent, slug) in accents { map["\(oldCat)-\(oldAccent)"] = "\(prefix)-\(slug)" }
        }
        return map
    }()

    // MARK: Fonts (applied by FontStore) and icon styles (IconStyle.swift)

    static let fontCategories: [(String, String)] = [
        ("okunabilirlik", "Okunabilirlik"), ("sans", "Sans-serif"), ("serif", "Serif"), ("mono", "Monospace"),
    ]

    static let fonts: [FontOption] = [
        FontOption(id: "lexend", label: "Lexend (disleksi dostu)", category: "okunabilirlik", family: "Lexend"),
        FontOption(id: "atkinson", label: "Atkinson Hyperlegible", category: "okunabilirlik", family: "Atkinson Hyperlegible", weights: [400, 700]),
        FontOption(id: "inter", label: "Inter ve Manrope (varsayılan)", category: "sans", family: "Inter", display: "Manrope"),
        FontOption(id: "sistem", label: "Sistem", category: "sans"),
        FontOption(id: "roboto", label: "Roboto", category: "sans", family: "Roboto"),
        FontOption(id: "open-sans", label: "Open Sans", category: "sans", family: "Open Sans"),
        FontOption(id: "lato", label: "Lato", category: "sans", family: "Lato", weights: [400, 700]),
        FontOption(id: "montserrat", label: "Montserrat", category: "sans", family: "Montserrat"),
        FontOption(id: "poppins", label: "Poppins", category: "sans", family: "Poppins"),
        FontOption(id: "nunito", label: "Nunito", category: "sans", family: "Nunito"),
        FontOption(id: "work-sans", label: "Work Sans", category: "sans", family: "Work Sans"),
        FontOption(id: "rubik", label: "Rubik", category: "sans", family: "Rubik"),
        FontOption(id: "dm-sans", label: "DM Sans", category: "sans", family: "DM Sans"),
        FontOption(id: "manrope", label: "Manrope", category: "sans", family: "Manrope"),
        FontOption(id: "mulish", label: "Mulish", category: "sans", family: "Mulish"),
        FontOption(id: "karla", label: "Karla", category: "sans", family: "Karla"),
        FontOption(id: "merriweather", label: "Merriweather", category: "serif", family: "Merriweather"),
        FontOption(id: "lora", label: "Lora", category: "serif", family: "Lora"),
        FontOption(id: "pt-serif", label: "PT Serif", category: "serif", family: "PT Serif", weights: [400, 700]),
        FontOption(id: "roboto-slab", label: "Roboto Slab", category: "serif", family: "Roboto Slab"),
        FontOption(id: "bitter", label: "Bitter", category: "serif", family: "Bitter"),
        FontOption(id: "eb-garamond", label: "EB Garamond", category: "serif", family: "EB Garamond"),
        FontOption(id: "playfair", label: "Playfair Display", category: "serif", family: "Playfair Display"),
        FontOption(id: "jetbrains-mono", label: "JetBrains Mono", category: "mono", family: "JetBrains Mono"),
        FontOption(id: "ibm-plex-mono", label: "IBM Plex Mono", category: "mono", family: "IBM Plex Mono"),
    ]

    static let fullFontWeights = [400, 500, 600, 700]

    static func font(_ id: String?) -> FontOption? {
        let resolved = resolvedFontId(id)
        return fonts.first { $0.id == resolved }
    }

    /// Unknown and legacy values ("default") resolve to the default font, as on the web.
    static func resolvedFontId(_ value: String?) -> String {
        guard let value, fonts.contains(where: { $0.id == value }) else { return "inter" }
        return value
    }

    static let iconStyles: [IconStyleOption] = [
        IconStyleOption(id: "normal", name: "Normal", weight: .regular),
        IconStyleOption(id: "thin", name: "İnce", weight: .light),
        IconStyleOption(id: "bold", name: "Kalın", weight: .bold),
        IconStyleOption(id: "sharp", name: "Keskin", weight: .medium),
    ]

    // MARK: Color helpers

    private static func hex(_ s: String) -> Color {
        Color(UIColor(hex: s) ?? .gray)
    }

    /// CSS-style HSL (degrees, percent, percent) to a SwiftUI color.
    private static func hsl(_ h: Double, _ s: Double, _ l: Double) -> Color {
        let sn = s / 100, ln = l / 100
        let a = sn * min(ln, 1 - ln)
        func f(_ n: Double) -> Double {
            let k = (n + h / 30).truncatingRemainder(dividingBy: 12)
            return ln - a * max(-1, min(k - 3, min(9 - k, 1)))
        }
        return Color(red: f(0), green: f(8), blue: f(4))
    }
}
