// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI
import UIKit

/// Shown at the top of every screen while the device has no connection.
struct OfflineBanner: View {
    var body: some View {
        Label("Çevrimdışısın — internet bağlantısı bekleniyor…", systemImage: "wifi.slash")
            .font(.footnote.weight(.medium))
            .foregroundColor(Color(uiColor: .systemBackground))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .padding(.horizontal, 16)
            .background(Color(uiColor: .label))
            .accessibilityAddTraits(.updatesFrequently)
    }
}
