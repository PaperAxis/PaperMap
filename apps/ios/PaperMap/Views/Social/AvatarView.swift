// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI
import UIKit

/// Profile photo when available, otherwise initials on the avatar color.
struct AvatarView: View {
    let name: String
    let color: String?
    let path: String?
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(Color(UIColor(hex: color) ?? UIColor(hex: "#315BDB")!))
            Text(Format.initials(name))
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundColor(.white)
            if let url = Config.uploadURL(path) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    }
                }
                .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Profile banner image (or a plain surface) with the avatar overlapping its lower edge.
struct ProfileBanner: View {
    let name: String
    let color: String?
    let avatarPath: String?
    let bannerPath: String?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            VStack(spacing: 0) {
                Group {
                    if let url = Config.uploadURL(bannerPath) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                Pa.surface
                            }
                        }
                    } else {
                        Pa.surface
                    }
                }
                .frame(height: 128)
                .frame(maxWidth: .infinity)
                .clipped()
                Color.clear.frame(height: 40)
            }
            AvatarView(name: name, color: color, path: avatarPath, size: 80)
                .overlay(Circle().stroke(Pa.bg, lineWidth: 4))
                .padding(.leading, 16)
        }
        .accessibilityHidden(true)
    }
}
