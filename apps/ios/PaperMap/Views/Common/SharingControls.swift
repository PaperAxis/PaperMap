// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI
import UIKit

enum SharingText {
    /// Short state line, as on the web map: "Paylaşım kapalı", "Paylaşım: 1s 20dk", "Paylaşım açık".
    static func label(for user: User?, now: Date = Date()) -> String {
        guard let user, user.sharingEnabled else { return "Paylaşım kapalı" }
        if let until = Format.date(user.sharingUntil) {
            let ms = until.timeIntervalSince(now)
            guard ms > 0 else { return "Paylaşım süresi doldu" }
            let mins = Int((ms / 60).rounded())
            let h = mins / 60, m = mins % 60
            return h > 0 ? "Paylaşım: \(h)s \(m)dk" : "Paylaşım: \(m)dk"
        }
        return "Paylaşım açık"
    }
}

extension View {
    /// Duration choice shown before sharing is turned on (1 hour, 8 hours, unlimited).
    /// `onPick` receives minutes, nil for unlimited.
    func sharingDurationDialog(isPresented: Binding<Bool>, onPick: @escaping (Int?) -> Void) -> some View {
        confirmationDialog("Konum paylaşımını aç", isPresented: isPresented, titleVisibility: .visible) {
            Button("1 saat") { onPick(60) }
            Button("8 saat") { onPick(8 * 60) }
            Button("Süresiz") { onPick(nil) }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Ne kadar süreyle paylaşmak istersin?")
        }
    }
}

/// Opens this app's page in the Settings app (location permission).
@MainActor
func openAppSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
}
