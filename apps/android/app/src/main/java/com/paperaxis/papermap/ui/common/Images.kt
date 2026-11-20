// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.common

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.roundToInt

/** Image bytes ready for a multipart upload. */
class UploadImage(val bytes: ByteArray, val mime: String)

/**
 * Reads a picked image, scales it to at most [maxSide] px and re-encodes it as
 * JPEG (or PNG when [keepAlpha]), so HEIC or very large photos still pass the
 * server's jpg/png/webp, 5 MB check.
 */
suspend fun readImageForUpload(context: Context, uri: Uri, maxSide: Int, keepAlpha: Boolean = false): UploadImage =
    withContext(Dispatchers.IO) {
        val bitmap = decode(context, uri, maxSide) ?: throw IOException("Görsel okunamadı")
        val out = ByteArrayOutputStream()
        if (keepAlpha) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
            UploadImage(out.toByteArray(), "image/png")
        } else {
            bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out)
            UploadImage(out.toByteArray(), "image/jpeg")
        }
    }

private fun decode(context: Context, uri: Uri, maxSide: Int): Bitmap? {
    if (Build.VERSION.SDK_INT >= 28) {
        // ImageDecoder applies EXIF rotation and decodes HEIF.
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            val w = info.size.width
            val h = info.size.height
            val scale = maxSide.toFloat() / max(w, h)
            if (scale < 1f) decoder.setTargetSize((w * scale).roundToInt(), (h * scale).roundToInt())
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    }
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    val decoded = resolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: return null
    val scale = maxSide.toFloat() / max(decoded.width, decoded.height)
    if (scale >= 1f) return decoded
    return Bitmap.createScaledBitmap(
        decoded,
        (decoded.width * scale).roundToInt(),
        (decoded.height * scale).roundToInt(),
        true,
    )
}
