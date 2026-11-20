// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.ui.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.IconButton
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.paperaxis.papermap.ui.theme.LocalDarkTheme
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.paperaxis.papermap.data.Peer
import com.paperaxis.papermap.data.User
import com.paperaxis.papermap.location.hasLocationPermission
import com.paperaxis.papermap.ui.AppViewModel
import com.paperaxis.papermap.ui.common.Avatar
import com.paperaxis.papermap.ui.common.initials
import com.paperaxis.papermap.ui.common.relativeTime
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point

private const val PEERS_SOURCE = "peers"
private const val PEERS_CIRCLE = "peers-circle"
private const val ME_SOURCE = "me"

private fun loadStyleJson(context: Context, dark: Boolean): String =
    context.assets.open(if (dark) "map-style-dark.json" else "map-style-light.json")
        .bufferedReader().use { it.readText() }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(vm: AppViewModel, user: User) {
    val context = LocalContext.current
    val dark = LocalDarkTheme.current
    val peers by vm.peers.collectAsStateWithLifecycle()
    val me by vm.myLocation.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val unreadNotifications by vm.unreadNotifications.collectAsStateWithLifecycle()

    var map by remember { mutableStateOf<MapLibreMap?>(null) }
    var style by remember { mutableStateOf<Style?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var centeredOnce by remember { mutableStateOf(false) }
    var permissionGranted by remember { mutableStateOf(hasLocationPermission(context)) }
    var backgroundGranted by remember { mutableStateOf(hasBackgroundPermission(context)) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        permissionGranted = result.values.any { it } || hasLocationPermission(context)
        if (permissionGranted && user.sharingEnabled) vm.setSharing(true)
    }
    val backgroundLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { backgroundGranted = it }
    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

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

    // Push peer and own-location data into the map sources.
    LaunchedEffect(style, peers) {
        val s = style ?: return@LaunchedEffect
        val features = peers.values.map { p ->
            Feature.fromGeometry(Point.fromLngLat(p.lng, p.lat)).apply {
                addStringProperty("id", p.userId)
                addStringProperty("name", p.displayName)
                addStringProperty("initials", initials(p.displayName))
                addStringProperty("color", normalizeColor(p.avatarColor))
            }
        }
        s.getSourceAs<GeoJsonSource>(PEERS_SOURCE)?.setGeoJson(FeatureCollection.fromFeatures(features))
    }
    LaunchedEffect(style, me) {
        val s = style ?: return@LaunchedEffect
        val loc = me ?: return@LaunchedEffect
        s.getSourceAs<GeoJsonSource>(ME_SOURCE)?.setGeoJson(
            Feature.fromGeometry(Point.fromLngLat(loc.longitude, loc.latitude)),
        )
        if (!centeredOnce) {
            centeredOnce = true
            map?.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(loc.latitude, loc.longitude), 13.0))
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = {
                mapView.apply {
                    getMapAsync { m ->
                        map = m
                        m.uiSettings.isCompassEnabled = true
                        m.uiSettings.isAttributionEnabled = true
                        m.uiSettings.isLogoEnabled = false
                        m.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(39.0, 35.0), 5.0))
                        m.setStyle(Style.Builder().fromJson(loadStyleJson(context, dark))) { s ->
                            addOverlayLayers(s, dark)
                            style = s
                        }
                        m.addOnMapClickListener { latLng ->
                            val point = m.projection.toScreenLocation(latLng)
                            val hit = m.queryRenderedFeatures(point, PEERS_CIRCLE).firstOrNull()
                            val id = hit?.getStringProperty("id")
                            if (id != null) {
                                selectedId = id
                                true
                            } else {
                                false
                            }
                        }
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
                        busy = busy,
                        onToggle = { on ->
                            if (on && !permissionGranted) {
                                permissionLauncher.launch(
                                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                                )
                            }
                            if (on && Build.VERSION.SDK_INT >= 33 &&
                                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                                android.content.pm.PackageManager.PERMISSION_GRANTED
                            ) {
                                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                            vm.setSharing(on)
                        },
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
        }

        Column(
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (peers.isNotEmpty()) {
                SmallFloatingActionButton(onClick = { fitAll(map, peers.values, me) }) {
                    Text("Tümü", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 8.dp))
                }
            }
            SmallFloatingActionButton(
                onClick = {
                    me?.let {
                        map?.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude, it.longitude), 15.0))
                    }
                },
            ) {
                Icon(Icons.Filled.LocationOn, contentDescription = "Konumuma git")
            }
        }
    }

    val selected = selectedId?.let { peers[it] }
    if (selected != null) {
        ModalBottomSheet(onDismissRequest = { selectedId = null }) {
            PeerDetail(selected) {
                map?.animateCamera(CameraUpdateFactory.newLatLngZoom(LatLng(selected.lat, selected.lng), 16.0))
                selectedId = null
            }
        }
    }
}

@Composable
private fun SharingCard(enabled: Boolean, busy: Boolean, onToggle: (Boolean) -> Unit) {
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
                    if (enabled) "Açık: arkadaşların ve ailen seni görebilir" else "Kapalı: kimse seni göremez",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = enabled, onCheckedChange = onToggle, enabled = !busy)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationBell(unread: Int, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        IconButton(onClick = onClick) {
            if (unread > 0) {
                BadgedBox(badge = { Badge() }) {
                    Icon(Icons.Filled.Notifications, contentDescription = "Bildirimler, $unread okunmamış")
                }
            } else {
                Icon(Icons.Filled.Notifications, contentDescription = "Bildirimler")
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
private fun PeerDetail(peer: Peer, onFocus: () -> Unit) {
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
        val updated = relativeTime(peer.updatedAt)
        if (updated.isNotEmpty()) DetailLine("Son güncelleme", updated)
        peer.battery?.let { level ->
            DetailLine("Pil", if (peer.charging == true) "%$level, şarj oluyor" else "%$level")
        }
        peer.accuracy?.let { DetailLine("Doğruluk", "${it.toInt()} m") }
        Spacer(Modifier.height(16.dp))
        Button(onClick = onFocus, modifier = Modifier.fillMaxWidth()) { Text("Haritada göster") }
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

private fun addOverlayLayers(style: Style, dark: Boolean) {
    style.addSource(GeoJsonSource(PEERS_SOURCE, FeatureCollection.fromFeatures(emptyList<Feature>())))
    style.addSource(GeoJsonSource(ME_SOURCE, FeatureCollection.fromFeatures(emptyList<Feature>())))

    style.addLayer(
        CircleLayer("me-circle", ME_SOURCE).withProperties(
            PropertyFactory.circleRadius(8f),
            PropertyFactory.circleColor(if (dark) "#7A9BF0" else "#315BDB"),
            PropertyFactory.circleStrokeColor("#FFFFFF"),
            PropertyFactory.circleStrokeWidth(3f),
        ),
    )
    style.addLayer(
        CircleLayer(PEERS_CIRCLE, PEERS_SOURCE).withProperties(
            PropertyFactory.circleRadius(16f),
            PropertyFactory.circleColor(Expression.toColor(Expression.get("color"))),
            PropertyFactory.circleStrokeColor("#FFFFFF"),
            PropertyFactory.circleStrokeWidth(2.5f),
        ),
    )
    style.addLayer(
        SymbolLayer("peers-initials", PEERS_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("initials")),
            PropertyFactory.textFont(arrayOf("Noto Sans Bold")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textColor("#FFFFFF"),
            PropertyFactory.textAllowOverlap(true),
            PropertyFactory.textIgnorePlacement(true),
        ),
    )
    style.addLayer(
        SymbolLayer("peers-name", PEERS_SOURCE).withProperties(
            PropertyFactory.textField(Expression.get("name")),
            PropertyFactory.textFont(arrayOf("Noto Sans Regular")),
            PropertyFactory.textSize(12f),
            PropertyFactory.textOffset(arrayOf(0f, 2.2f)),
            PropertyFactory.textColor(if (dark) "#F5F3EE" else "#171918"),
            PropertyFactory.textHaloColor(if (dark) "#171918" else "#F5F3EE"),
            PropertyFactory.textHaloWidth(1.5f),
            PropertyFactory.textOptional(true),
        ),
    )
}

/** Keeps only "#RRGGBB" values so the color expression never fails. */
private fun normalizeColor(hex: String?): String =
    if (hex != null && Regex("^#[0-9a-fA-F]{6}$").matches(hex)) hex else "#315BDB"

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
