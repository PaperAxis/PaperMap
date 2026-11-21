// Copyright (c) 2026 PaperAxis. All rights reserved.
// Applies the profile font (Appearance.fonts) app-wide. A Google font is
// downloaded the first time it is chosen, cached in Application Support and
// registered with Core Text; the system font is shown until it is ready and
// whenever the download fails.

import CoreText
import SwiftUI
import UIKit

/// PostScript names of a registered family's faces, keyed by CSS weight.
struct FontFaces: Equatable {
    let names: [Int: String]

    /// Face closest to `weight`; ties go to the lighter face (500 → 400 when there is no 500).
    func name(for weight: Int) -> String? {
        let best = names.keys.min { a, b in
            let da = abs(a - weight), db = abs(b - weight)
            return da != db ? da < db : a < b
        }
        return best.flatMap { names[$0] }
    }
}

/// The fonts in use: nil families mean the system font.
struct Typeface: Equatable {
    var body: FontFaces?
    /// Headline family (Manrope for the default font); falls back to `body`.
    var display: FontFaces?

    static let system = Typeface(body: nil, display: nil)

    /// A font for a Dynamic Type style. Custom faces scale with the user's text
    /// size through `relativeTo:`; `boldText` follows the Bold Text setting,
    /// which custom fonts do not pick up on their own.
    func font(_ style: Font.TextStyle, weight: Font.Weight? = nil, boldText: Bool = false) -> Font {
        guard let name = faceName(style, weight: weight, boldText: boldText) else {
            let system = Font.system(style)
            if let weight { return system.weight(weight) }
            return system
        }
        return Font.custom(name, size: Self.baseSize(style), relativeTo: style)
    }

    /// UIKit font for a style, scaled for Dynamic Type; nil for the system font.
    func uiFont(_ style: Font.TextStyle, _ uiStyle: UIFont.TextStyle) -> UIFont? {
        guard let name = faceName(style, weight: nil, boldText: false),
              let base = UIFont(name: name, size: Self.baseSize(style)) else { return nil }
        return UIFontMetrics(forTextStyle: uiStyle).scaledFont(for: base)
    }

    private func faceName(_ style: Font.TextStyle, weight: Font.Weight?, boldText: Bool) -> String? {
        guard let faces = Self.isDisplay(style) ? (display ?? body) : body else { return nil }
        var css = weight.map(Self.cssWeight) ?? Self.defaultWeight(style)
        if boldText { css = min(css + 200, 700) }
        return faces.name(for: css)
    }

    /// Heading styles use the display family, as the web's --font-display.
    private static func isDisplay(_ style: Font.TextStyle) -> Bool {
        switch style {
        case .largeTitle, .title, .title2, .title3, .headline: return true
        default: return false
        }
    }

    /// Point sizes at the default ("Large") content size; Font.custom scales them.
    private static func baseSize(_ style: Font.TextStyle) -> CGFloat {
        switch style {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .caption: return 12
        case .caption2: return 11
        default: return 17
        }
    }

    /// The system's own weight for a style (headline is semibold).
    private static func defaultWeight(_ style: Font.TextStyle) -> Int {
        style == .headline ? 600 : 400
    }

    private static func cssWeight(_ weight: Font.Weight) -> Int {
        if weight == .medium { return 500 }
        if weight == .semibold { return 600 }
        if weight == .bold || weight == .heavy || weight == .black { return 700 }
        return 400
    }
}

private struct PaTypefaceKey: EnvironmentKey {
    static let defaultValue = Typeface.system
}

extension EnvironmentValues {
    /// Set once at the root (PaperMapApp) from FontStore.
    var paTypeface: Typeface {
        get { self[PaTypefaceKey.self] }
        set { self[PaTypefaceKey.self] = newValue }
    }
}

/// `.font(.headline)` in the profile font; use it instead of `.font` for text styles.
struct PaFontModifier: ViewModifier {
    @Environment(\.paTypeface) private var typeface
    @Environment(\.legibilityWeight) private var legibilityWeight
    let style: Font.TextStyle
    let weight: Font.Weight?
    let monospacedDigit: Bool

    func body(content: Content) -> some View {
        let font = typeface.font(style, weight: weight, boldText: legibilityWeight == .bold)
        return content.font(monospacedDigit ? font.monospacedDigit() : font)
    }
}

extension View {
    func paFont(_ style: Font.TextStyle, weight: Font.Weight? = nil, monospacedDigit: Bool = false) -> some View {
        modifier(PaFontModifier(style: style, weight: weight, monospacedDigit: monospacedDigit))
    }
}

/// The chosen font: applies cached faces at once, downloads missing ones.
@MainActor
final class FontStore: ObservableObject {
    enum Status: Equatable { case ready, downloading, failed }

    @Published private(set) var typeface: Typeface = .system
    @Published private(set) var status: Status = .ready

    private var fontId: String?
    private var task: Task<Void, Never>?
    private static let fontKey = "papermap.font"

    /// Starts with the last applied font so the app opens in it, before /me returns.
    init() {
        apply(fontId: UserDefaults.standard.string(forKey: Self.fontKey))
    }

    /// Applies a stored font id (unknown values resolve to the default, as on the web).
    func apply(fontId value: String?) {
        let id = Appearance.resolvedFontId(value)
        if id == fontId && status != .failed { return }
        fontId = id
        UserDefaults.standard.set(id, forKey: Self.fontKey)
        task?.cancel()
        task = nil

        guard let option = Appearance.font(id), let bodyFamily = option.family else {
            set(.system, status: .ready)
            return
        }
        // Body family first, then the headline family when the choice pairs two.
        var list: [(family: String, weights: [Int])] = [(family: bodyFamily, weights: option.weights)]
        if let display = option.display {
            list.append((family: display, weights: Appearance.fullFontWeights))
        }
        let requests = list

        let cached = requests.compactMap { FontFiles.cachedFaces(family: $0.family) }
        if cached.count == requests.count {
            set(Self.makeTypeface(cached), status: .ready)
            return
        }

        set(.system, status: .downloading)
        task = Task { [weak self] in
            var faces: [FontFaces] = []
            var failed = false
            for request in requests {
                if let hit = FontFiles.cachedFaces(family: request.family) {
                    faces.append(hit)
                    continue
                }
                do {
                    let downloaded = try await FontFiles.download(family: request.family, weights: request.weights)
                    faces.append(downloaded)
                } catch {
                    failed = true
                    break
                }
            }
            guard !Task.isCancelled, let self, self.fontId == id else { return }
            if failed {
                self.set(.system, status: .failed)
            } else {
                self.set(Self.makeTypeface(faces), status: .ready)
            }
        }
    }

    private static func makeTypeface(_ faces: [FontFaces]) -> Typeface {
        Typeface(body: faces.first, display: faces.count > 1 ? faces[1] : nil)
    }

    private func set(_ typeface: Typeface, status: Status) {
        self.typeface = typeface
        self.status = status
        Self.styleNavigationBars(typeface)
    }

    /// UIKit draws navigation titles; the appearance proxy reaches bars created after this.
    private static func styleNavigationBars(_ typeface: Typeface) {
        var title: [NSAttributedString.Key: Any]?
        var largeTitle: [NSAttributedString.Key: Any]?
        if let font = typeface.uiFont(.headline, .headline) { title = [.font: font] }
        if let font = typeface.uiFont(.largeTitle, .largeTitle) { largeTitle = [.font: font] }
        let bar = UINavigationBar.appearance()
        bar.titleTextAttributes = title
        bar.largeTitleTextAttributes = largeTitle
    }
}

/// Font files in Application Support/Fonts/<Family>/<weight>.ttf.
///
/// Files come from the Google Fonts CSS API (fonts.googleapis.com/css2). It
/// serves WOFF2 to browsers and plain TrueType URLs (fonts.gstatic.com) to
/// other user agents, one static file per requested weight; weights a family
/// lacks are left out of the response.
enum FontFiles {
    private static let completeMarker = ".complete"
    private static let lock = NSLock()
    /// File path → PostScript name of the faces registered in this process.
    private static var registered: [String: String] = [:]

    private static var root: URL? {
        guard let support = try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        ) else { return nil }
        return support.appendingPathComponent("Fonts", isDirectory: true)
    }

    private static func directory(family: String) -> URL? {
        root?.appendingPathComponent(family.replacingOccurrences(of: " ", with: "-"), isDirectory: true)
    }

    /// Registers a fully downloaded family; nil when it is not on disk yet.
    static func cachedFaces(family: String) -> FontFaces? {
        guard let dir = directory(family: family) else { return nil }
        let fm = FileManager.default
        guard fm.fileExists(atPath: dir.appendingPathComponent(completeMarker).path),
              let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return nil }
        var names: [Int: String] = [:]
        for file in files where file.pathExtension == "ttf" {
            guard let weight = Int(file.deletingPathExtension().lastPathComponent),
                  let name = register(file) else { continue }
            names[weight] = name
        }
        return names.isEmpty ? nil : FontFaces(names: names)
    }

    /// Downloads every weight of a family, then registers it.
    static func download(family: String, weights: [Int]) async throws -> FontFaces {
        let query = family.replacingOccurrences(of: " ", with: "+")
        let wght = weights.map { String($0) }.joined(separator: ";")
        guard let cssURL = URL(string: "https://fonts.googleapis.com/css2?family=\(query):wght@\(wght)"),
              let base = root, let dir = directory(family: family) else { throw URLError(.badURL) }
        var request = URLRequest(url: cssURL)
        // A non-browser agent gets TrueType files, which Core Text registers directly.
        request.setValue("PaperMap-iOS", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let css = String(data: data, encoding: .utf8) else { throw URLError(.badServerResponse) }
        let faces = parseFaces(css)
        guard !faces.isEmpty else { throw URLError(.cannotParseResponse) }

        let fm = FileManager.default
        try? fm.removeItem(at: dir)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        // Re-downloadable, so kept out of iCloud backups.
        var baseURL = base
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? baseURL.setResourceValues(values)

        for face in faces {
            let (file, res) = try await URLSession.shared.data(from: face.url)
            guard (res as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            try file.write(to: dir.appendingPathComponent("\(face.weight).ttf"), options: .atomic)
        }
        try Data().write(to: dir.appendingPathComponent(completeMarker), options: .atomic)
        guard let result = cachedFaces(family: family) else { throw URLError(.cannotDecodeContentData) }
        return result
    }

    /// (weight, file URL) for each @font-face block of a css2 response.
    static func parseFaces(_ css: String) -> [(weight: Int, url: URL)] {
        var result: [(weight: Int, url: URL)] = []
        for block in css.components(separatedBy: "@font-face").dropFirst() {
            guard let weightText = firstMatch(#"font-weight:\s*(\d+)"#, in: block),
                  let weight = Int(weightText),
                  let link = firstMatch(#"url\((https://[^)\s]+)\)"#, in: block),
                  let url = URL(string: link) else { continue }
            result.append((weight: weight, url: url))
        }
        return result
    }

    private static func firstMatch(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else { return nil }
        return String(text[range])
    }

    /// Registers a font file for this process; returns its PostScript name.
    private static func register(_ url: URL) -> String? {
        lock.lock()
        defer { lock.unlock() }
        if let name = registered[url.path] { return name }
        guard let provider = CGDataProvider(url: url as CFURL),
              let cgFont = CGFont(provider),
              let cfName = cgFont.postScriptName else { return nil }
        let name = cfName as String
        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
            _ = error?.takeRetainedValue()
            // Already registered (same face from an earlier file) still resolves by name.
            guard UIFont(name: name, size: 12) != nil else { return nil }
        }
        registered[url.path] = name
        return name
    }
}
