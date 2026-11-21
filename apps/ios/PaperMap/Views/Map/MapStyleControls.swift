// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

/// Map styles the user can pick; ids match web/src/lib/mapStyle.js MAP_STYLES.
/// Every concrete style is bundled as apps/shared/map-style-<id>.json.
enum MapStyleChoice: String, CaseIterable, Identifiable {
    case auto, light, dark, terrain, night, satellite

    static let storageKey = "papermap.mapStyle"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .auto: return "Otomatik"
        case .light: return "Açık"
        case .dark: return "Koyu"
        case .terrain: return "Arazi"
        case .night: return "Gece"
        case .satellite: return "Uydu"
        }
    }

    var symbol: String {
        switch self {
        case .auto: return "circle.lefthalf.filled"
        case .light: return "sun.max"
        case .dark: return "moon"
        case .terrain: return "mountain.2"
        case .night: return "moon.stars"
        case .satellite: return "globe.europe.africa"
        }
    }

    /// Style file to draw; "auto" follows the app theme.
    func variant(dark: Bool) -> String {
        self == .auto ? (dark ? "dark" : "light") : rawValue
    }
}

/// Bottom-left button: picks the map style (checkmark on the current one).
struct MapStylePicker: View {
    @Binding var selection: String

    var body: some View {
        Menu {
            Picker("Harita stili", selection: $selection) {
                ForEach(MapStyleChoice.allCases) { choice in
                    Label(choice.label, symbol: choice.symbol).tag(choice.rawValue)
                }
            }
            .pickerStyle(.inline)
        } label: {
            PaSymbol("map")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel("Harita stili")
    }
}

/// 3D / 2D toggle next to the compass. The map can also be tilted with two
/// fingers dragged up/down together and rotated with a two-finger twist; this
/// button makes the perspective discoverable and reachable with one tap.
struct TiltButton: View {
    let pitch: Double
    let action: () -> Void

    private var active: Bool { pitch > 5 }

    var body: some View {
        Button(action: action) {
            Text(active ? "3D" : "2D")
                .font(.system(size: 15, weight: .heavy))
                .foregroundColor(active ? Pa.primary : Pa.text)
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel(active ? "2B görünüme geç" : "3B görünüme geç")
    }
}

/// Compass next to the style picker: the needle points north as the map
/// turns; tapping turns the map back to north-up and flat (as on the web).
struct CompassButton: View {
    let bearing: Double
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            CompassNeedle()
                .frame(width: 10, height: 26)
                .rotationEffect(.degrees(-bearing))
                .frame(width: 48, height: 48)
                .background(Pa.bg)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .shadow(color: .black.opacity(0.08), radius: 6, y: 2)
        }
        .accessibilityLabel("Pusula: kuzeye döndür")
    }
}

private struct CompassNeedle: View {
    var body: some View {
        VStack(spacing: 0) {
            Triangle().fill(Color(red: 0.9, green: 0.28, blue: 0.3))
            Triangle().fill(Pa.text.opacity(0.55)).rotationEffect(.degrees(180))
        }
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
