// Copyright (c) 2026 PaperAxis. All rights reserved.
// PaperAxis design tokens for SwiftUI; values live in Assets.xcassets colorsets.

import SwiftUI
import UIKit

enum Pa {
    static let bg = Color("PaBg")
    static let surface = Color("PaSurface")
    static let text = Color("PaText")
    static let muted = Color("PaMuted")
    static let primary = Color("PaPrimary")
    static let onPrimary = Color("PaOnPrimary")
    static let danger = Color("PaDanger")

    static let radiusSm: CGFloat = 8
    static let radiusMd: CGFloat = 12
}

extension UIColor {
    /// Parses "#RRGGBB" (the server's avatarColor format); nil when malformed.
    convenience init?(hex: String?) {
        guard var s = hex?.trimmingCharacters(in: .whitespaces) else { return nil }
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(
            red: CGFloat((v >> 16) & 0xFF) / 255,
            green: CGFloat((v >> 8) & 0xFF) / 255,
            blue: CGFloat(v & 0xFF) / 255,
            alpha: 1
        )
    }

    /// "#rrggbb" (lowercase, as the server stores colors); alpha is dropped.
    var hexString: String {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        if !getRed(&r, green: &g, blue: &b, alpha: &a) {
            var white: CGFloat = 0
            getWhite(&white, alpha: &a)
            r = white; g = white; b = white
        }
        func byte(_ v: CGFloat) -> Int { Int((min(max(v, 0), 1) * 255).rounded()) }
        return String(format: "#%02x%02x%02x", byte(r), byte(g), byte(b))
    }
}

/// Color from a "#rrggbb" string, with a fallback.
func paColor(_ hex: String?, fallback: String = "#315BDB") -> Color {
    Color(UIColor(hex: hex) ?? UIColor(hex: fallback) ?? .systemBlue)
}

/// Primary action: one per screen, Axis Blue.
struct PaPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .paFont(.body, weight: .semibold)
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundColor(Pa.onPrimary)
            .background(Pa.primary.opacity(configuration.isPressed ? 0.85 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Pa.radiusSm))
            .opacity(isEnabled ? 1 : 0.45)
    }
}

/// Outlined secondary action.
struct PaSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .paFont(.body, weight: .medium)
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundColor(Pa.text)
            .overlay(RoundedRectangle(cornerRadius: Pa.radiusSm).stroke(Pa.text, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// Text field with a visible label above it.
struct LabeledField: View {
    let label: String
    @Binding var text: String
    var secure = false
    var contentType: UITextContentType? = nil
    var keyboard: UIKeyboardType = .default
    /// Secure fields only: show/hide toggle inside the field, trailing edge.
    @State private var revealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).paFont(.subheadline, weight: .medium).foregroundColor(Pa.text)
            HStack(spacing: 0) {
                Group {
                    if secure && !revealed {
                        SecureField("", text: $text)
                    } else {
                        TextField("", text: $text)
                            .keyboardType(secure ? .default : keyboard)
                    }
                }
                .textContentType(contentType)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel(label)
                .padding(.leading, 12)
                .padding(.trailing, secure ? 0 : 12)

                if secure {
                    Button {
                        revealed.toggle()
                    } label: {
                        Image(systemName: revealed ? "eye.slash" : "eye")
                            .paFont(.body)
                            .foregroundColor(Pa.muted)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(revealed ? "Şifreyi gizle" : "Şifreyi göster")
                }
            }
            .frame(minHeight: 44)
            .background(Color(uiColor: .systemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: Pa.radiusSm)
                    .stroke(Color(UIColor(hex: "#7E817A") ?? .gray), lineWidth: 1)
            )
        }
    }
}

/// Inline error message: icon + text, never color alone.
struct ErrorText: View {
    let message: String
    var body: some View {
        Label(message, systemImage: "exclamationmark.circle")
            .paFont(.subheadline)
            .foregroundColor(Pa.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
