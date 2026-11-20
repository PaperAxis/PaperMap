// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import androidx.core.graphics.drawable.toBitmap
import coil.imageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.paperaxis.papermap.data.Geofence
import com.paperaxis.papermap.data.HistoryPoint
import com.paperaxis.papermap.data.Meeting
import com.paperaxis.papermap.data.Place
import com.paperaxis.papermap.ui.common.uploadUrl
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.maps.Style
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point
import org.maplibre.geojson.Polygon
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

const val PEERS_SOURCE = "peers"
const val PEERS_LAYER = "peers-avatar"
const val ME_SOURCE = "me"
const val ME_LAYER = "me-avatar"
const val GEOFENCES_SOURCE = "geofences"
const val HISTORY_SOURCE = "history"
const val PLAYBACK_SOURCE = "playback"
const val PLACES_SOURCE = "places"
const val PLACES_LAYER = "places-circle"
const val MEETINGS_SOURCE = "meetings"
const val MEETINGS_LAYER = "meetings-circle"

const val ME_ICON = "avatar-me"

fun peerIcon(userId: String) = "avatar-$userId"

private val PEOPLE_LAYERS = listOf(PEERS_LAYER, "peers-name")
private val GEOFENCE_LAYERS = listOf("geofence-fill", "geofence-line", "geofence-name")
private val PLACE_LAYERS = listOf(PLACES_LAYER, "places-name")
private val MEETING_LAYERS = listOf(MEETINGS_LAYER, "meetings-name")

private fun emptyCollection() = FeatureCollection.fromFeatures(emptyList<Feature>())

/** Adds every overlay source and layer, bottom to top. Colours follow web MapView.jsx. */
fun addOverlayLayers(style: Style, dark: Boolean, accent: String) {
    listOf(GEOFENCES_SOURCE, HISTORY_SOURCE, PLAYBACK_SOURCE, PLACES_SOURCE, MEETINGS_SOURCE, ME_SOURCE, PEERS_SOURCE)
        .forEach { style.addSource(GeoJsonSource(it, emptyCollection())) }
    val text = if (dark) "#F5F3EE" else "#171918"
    val halo = if (dark) "#171918" else "#F5F3EE"

    style.addLayer(
        FillLayer("geofence-fill", GEOFENCES_SOURCE).withProperties(
            PropertyFactory.fillColor("#315bdb"),
            PropertyFactory.fillOpacity(0.13f),
        ),
    )
    style.addLayer(
        LineLayer("geofence-line", GEOFENCES_SOURCE).withProperties(
            PropertyFactory.lineColor("#315bdb"),
            PropertyFactory.lineWidth(2f),
            PropertyFactory.lineDasharray(arrayOf(2f, 1f)),
        ),
    )
    style.addLayer(
        SymbolLayer("geofence-name", GEOFENCES_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("name")),
            PropertyFactory.textFont(arrayOf("Noto Sans Regular")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textColor("#315bdb"),
            PropertyFactory.textHaloColor(halo),
            PropertyFactory.textHaloWidth(1.5f),
            PropertyFactory.textOptional(true),
        ),
    )
    style.addLayer(
        LineLayer("history-line", HISTORY_SOURCE).withProperties(
            PropertyFactory.lineColor("#f97316"),
            PropertyFactory.lineWidth(3f),
            PropertyFactory.lineOpacity(0.85f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND),
            PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        ).withFilter(Expression.eq(Expression.geometryType(), Expression.literal("LineString"))),
    )
    style.addLayer(
        CircleLayer("history-points", HISTORY_SOURCE).withProperties(
            PropertyFactory.circleRadius(4f),
            PropertyFactory.circleColor("#f97316"),
            PropertyFactory.circleStrokeColor("#ffffff"),
            PropertyFactory.circleStrokeWidth(1.5f),
        ).withFilter(Expression.eq(Expression.geometryType(), Expression.literal("Point"))),
    )
    style.addLayer(
        CircleLayer(PLACES_LAYER, PLACES_SOURCE).withProperties(
            PropertyFactory.circleRadius(9f),
            PropertyFactory.circleColor(Expression.toColor(Expression.get("color"))),
            PropertyFactory.circleStrokeColor("#ffffff"),
            PropertyFactory.circleStrokeWidth(2f),
        ),
    )
    style.addLayer(
        SymbolLayer("places-name", PLACES_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("name")),
            PropertyFactory.textFont(arrayOf("Noto Sans Regular")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textOffset(arrayOf(0f, 1.5f)),
            PropertyFactory.textColor(text),
            PropertyFactory.textHaloColor(halo),
            PropertyFactory.textHaloWidth(1.5f),
            PropertyFactory.textOptional(true),
        ),
    )
    style.addLayer(
        CircleLayer(MEETINGS_LAYER, MEETINGS_SOURCE).withProperties(
            PropertyFactory.circleRadius(11f),
            PropertyFactory.circleColor(accent),
            PropertyFactory.circleStrokeColor("#ffffff"),
            PropertyFactory.circleStrokeWidth(3f),
        ),
    )
    style.addLayer(
        SymbolLayer("meetings-name", MEETINGS_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("name")),
            PropertyFactory.textFont(arrayOf("Noto Sans Bold")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textOffset(arrayOf(0f, 1.7f)),
            PropertyFactory.textColor(text),
            PropertyFactory.textHaloColor(halo),
            PropertyFactory.textHaloWidth(1.5f),
            PropertyFactory.textOptional(true),
        ),
    )
    style.addLayer(
        SymbolLayer(ME_LAYER, ME_SOURCE).withProperties(
            PropertyFactory.iconImage(ME_ICON),
            PropertyFactory.iconAllowOverlap(true),
            PropertyFactory.iconIgnorePlacement(true),
        ),
    )
    style.addLayer(
        SymbolLayer(PEERS_LAYER, PEERS_SOURCE).withProperties(
            PropertyFactory.iconImage(Expression.get("icon")),
            PropertyFactory.iconAllowOverlap(true),
            PropertyFactory.iconIgnorePlacement(true),
        ),
    )
    style.addLayer(
        SymbolLayer("peers-name", PEERS_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("name")),
            PropertyFactory.textFont(arrayOf("Noto Sans Regular")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textOffset(arrayOf(0f, 2.2f)),
            PropertyFactory.textColor(text),
            PropertyFactory.textHaloColor(halo),
            PropertyFactory.textHaloWidth(1.5f),
            PropertyFactory.textOptional(true),
        ),
    )
    style.addLayer(
        CircleLayer("playback-dot", PLAYBACK_SOURCE).withProperties(
            PropertyFactory.circleRadius(8f),
            PropertyFactory.circleColor("#f97316"),
            PropertyFactory.circleStrokeColor("#ffffff"),
            PropertyFactory.circleStrokeWidth(3f),
        ),
    )
}

fun applyLayerVisibility(style: Style, layers: LayerVisibility) {
    fun set(ids: List<String>, visible: Boolean) {
        val v = PropertyFactory.visibility(if (visible) Property.VISIBLE else Property.NONE)
        ids.forEach { style.getLayer(it)?.setProperties(v) }
    }
    set(PEOPLE_LAYERS, layers.people)
    set(GEOFENCE_LAYERS, layers.geofences)
    set(PLACE_LAYERS, layers.places)
    set(MEETING_LAYERS, layers.meetings)
}

/** Circle polygon from a centre and a radius in metres (web lib/geojson.js). */
fun circlePolygon(lat: Double, lng: Double, radiusMeters: Double, points: Int = 64): Polygon {
    val earthR = 6371000.0
    val latR = (radiusMeters / earthR) * (180 / PI)
    val lngR = latR / cos(lat * PI / 180)
    val ring = (0..points).map { i ->
        val t = i.toDouble() / points * 2 * PI
        Point.fromLngLat(lng + lngR * cos(t), lat + latR * sin(t))
    }
    return Polygon.fromLngLats(listOf(ring))
}

fun geofencesCollection(list: List<Geofence>): FeatureCollection =
    FeatureCollection.fromFeatures(
        list.map { g ->
            Feature.fromGeometry(circlePolygon(g.lat, g.lng, g.radius)).apply {
                addStringProperty("id", g.id)
                addStringProperty("name", g.name)
            }
        },
    )

fun historyCollection(points: List<HistoryPoint>): FeatureCollection {
    val features = mutableListOf<Feature>()
    if (points.size > 1) {
        features += Feature.fromGeometry(LineString.fromLngLats(points.map { Point.fromLngLat(it.lng, it.lat) }))
    }
    points.forEach { features += Feature.fromGeometry(Point.fromLngLat(it.lng, it.lat)) }
    return FeatureCollection.fromFeatures(features)
}

fun placesCollection(list: List<Place>): FeatureCollection =
    FeatureCollection.fromFeatures(
        list.map { p ->
            Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat)).apply {
                addStringProperty("id", p.id)
                addStringProperty("name", p.name)
                addStringProperty("color", normalizeColor(p.color))
            }
        },
    )

fun meetingsCollection(list: List<Meeting>): FeatureCollection =
    FeatureCollection.fromFeatures(
        list.map { m ->
            Feature.fromGeometry(Point.fromLngLat(m.lng, m.lat)).apply {
                addStringProperty("id", m.id)
                addStringProperty("name", m.label)
            }
        },
    )

/** Keeps only "#RRGGBB" values so the colour expression never fails. */
fun normalizeColor(hex: String?): String =
    if (hex != null && Regex("^#[0-9a-fA-F]{6}$").matches(hex)) hex else "#315BDB"

/**
 * Round map marker: the profile photo when [photo] is given, otherwise the
 * first letter on the avatar colour (web MapView.jsx avatarElement), ringed in white.
 */
fun avatarMarker(name: String, color: String?, photo: Bitmap?, sizePx: Int): Bitmap {
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val r = sizePx / 2f
    val ring = sizePx * 0.07f
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color = 0x55000000
    canvas.drawCircle(r, r + ring * 0.4f, r - ring * 0.2f, paint)
    paint.color = android.graphics.Color.WHITE
    canvas.drawCircle(r, r, r - ring * 0.4f, paint)
    val inner = r - ring
    if (photo != null) {
        val shader = BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = (inner * 2) / min(photo.width, photo.height)
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate(r - photo.width * scale / 2, r - photo.height * scale / 2)
        }
        shader.setLocalMatrix(matrix)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader }
        canvas.drawCircle(r, r, inner, p)
    } else {
        paint.color = android.graphics.Color.parseColor(normalizeColor(color))
        canvas.drawCircle(r, r, inner, paint)
        val letter = name.trim().take(1).uppercase().ifEmpty { "?" }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = android.graphics.Color.WHITE
            textSize = inner * 0.95f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }
        val y = r - (textPaint.descent() + textPaint.ascent()) / 2
        canvas.drawText(letter, r, y, textPaint)
    }
    return bmp
}

/** Loads an uploaded avatar as a software bitmap for map markers; null on failure. */
suspend fun loadAvatarPhoto(context: Context, avatarPath: String?, sizePx: Int): Bitmap? {
    val url = uploadUrl(avatarPath) ?: return null
    val request = ImageRequest.Builder(context)
        .data(url)
        .size(sizePx)
        .allowHardware(false)
        .build()
    val result = context.imageLoader.execute(request) as? SuccessResult ?: return null
    return result.drawable.toBitmap()
}
