// Copyright (c) 2026 PaperAxis. All rights reserved.
// Applies the profile icon style (Appearance.iconStyles) to SF Symbols. The web
// draws Lucide strokes (normal 1.5, thin 1.15, bold 2.25, sharp 1.5 with square
// caps); SF Symbols only vary by weight, so each style maps to a symbol weight:
// thin → light, normal → regular, bold → bold. SF Symbols have no square-cap
// or mitered variant, so "sharp" uses medium: the same stroke family as
// normal, slightly crisper, and still distinguishable from it.

import SwiftUI
import UIKit

private struct PaIconWeightKey: EnvironmentKey {
    static let defaultValue: Font.Weight = .regular
}

extension EnvironmentValues {
    /// Symbol weight of the profile icon style; set at the root (PaperMapApp).
    var paIconWeight: Font.Weight {
        get { self[PaIconWeightKey.self] }
        set { self[PaIconWeightKey.self] = newValue }
    }
}

extension Appearance {
    private static let iconStyleKey = "papermap.iconStyle"

    static var cachedIconStyle: String? { UserDefaults.standard.string(forKey: iconStyleKey) }

    static func cache(iconStyle: String?) {
        if let iconStyle { UserDefaults.standard.set(iconStyle, forKey: iconStyleKey) } else {
            UserDefaults.standard.removeObject(forKey: iconStyleKey)
        }
    }

    /// Symbol weight for a stored icon style id; unknown values use "normal".
    static func iconWeight(for id: String?) -> Font.Weight {
        iconStyles.first { $0.id == id }?.weight ?? .regular
    }

    /// Tab bar icon: UIKit draws tab icons from the image itself, so the
    /// weight is baked into the symbol configuration.
    static func tabSymbol(_ name: String, weight: Font.Weight) -> Image {
        let config = UIImage.SymbolConfiguration(weight: uiSymbolWeight(weight))
        guard let image = UIImage(systemName: name, withConfiguration: config) else {
            return Image(systemName: name)
        }
        return Image(uiImage: image)
    }

    private static func uiSymbolWeight(_ weight: Font.Weight) -> UIImage.SymbolWeight {
        if weight == .light { return .light }
        if weight == .medium { return .medium }
        if weight == .semibold { return .semibold }
        if weight == .bold { return .bold }
        return .regular
    }
}

/// An SF Symbol in the profile icon style; sized by the surrounding font.
struct PaSymbol: View {
    let name: String
    @Environment(\.paIconWeight) private var weight

    init(_ name: String) {
        self.name = name
    }

    var body: some View {
        Image(systemName: name).fontWeight(weight)
    }
}

extension Label where Title == Text, Icon == PaSymbol {
    /// `Label(_:systemImage:)` with the icon in the profile icon style.
    init(_ titleKey: LocalizedStringKey, symbol: String) {
        self.init { Text(titleKey) } icon: { PaSymbol(symbol) }
    }

    init<S: StringProtocol>(_ title: S, symbol: String) {
        self.init { Text(title) } icon: { PaSymbol(symbol) }
    }
}
