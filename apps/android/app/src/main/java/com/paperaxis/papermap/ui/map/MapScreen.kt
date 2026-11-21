// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.paperaxis.papermap.data.HistoryPoint
import com.paperaxis.papermap.data.Meeting
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.Place
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.location.hasLocationPermission
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.AppIcon
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.Lucide
import com.paperaxis.papermap.ui.common.LucideIcon
import com.paperaxis.papermap.ui.theme.LocalDarkTheme
import java.time.Instant
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

/** Bundled style for a variant (light, dark, terrain, night, satellite); see apps/shared. */
private fun loadStyleJson(context: Context, variant: String): String =
    runCatching { context.assets.open("map-style-$variant.json") }
        .getOrElse { context.assets.open("map-style-light.json") }
        .bufferedReader().use { it.readText() }

private enum class Panel { People, Geofences, Places, Meetings }

private enum class Placing { Geofence, Place, Meeting }

/** Something tapped on the map, shown in a bottom sheet. */
private sealed interface Selection {
    data class OfPeer(val userId: String) : Selection
    data object Me : Selection
    data class OfPlace(val place: Place) : Selection
    data class OfMeeting(val meeting: Meeting) : Selection
}

/** "1s 20dk" left of timed sharing, or null when unlimited / expired (web shareLabel). */
private fun sharingLeft(until: String?, now: Long): String? {
    val end = runCatching { Instant.parse(until) }.getOrNull()?.toEpochMilli() ?: return null
    val ms = end - now
    if (ms <= 0) return null
    val mins = Math.round(ms / 60000.0).toInt()
    val h = mins / 60
    val m = mins % 60
    return (if (h > 0) "${h}s " else "") + "${m}dk"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(vm: AppViewModel, user: User, mapVm: MapViewModel = viewModel()) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val dark = LocalDarkTheme.current
    val accent = MaterialTheme.colorScheme.primary
    val peers by vm.peers.collectAsStateWithLifecycle()
    val me by vm.myLocation.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val unreadNotifications by vm.unreadNotifications.collectAsStateWithLifecycle()
    val mapFocus by vm.mapFocus.collectAsStateWithLifecycle()

    val geofences by mapVm.geofences.collectAsStateWithLifecycle()
    val places by mapVm.places.collectAsStateWithLifecycle()
    val meetings by mapVm.meetings.collectAsStateWithLifecycle()
    val candidates by mapVm.candidates.collectAsStateWithLifecycle()
    val myTrip by mapVm.myTrip.collectAsStateWithLifecycle()
    val peerTrips by mapVm.peerTrips.collectAsStateWithLifecycle()
    val history by mapVm.history.collectAsStateWithLifecycle()
    val sos by mapVm.sos.collectAsStateWithLifecycle()
    val locationRequest by mapVm.locationRequest.collectAsStateWithLifecycle()
    val notice by mapVm.notice.collectAsStateWithLifecycle()
    val layers by mapVm.layers.collectAsStateWithLifecycle()
    val expandedMeeting by mapVm.expandedMeeting.collectAsStateWithLifecycle()
    val meetingDetail by mapVm.meetingDetail.collectAsStateWithLifecycle()
    val mapBusy by mapVm.busy.collectAsStateWithLifecycle()

    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var style by remember { mutableStateOf<Style?>(null) }
    var styleVariant by remember { mutableStateOf<String?>(null) }
    var styleChoice by remember { mutableStateOf(loadMapStyleChoice(context)) }
    var bearing by remember { mutableDoubleStateOf(0.0) }
    var selection by remember { mutableStateOf<Selection?>(null) }
    var panel by remember { mutableStateOf<Panel?>(null) }
    var layersMenu by remember { mutableStateOf(false) }
    var placing by remember { mutableStateOf<Placing?>(null) }
    var pending by remember { mutableStateOf<Pair<Placing, LatLng>?>(null) }
    var shareMenu by remember { mutableStateOf(false) }
    var sosConfirm by remember { mutableStateOf(false) }
    var sosBusy by remember { mutableStateOf(false) }
    var centeredOnce by remember { mutableStateOf(false) }
    var permissionGranted by remember { mutableStateOf(hasLocationPermission(context)) }
    var backgroundGranted by remember { mutableStateOf(hasBackgroundPermission(context)) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var playIndex by remember { mutableIntStateOf(0) }
    var playing by remember { mutableStateOf(false) }

    // Marker images per user: the key that was drawn, and loaded profile photos by path.
    val iconKeys = remember { mutableMapOf<String, String>() }
    val photos = remember { mutableStateMapOf<String, Bitmap>() }
    val markerPx = with(density) { 44.dp.roundToPx() }

    LaunchedEffect(user.id) { mapVm.start(user.id) }
    LaunchedEffect(Unit) { mapVm.messages.collect { vm.showMessage(it) } }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        permissionGranted = result.values.any { it } || hasLocationPermission(context)
        // Re-read the user so the location service starts now that it may run.
        if (permissionGranted && user.sharingEnabled) vm.refreshMe()
    }
    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { backgroundGranted = it }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    fun askPermissions() {
        if (!permissionGranted) {
            permissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            )
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun turnSharingOn(minutes: Int?) {
        askPermissions()
        vm.setSharing(true, minutes)
    }

    // Timed sharing: refresh the remaining label; re-read the user once it runs out.
    LaunchedEffect(user.sharingEnabled, user.sharingUntil) {
        if (!user.sharingEnabled || user.sharingUntil == null) return@LaunchedEffect
        while (true) {
            now = System.currentTimeMillis()
            if (sharingLeft(user.sharingUntil, now) == null) {
                vm.refreshMe()
                break
            }
            delay(30_000)
        }
    }

    // Map view with lifecycle forwarding.
    val lifecycleOwner = LocalLifecycleOwner.current
    val mapView = remember {
        MapView(context).apply { onCreate(null) }
    }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> mapView.onStart()
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                Lifecycle.Event.ON_STOP -> mapView.onStop()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onStop()
            mapView.onDestroy()
        }
    }

    // Foreground location updates while this screen is visible.
    DisposableEffect(permissionGranted, lifecycleOwner) {
        if (!permissionGranted) return@DisposableEffect onDispose { }
        val fused = LocationServices.getFusedLocationProviderClient(context)
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { vm.onForegroundLocation(it) }
            }
        }
        @SuppressLint("MissingPermission")
        fun start() {
            val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
                .setMinUpdateIntervalMillis(5_000L)
                .build()
            runCatching { fused.requestLocationUpdates(req, callback, Looper.getMainLooper()) }
        }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> start()
                Lifecycle.Event.ON_PAUSE -> fused.removeLocationUpdates(callback)
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) start()
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            fused.removeLocationUpdates(callback)
        }
    }

    // Load (or reload, when the theme or the chosen map style changes) the map
    // style with every overlay.
    val variant = styleChoice.variant(dark)
    LaunchedEffect(map, variant) {
        val m = map ?: return@LaunchedEffect
        if (styleVariant == variant) return@LaunchedEffect
        styleVariant = variant
        style = null
        iconKeys.clear()
        val accentHex = String.format("#%06X", 0xFFFFFF and accent.toArgb())
        m.setStyle(Style.Builder().fromJson(loadStyleJson(context, variant))) { s ->
            addOverlayLayers(s, isDarkVariant(variant), accentHex)
            style = s
        }
    }

    // Profile photos for markers, loaded once per path.
    val wantedPhotos = (peers.values.map { it.avatarPath } + user.avatarPath).filterNotNull().toSet()
    LaunchedEffect(wantedPhotos) {
        wantedPhotos.filter { it !in photos }.forEach { path ->
            launch { loadAvatarPhoto(context, path, markerPx)?.let { photos[path] = it } }
        }
    }

    fun ensureIcon(s: Style, iconId: String, name: String, color: String?, path: String?) {
        val photo = path?.let { photos[it] }
        val key = "$name|$color|$path|${photo != null}"
        if (iconKeys[iconId] == key) return
        s.addImage(iconId, avatarMarker(name, color, photo, markerPx))
        iconKeys[iconId] = key
    }

    // Peers.
    LaunchedEffect(style, peers, photos.size) {
        val s = style ?: return@LaunchedEffect
        val features = peers.values.map { p ->
            ensureIcon(s, peerIcon(p.userId), p.displayName, p.avatarColor, p.avatarPath)
            Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat)).apply {
                addStringProperty("id", p.userId)
                addStringProperty("name", p.displayName)
                addStringProperty("icon", peerIcon(p.userId))
            }
        }
        s.getSourceAs<GeoJsonSource>(PEERS_SOURCE)?.setGeoJson(FeatureCollection.fromFeatures(features))
    }
    // Own position with the own avatar.
    LaunchedEffect(style, me, user.displayName, user.avatarColor, user.avatarPath, photos.size) {
        val s = style ?: return@LaunchedEffect
        val loc = me ?: return@LaunchedEffect
        ensureIcon(s, ME_ICON, user.displayName, user.avatarColor, user.avatarPath)
        s.getSourceAs<GeoJsonSource>(ME_SOURCE)?.setGeoJson(
            Feature.fromGeometry(Point.fromLngLat(loc.longitude, loc.latitude)),
        )
        if (!centeredOnce) {
            centeredOnce = true
            map?.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(loc.latitude, loc.longitude), 15.0))
        }
    }
    LaunchedEffect(style, geofences) {
        style?.getSourceAs<GeoJsonSource>(GEOFENCES_SOURCE)?.setGeoJson(geofencesCollection(geofences))
    }
    LaunchedEffect(style, places) {
        style?.getSourceAs<GeoJsonSource>(PLACES_SOURCE)?.setGeoJson(placesCollection(places))
    }
    LaunchedEffect(style, meetings) {
        style?.getSourceAs<GeoJsonSource>(MEETINGS_SOURCE)?.setGeoJson(meetingsCollection(meetings))
    }
    LaunchedEffect(style, layers) {
        style?.let { applyLayerVisibility(it, layers) }
    }

    // History trail and playback.
    LaunchedEffect(history) {
        playIndex = 0
        playing = false
    }
    LaunchedEffect(style, history) {
        style?.getSourceAs<GeoJsonSource>(HISTORY_SOURCE)?.setGeoJson(historyCollection(history?.points.orEmpty()))
    }
    LaunchedEffect(style, history, playIndex) {
        val src = style?.getSourceAs<GeoJsonSource>(PLAYBACK_SOURCE) ?: return@LaunchedEffect
        val p = history?.points?.getOrNull(playIndex)
        src.setGeoJson(
            if (p == null) FeatureCollection.fromFeatures(emptyList<Feature>())
            else FeatureCollection.fromFeature(Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat))),
        )
    }
    LaunchedEffect(playing) {
        val count = history?.points?.size ?: 0
        while (playing && playIndex < count - 1) {
            delay(600)
            playIndex += 1
        }
        playing = false
    }

    // "Haritada göster" from a chat place message.
    LaunchedEffect(map, mapFocus) {
        val m = map ?: return@LaunchedEffect
        val f = mapFocus ?: return@LaunchedEffect
        centeredOnce = true
        m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(f.lat, f.lng), 16.0))
        vm.consumeMapFocus()
    }

    fun flyTo(lat: Double, lng: Double) {
        map?.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 16.0))
    }

    fun showHistory(userId: String, name: String) {
        panel = null
        selection = null
        mapVm.showHistory(userId, name) { points -> fitPoints(map, points) }
    }

    // Map taps: pick a point while placing, otherwise open what was tapped.
    val onMapClick by rememberUpdatedState { latLng: LatLng ->
        val mode = placing
        if (mode != null) {
            placing = null
            if (mode == Placing.Meeting) mapVm.loadCandidates()
            pending = mode to latLng
            true
        } else {
            val m = map
            if (m == null) {
                false
            } else {
                val point = m.projection.toScreenLocation(latLng)
                val hit = m.queryRenderedFeatures(point, PEERS_LAYER, ME_LAYER, MEETINGS_LAYER, PLACES_LAYER).firstOrNull()
                val id = hit?.getStringProperty("id")
                val layerSource = hit?.let { f ->
                    when {
                        f.hasProperty("icon") -> PEERS_SOURCE
                        id == null -> ME_SOURCE
                        meetings.any { it.id == id } -> MEETINGS_SOURCE
                        else -> PLACES_SOURCE
                    }
                }
                selection = when (layerSource) {
                    PEERS_SOURCE -> id?.let { Selection.OfPeer(it) }
                    ME_SOURCE -> Selection.Me
                    MEETINGS_SOURCE -> meetings.firstOrNull { it.id == id }?.let { Selection.OfMeeting(it) }
                    PLACES_SOURCE -> places.firstOrNull { it.id == id }?.let { Selection.OfPlace(it) }
                    else -> null
                }
                selection != null
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = {
                mapView.apply {
                    getMapAsync { m ->
                        // Built-in compass is replaced by CompassButton (bottom-left, next to the style picker).
                        m.uiSettings.isCompassEnabled = false
                        m.uiSettings.isAttributionEnabled = true
                        m.uiSettings.isLogoEnabled = false
                        // z16 tile'lari z22'ye kadar buyutulur (web/src/lib/mapStyle.js MAP_MAX_ZOOM).
                        m.setMaxZoomPreference(22.0)
                        m.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(39.0, 35.0), 5.0))
                        m.addOnMapClickListener { onMapClick(it) }
                        m.addOnCameraMoveListener { bearing = m.cameraPosition.bearing }
                        m.addOnCameraIdleListener { bearing = m.cameraPosition.bearing }
                        map = m
                    }
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        Column(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.weight(1f)) {
                    SharingCard(
                        enabled = user.sharingEnabled,
                        left = if (user.sharingEnabled) sharingLeft(user.sharingUntil, now) else null,
                        busy = busy,
                        onToggle = { on -> if (on) shareMenu = true else vm.setSharing(false) },
                    )
                }
                Spacer(Modifier.width(8.dp))
                NotificationBell(unreadNotifications) { vm.openNotifications() }
            }
            if (!permissionGranted) {
                InfoCard(
                    text = "Haritada kendini görmek ve konum paylaşmak için konum izni gerekli.",
                    action = "İzin ver",
                ) {
                    permissionLauncher.launch(
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                    )
                }
            } else if (user.sharingEnabled && !backgroundGranted && Build.VERSION.SDK_INT >= 29) {
                InfoCard(
                    text = "Uygulama kapalıyken de paylaşmak için konum iznini \"Her zaman izin ver\" yap.",
                    action = "Ayarla",
                ) {
                    backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                }
            }
            sos?.let { e ->
                SosBanner(e, onShow = { if (e.lat != null && e.lng != null) flyTo(e.lat, e.lng) }, onClose = mapVm::dismissSos)
            }
            notice?.let { MapBanner(it) { TextButton(onClick = mapVm::dismissNotice) { Text("Kapat") } } }
            myTrip?.let { t ->
                MapBanner("${t.destLabel} hedefine gidiyorsun" + (t.etaMinutes?.let { " · ~$it dk" } ?: "")) {
                    TextButton(onClick = mapVm::cancelTrip) { Text("İptal") }
                }
            }
            locationRequest?.let { r ->
                MapBanner("${r.fromName} konumunu istiyor.") {
                    if (!user.sharingEnabled) {
                        TextButton(onClick = {
                            turnSharingOn(null)
                            mapVm.dismissLocationRequest()
                        }) { Text("Paylaşımı aç") }
                    }
                    TextButton(onClick = mapVm::dismissLocationRequest) { Text("Kapat") }
                }
            }
            history?.let { h ->
                val count = if (h.points.isNotEmpty()) " (${h.points.size} nokta)" else " — kayıt yok"
                MapBanner("${h.name} · son 30 günlük konum geçmişi$count") {
                    TextButton(onClick = mapVm::closeHistory) { Text("Kapat") }
                }
            }
            placing?.let { mode ->
                val text = when (mode) {
                    Placing.Geofence -> "Alanın merkezi için haritada bir noktaya dokunun…"
                    Placing.Place -> "Yeni yer için haritada bir noktaya dokunun…"
                    Placing.Meeting -> "Buluşma noktası için haritada bir noktaya dokunun…"
                }
                MapBanner(text) { TextButton(onClick = { placing = null }) { Text("İptal") } }
            }
        }

        // Bottom-left: map style picker and compass, right above the SOS button.
        Column(
            modifier = Modifier.align(Alignment.BottomStart).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MapStylePicker(styleChoice) { choice ->
                    styleChoice = choice
                    saveMapStyleChoice(context, choice)
                }
                CompassButton(bearing) {
                    val m = map ?: return@CompassButton
                    m.animateCamera(
                        CameraUpdateFactory.newCameraPosition(
                            CameraPosition.Builder(m.cameraPosition).bearing(0.0).tilt(0.0).build(),
                        ),
                    )
                }
            }
            ExtendedFloatingActionButton(
                onClick = { sosConfirm = true },
                containerColor = SosRed,
                contentColor = Color.White,
                icon = { AppIcon(Lucide.TriangleAlert, contentDescription = null) },
                text = { Text("SOS") },
            )
        }

        Column(
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.End,
        ) {
            Box {
                SmallFloatingActionButton(onClick = { layersMenu = true }) {
                    AppIcon(Lucide.Layers, contentDescription = "Katmanlar menüsü")
                }
                DropdownMenu(expanded = layersMenu, onDismissRequest = { layersMenu = false }) {
                    LayerItem(Lucide.Users, "Kişiler", peers.size, layers.people,
                        onToggle = { mapVm.setLayers(layers.copy(people = it)) },
                        onOpen = { layersMenu = false; panel = Panel.People })
                    LayerItem(Lucide.Radius, "Alanlar", geofences.size, layers.geofences,
                        onToggle = { mapVm.setLayers(layers.copy(geofences = it)) },
                        onOpen = { layersMenu = false; mapVm.loadCandidates(); panel = Panel.Geofences })
                    LayerItem(Lucide.Star, "Yerler", places.size, layers.places,
                        onToggle = { mapVm.setLayers(layers.copy(places = it)) },
                        onOpen = { layersMenu = false; panel = Panel.Places })
                    LayerItem(Lucide.Calendar, "Buluşmalar", meetings.size, layers.meetings,
                        onToggle = { mapVm.setLayers(layers.copy(meetings = it)) },
                        onOpen = { layersMenu = false; panel = Panel.Meetings })
                }
            }
            if (peers.isNotEmpty()) {
                SmallFloatingActionButton(onClick = { fitAll(map, peers.values, me) }) {
                    Text("Tümü", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 8.dp))
                }
            }
            SmallFloatingActionButton(
                onClick = { me?.let { flyTo(it.latitude, it.longitude) } },
            ) {
                AppIcon(Lucide.LocateFixed, contentDescription = "Konumuma git")
            }
        }

        history?.takeIf { it.points.size > 1 }?.let { h ->
            Box(Modifier.align(Alignment.BottomCenter).padding(start = 12.dp, end = 12.dp, bottom = 168.dp)) {
                PlaybackBar(
                    count = h.points.size,
                    index = playIndex.coerceAtMost(h.points.size - 1),
                    playing = playing,
                    time = h.points.getOrNull(playIndex)?.recordedAt,
                    onToggle = {
                        if (!playing && playIndex >= h.points.size - 1) playIndex = 0
                        playing = !playing
                    },
                    onSeek = {
                        playing = false
                        playIndex = it.coerceIn(0, h.points.size - 1)
                    },
                )
            }
        }
    }

    // Bottom sheets: tapped items and the layer panels.
    when (val sel = selection) {
        is Selection.OfPeer -> peers[sel.userId]?.let { p ->
            ModalBottomSheet(onDismissRequest = { selection = null }) {
                PeerDetail(
                    p,
                    trip = peerTrips[p.userId]?.let(::tripLabel),
                    onFocus = { flyTo(p.lat, p.lng); selection = null },
                    onHistory = { showHistory(p.userId, p.displayName) },
                    onProfile = { selection = null; vm.openUserProfile(p.userId) },
                )
            }
        }
        Selection.Me -> ModalBottomSheet(onDismissRequest = { selection = null }) {
            MeDetail(user, onHistory = { showHistory(user.id, "Senin") })
        }
        is Selection.OfPlace -> ModalBottomSheet(onDismissRequest = { selection = null }) {
            PanelBody(sel.place.name, onClose = { selection = null }) {
                Button(onClick = { mapVm.startTrip(sel.place); selection = null }, enabled = !mapBusy) { Text("Yola çık") }
            }
        }
        is Selection.OfMeeting -> ModalBottomSheet(onDismissRequest = { selection = null }) {
            PanelBody(sel.meeting.label, onClose = { selection = null }) {
                Text("Buluşma noktası", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = {
                    selection = null
                    mapVm.expandMeeting(sel.meeting.id)
                    panel = Panel.Meetings
                }) { Text("Detay") }
            }
        }
        null -> Unit
    }

    panel?.let { open ->
        ModalBottomSheet(onDismissRequest = { panel = null }) {
            when (open) {
                Panel.People -> PeoplePanel(
                    peers = peers.values.sortedBy { it.displayName },
                    trips = peerTrips,
                    onClose = { panel = null },
                    onMyHistory = { showHistory(user.id, "Senin") },
                    onSelect = { p -> panel = null; flyTo(p.lat, p.lng); selection = Selection.OfPeer(p.userId) },
                    onHistory = { p -> showHistory(p.userId, p.displayName) },
                )
                Panel.Geofences -> GeofencePanel(
                    geofences = geofences,
                    candidates = candidates,
                    busy = mapBusy,
                    onClose = { panel = null },
                    onStartPlacing = { panel = null; placing = Placing.Geofence },
                    onFocus = { g -> panel = null; flyTo(g.lat, g.lng) },
                    onSave = mapVm::updateGeofence,
                    onDelete = { mapVm.deleteGeofence(it.id) },
                    onAddWatches = { g, ids, done -> mapVm.addWatches(g.id, ids, done) },
                    onRemoveWatch = { g, uid -> mapVm.removeWatch(g.id, uid) },
                )
                Panel.Places -> PlacesPanel(
                    places = places,
                    busy = mapBusy,
                    onClose = { panel = null },
                    onStartPlacing = { panel = null; placing = Placing.Place },
                    onFocus = { p -> panel = null; flyTo(p.lat, p.lng); selection = Selection.OfPlace(p) },
                    onNavigate = { p -> panel = null; mapVm.startTrip(p) },
                    onSave = { p, name, color, done -> mapVm.updatePlace(p.id, name, color, done) },
                    onDelete = { mapVm.deletePlace(it.id) },
                )
                Panel.Meetings -> MeetingsPanel(
                    meetings = meetings,
                    expandedId = expandedMeeting,
                    detail = meetingDetail,
                    busy = mapBusy,
                    onClose = { panel = null; mapVm.expandMeeting(null) },
                    onStartPlacing = { panel = null; placing = Placing.Meeting },
                    onFocus = { mt -> panel = null; flyTo(mt.lat, mt.lng); selection = Selection.OfMeeting(mt) },
                    onExpand = mapVm::expandMeeting,
                    onDelete = { mapVm.deleteMeeting(it.id) },
                    onLeave = { mapVm.leaveMeeting(it.id) },
                )
            }
        }
    }

    pending?.let { (mode, point) ->
        val close = { pending = null }
        when (mode) {
            Placing.Geofence -> NewGeofenceDialog(mapBusy, onDismiss = close) { name, radius ->
                mapVm.createGeofence(name, point.latitude, point.longitude, radius, close)
            }
            Placing.Place -> NewPlaceDialog(mapBusy, onDismiss = close) { name, color ->
                mapVm.createPlace(name, point.latitude, point.longitude, color, close)
            }
            Placing.Meeting -> NewMeetingDialog(candidates, mapBusy, onDismiss = close) { name, ids ->
                mapVm.createMeeting(name, point.latitude, point.longitude, ids) {
                    close()
                    panel = Panel.Meetings
                }
            }
        }
    }

    if (shareMenu) {
        ShareDurationDialog(
            onPick = { minutes ->
                shareMenu = false
                turnSharingOn(minutes)
            },
            onDismiss = { shareMenu = false },
        )
    }
    if (sosConfirm) {
        SosConfirmDialog(
            busy = sosBusy,
            onSend = {
                sosBusy = true
                mapVm.sendSos {
                    sosBusy = false
                    sosConfirm = false
                }
            },
            onDismiss = { sosConfirm = false },
        )
    }
}

@Composable
private fun LayerItem(
    icon: LucideIcon,
    label: String,
    count: Int,
    visible: Boolean,
    onToggle: (Boolean) -> Unit,
    onOpen: () -> Unit,
) {
    DropdownMenuItem(
        leadingIcon = { AppIcon(icon, contentDescription = null) },
        text = { Text("$label  $count") },
        trailingIcon = {
            Checkbox(checked = visible, onCheckedChange = onToggle)
        },
        onClick = onOpen,
    )
}

@Composable
private fun SharingCard(enabled: Boolean, left: String?, busy: Boolean, onToggle: (Boolean) -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Konum paylaşımı", style = MaterialTheme.typography.titleMedium)
                Text(
                    when {
                        left != null -> "Paylaşım: $left"
                        enabled -> "Açık: arkadaşların ve ailen seni görebilir"
                        else -> "Kapalı: kimse seni göremez"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = enabled, onCheckedChange = onToggle, enabled = !busy)
        }
    }
}

@Composable
private fun NotificationBell(unread: Int, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        IconButton(onClick = onClick) {
            if (unread > 0) {
                BadgedBox(badge = { Badge() }) {
                    AppIcon(Lucide.Bell, contentDescription = "Bildirimler, $unread okunmamış")
                }
            } else {
                AppIcon(Lucide.Bell, contentDescription = "Bildirimler")
            }
        }
    }
}

@Composable
private fun InfoCard(text: String, action: String, onAction: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            TextButton(onClick = onAction) { Text(action) }
        }
    }
}

@Composable
private fun PeerDetail(peer: Peer, trip: String?, onFocus: () -> Unit, onHistory: () -> Unit, onProfile: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(peer.displayName, peer.avatarColor, size = 52.dp, imagePath = peer.avatarPath)
            Spacer(Modifier.width(16.dp))
            Column {
                Text(peer.displayName, style = MaterialTheme.typography.titleLarge)
                if (!peer.statusText.isNullOrBlank()) {
                    Text(peer.statusText, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        val updated = com.paperaxis.papermap.ui.common.relativeTime(peer.updatedAt)
        if (updated.isNotEmpty()) DetailLine("Son güncelleme", updated)
        peer.battery?.let { DetailLine("Pil", com.paperaxis.papermap.ui.common.batteryLabel(it, peer.charging).removePrefix("Pil ")) }
        peer.accuracy?.let { DetailLine("Doğruluk", "${it.toInt()} m") }
        trip?.let { DetailLine("Yolculuk", it.removePrefix("→ ")) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = onFocus, modifier = Modifier.fillMaxWidth()) { Text("Haritada göster") }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            OutlinedButton(onClick = onHistory, modifier = Modifier.weight(1f)) { Text("Konum geçmişi") }
            OutlinedButton(onClick = onProfile, modifier = Modifier.weight(1f)) { Text("Profil") }
        }
    }
}

@Composable
private fun MeDetail(user: User, onHistory: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(user.displayName, user.avatarColor, size = 52.dp, imagePath = user.avatarPath)
            Spacer(Modifier.width(16.dp))
            Column {
                Text("Sen", style = MaterialTheme.typography.titleLarge)
                if (!user.statusText.isNullOrBlank()) Text(user.statusText, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = onHistory, modifier = Modifier.fillMaxWidth()) { Text("Konum geçmişim") }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

private fun fitPoints(map: MapLibreMap?, points: List<HistoryPoint>) {
    val m = map ?: return
    if (points.isEmpty()) return
    if (points.size == 1) {
        m.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(points[0].lat, points[0].lng), 16.0))
        return
    }
    val bounds = LatLngBounds.Builder().includes(points.map { LatLng(it.lat, it.lng) }).build()
    m.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 120))
}

private fun fitAll(map: MapLibreMap?, peers: Collection<Peer>, me: android.location.Location?) {
    val m = map ?: return
    val points = peers.map { LatLng(it.lat, it.lng) } + listOfNotNull(me?.let { LatLng(it.latitude, it.longitude) })
    if (points.isEmpty()) return
    if (points.size == 1) {
        m.animateCamera(CameraUpdateFactory.newLatLngZoom(points[0], 14.0))
        return
    }
    val bounds = LatLngBounds.Builder().includes(points).build()
    m.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 120))
}

private fun hasBackgroundPermission(context: Context): Boolean =
    Build.VERSION.SDK_INT < 29 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
