// Copyright (c) 2026 PaperAxis. All rights reserved.

import UIKit

/// Prepares picked photos for upload: the server accepts jpg/png/webp up to 5 MB,
/// while the photo library hands out HEIC and full-resolution images.
enum ImageUpload {
    /// Re-encodes any decodable image as JPEG, downscaled so the longest edge is
    /// at most `maxPixels`. Nil when the data is not an image.
    static func jpeg(from data: Data, maxPixels: CGFloat) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let pixelW = image.size.width * image.scale
        let pixelH = image.size.height * image.scale
        let longest = max(pixelW, pixelH)
        let factor = longest > maxPixels ? maxPixels / longest : 1
        let target = CGSize(width: max(1, (pixelW * factor).rounded()), height: max(1, (pixelH * factor).rounded()))

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: target))
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        var quality: CGFloat = 0.85
        var out = rendered.jpegData(compressionQuality: quality)
        while let d = out, d.count > 4_500_000, quality > 0.4 {
            quality -= 0.15
            out = rendered.jpegData(compressionQuality: quality)
        }
        return out
    }

    /// PNG with transparency kept (logos), downscaled like `jpeg`. Nil when the
    /// data is not an image or the result exceeds the server's 5 MB limit.
    static func png(from data: Data, maxPixels: CGFloat) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let pixelW = image.size.width * image.scale
        let pixelH = image.size.height * image.scale
        let longest = max(pixelW, pixelH)
        let factor = longest > maxPixels ? maxPixels / longest : 1
        let target = CGSize(width: max(1, (pixelW * factor).rounded()), height: max(1, (pixelH * factor).rounded()))

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        guard let out = rendered.pngData(), out.count <= 5_000_000 else { return nil }
        return out
    }
}

/// Small in-memory cache for remote images used outside SwiftUI (map markers).
@MainActor
final class RemoteImageCache {
    static let shared = RemoteImageCache()
    private let cache = NSCache<NSURL, UIImage>()

    func cached(_ url: URL) -> UIImage? {
        cache.object(forKey: url as NSURL)
    }

    func load(_ url: URL) async -> UIImage? {
        if let hit = cached(url) { return hit }
        guard let result = try? await URLSession.shared.data(from: url),
              let status = (result.1 as? HTTPURLResponse)?.statusCode, (200..<300).contains(status),
              let image = UIImage(data: result.0) else { return nil }
        cache.setObject(image, forKey: url as NSURL)
        return image
    }
}
