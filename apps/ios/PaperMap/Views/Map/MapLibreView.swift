// Copyright (c) 2026 PaperAxis. All rights reserved.

import CoreLocation
import MapLibre
import SwiftUI
import UIKit

/// Annotation carrying the peer it represents.
final class PeerAnnotation: MLNPointAnnotation {
    var peer: Peer

    init(peer: Peer) {
        self.peer = peer
        super.init()
        coordinate = CLLocationCoordinate2D(latitude: peer.lat, longitude: peer.lng)
        title = peer.displayName
    }

    required init?(coder: NSCoder) { nil }
}

/// Saved place, meeting point, chat pin or history playback position.
final class SymbolAnnotation: MLNPointAnnotation {
    enum Kind { case place, meeting, pin, playback }

    let kind: Kind
    var colorHex: String?

    init(kind: Kind, lat: Double, lng: Double, title: String?, subtitle: String? = nil, colorHex: String? = nil) {
        self.kind = kind
        self.colorHex = colorHex
        super.init()
        coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        self.title = title
        self.subtitle = subtitle
    }

    required init?(coder: NSCoder) { nil }
}

/// Round marker: the peer's profile photo, or initials on their avatar color.
final class PeerAnnotationView: MLNAnnotationView {
    static let reuseId = "peer"
    private let label = UILabel()
    private let photo = UIImageView()
    private var photoURL: URL?
    private let size: CGFloat = 40

    override init(reuseIdentifier: String?) {
        super.init(reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: size, height: size)
        layer.cornerRadius = size / 2
        layer.borderWidth = 3
        layer.borderColor = UIColor(hex: "#F5F3EE")?.cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.18
        layer.shadowRadius = 3
        layer.shadowOffset = CGSize(width: 0, height: 1)
        label.frame = bounds
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 14, weight: .semibold)
        label.textColor = .white
        addSubview(label)
        photo.frame = bounds.insetBy(dx: 3, dy: 3)
        photo.contentMode = .scaleAspectFill
        photo.clipsToBounds = true
        photo.layer.cornerRadius = (size - 6) / 2
        addSubview(photo)
    }

    required init?(coder: NSCoder) { nil }

    func configure(with peer: Peer) {
        backgroundColor = UIColor(hex: peer.avatarColor) ?? UIColor(hex: "#315BDB")
        label.text = Format.initials(peer.displayName)
        accessibilityLabel = peer.displayName
        isAccessibilityElement = true

        let url = Config.uploadURL(peer.avatarPath)
        guard url != photoURL else { return }
        photoURL = url
        photo.image = nil
        guard let url else { return }
        if let cached = RemoteImageCache.shared.cached(url) {
            photo.image = cached
            return
        }
        Task { [weak self] in
            let image = await RemoteImageCache.shared.load(url)
            guard let self, self.photoURL == url else { return }
            self.photo.image = image
        }
    }
}

/// Colored dot (place), meeting point, dropped pin or playback position.
final class SymbolAnnotationView: MLNAnnotationView {
    static let reuseId = "symbol"
    private let icon = UIImageView()

    override init(reuseIdentifier: String?) {
        super.init(reuseIdentifier: reuseIdentifier)
        layer.borderColor = UIColor.white.cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.2
        layer.shadowRadius = 2
        layer.shadowOffset = CGSize(width: 0, height: 1)
        icon.contentMode = .center
        icon.tintColor = .white
        addSubview(icon)
    }

    required init?(coder: NSCoder) { nil }

    func configure(with a: SymbolAnnotation) {
        let size: CGFloat
        let symbol: String?
        let color: UIColor
        switch a.kind {
        case .place:
            size = 22; symbol = nil
            color = UIColor(hex: a.colorHex) ?? UIColor(hex: "#7c3aed") ?? .systemPurple
        case .meeting:
            size = 30; symbol = "person.2.fill"
            color = UIColor(hex: "#B3261E") ?? .systemRed
        case .pin:
            size = 30; symbol = "mappin"
            color = UIColor(hex: "#315BDB") ?? .systemBlue
        case .playback:
            size = 18; symbol = nil
            color = UIColor(hex: "#f97316") ?? .systemOrange
        }
        frame = CGRect(x: 0, y: 0, width: size, height: size)
        layer.cornerRadius = a.kind == .meeting ? 8 : size / 2
        layer.borderWidth = a.kind == .playback ? 3 : 2
        backgroundColor = color
        icon.frame = bounds
        icon.image = symbol.flatMap {
            UIImage(systemName: $0, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
        }
        accessibilityLabel = a.title
        isAccessibilityElement = a.title != nil
    }
}

struct MapLibreView: UIViewRepresentable {
    /// Camera pitch (degrees) the 3D button switches to; the tilt gesture goes up to 60.
    static let tilt3D: CGFloat = 55
    let peers: [Peer]
    var geofences: [Geofence] = []
    var places: [SavedPlace] = []
    var meetings: [Meeting] = []
    var history: LocationHistory? = nil
    var playbackIndex: Int = 0
    var pin: MapPin? = nil
    /// Style variant to draw (MapStyleChoice.variant): light, dark, terrain, night, satellite.
    let styleVariant: String
    /// Increment to turn the map back to north-up and flat (CompassButton).
    var resetNorthRequest: Int = 0
    /// Reports the map's bearing in degrees as it turns (for CompassButton).
    var onBearingChange: ((Double) -> Void)? = nil
    /// Increment to toggle the perspective: flat -> tilted (TiltButton), tilted -> flat.
    var tiltToggleRequest: Int = 0
    /// Reports the camera pitch in degrees as it changes (for TiltButton).
    var onPitchChange: ((Double) -> Void)? = nil
    /// Increment to fly to the user's own location.
    let recenterRequest: Int
    /// One-off camera move (peer, place, meeting, SOS, chat location).
    var focus: MapFocus? = nil
    /// While true, a tap on the map reports its coordinate through onTapMap.
    var placing = false
    let onSelect: (Peer) -> Void
    var onTapMap: ((CLLocationCoordinate2D) -> Void)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    func makeUIView(context: Context) -> MLNMapView {
        let map = MLNMapView(frame: .zero, styleURL: Config.mapStyleURL(variant: styleVariant))
        map.delegate = context.coordinator
        map.showsUserLocation = true
        // The built-in compass is replaced by CompassButton next to the style picker.
        map.compassView.compassVisibility = .hidden
        map.logoView.isHidden = true
        // Perspective gestures: two fingers dragged up/down tilt the camera
        // (3D buildings, terrain shading), a two-finger twist rotates.
        map.isPitchEnabled = true
        map.isRotateEnabled = true
        // z16 tiles are overzoomed up to z22 (web/src/lib/mapStyle.js MAP_MAX_ZOOM).
        map.maximumZoomLevel = 22
        map.attributionButtonPosition = .bottomRight
        // Türkiye overview until the first fix arrives.
        map.setCenter(CLLocationCoordinate2D(latitude: 39.0, longitude: 35.2), zoomLevel: 4.8, animated: false)
        context.coordinator.styleVariant = styleVariant

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tap.delegate = context.coordinator
        for recognizer in map.gestureRecognizers ?? [] {
            if let t = recognizer as? UITapGestureRecognizer, t.numberOfTapsRequired == 2 {
                tap.require(toFail: t)
            }
        }
        map.addGestureRecognizer(tap)
        return map
    }

    func updateUIView(_ map: MLNMapView, context: Context) {
        let c = context.coordinator
        c.onSelect = onSelect
        c.onTapMap = onTapMap
        c.placing = placing
        c.onBearingChange = onBearingChange
        c.onPitchChange = onPitchChange
        if c.styleVariant != styleVariant {
            c.styleVariant = styleVariant
            map.styleURL = Config.mapStyleURL(variant: styleVariant)
        }
        if resetNorthRequest != c.lastResetNorth {
            c.lastResetNorth = resetNorthRequest
            let camera = map.camera
            camera.heading = 0
            camera.pitch = 0
            map.setCamera(camera, animated: true)
        }
        if tiltToggleRequest != c.lastTiltToggle {
            c.lastTiltToggle = tiltToggleRequest
            let camera = map.camera
            camera.pitch = camera.pitch > 5 ? 0 : MapLibreView.tilt3D
            map.setCamera(camera, withDuration: 0.6, animationTimingFunction: nil)
        }
        c.sync(peers: peers, on: map)
        c.sync(geofences: geofences, on: map)
        c.sync(places: places, meetings: meetings, pin: pin, on: map)
        c.sync(history: history, playbackIndex: playbackIndex, on: map)

        if recenterRequest != c.lastRecenter {
            c.lastRecenter = recenterRequest
            if let loc = map.userLocation?.location {
                map.setCenter(loc.coordinate, zoomLevel: max(map.zoomLevel, 14), animated: true)
            }
        }
        if let focus, focus.id != c.lastFocusId {
            c.lastFocusId = focus.id
            c.didCenterOnUser = true
            map.setCenter(
                CLLocationCoordinate2D(latitude: focus.lat, longitude: focus.lng),
                zoomLevel: max(map.zoomLevel, focus.zoom),
                animated: true
            )
        }
    }

    @MainActor
    final class Coordinator: NSObject, MLNMapViewDelegate, UIGestureRecognizerDelegate {
        var onSelect: (Peer) -> Void
        var onTapMap: ((CLLocationCoordinate2D) -> Void)?
        var placing = false
        var styleVariant = ""
        var onBearingChange: ((Double) -> Void)?
        var lastResetNorth = 0
        var onPitchChange: ((Double) -> Void)?
        var lastTiltToggle = 0
        private var lastBearing = 0.0
        private var lastPitch = 0.0
        var lastRecenter = 0
        var lastFocusId: UUID?
        var didCenterOnUser = false
        private var annotations: [String: PeerAnnotation] = [:]

        private var lastGeofences: [Geofence] = []
        private var geofenceShapes: [MLNPolygon] = []
        private var lastPlaces: [SavedPlace] = []
        private var lastMeetings: [Meeting] = []
        private var lastPin: MapPin?
        private var symbolAnnotations: [SymbolAnnotation] = []
        private var lastHistoryId: UUID?
        private var historyLine: MLNPolyline?
        private var historyCoords: [CLLocationCoordinate2D] = []
        private var playback: SymbolAnnotation?

        private let geofenceColor = UIColor(hex: "#315BDB") ?? .systemBlue
        private let historyColor = UIColor(hex: "#f97316") ?? .systemOrange

        init(onSelect: @escaping (Peer) -> Void) {
            self.onSelect = onSelect
        }

        // MARK: Sync

        func sync(peers: [Peer], on map: MLNMapView) {
            let ids = Set(peers.map(\.userId))
            let gone = annotations.filter { !ids.contains($0.key) }
            if !gone.isEmpty {
                map.removeAnnotations(Array(gone.values))
                gone.keys.forEach { annotations[$0] = nil }
            }
            var added: [PeerAnnotation] = []
            for peer in peers {
                if let a = annotations[peer.userId] {
                    let changed = a.peer != peer
                    a.peer = peer
                    a.coordinate = CLLocationCoordinate2D(latitude: peer.lat, longitude: peer.lng)
                    if changed, let view = map.view(for: a) as? PeerAnnotationView {
                        view.configure(with: peer)
                    }
                } else {
                    let a = PeerAnnotation(peer: peer)
                    annotations[peer.userId] = a
                    added.append(a)
                }
            }
            if !added.isEmpty { map.addAnnotations(added) }
        }

        /// Geofences as circle polygons (64 segments).
        func sync(geofences: [Geofence], on map: MLNMapView) {
            guard geofences != lastGeofences else { return }
            lastGeofences = geofences
            if !geofenceShapes.isEmpty { map.removeAnnotations(geofenceShapes) }
            geofenceShapes = geofences.map { g in
                let coords = circle(lat: g.lat, lng: g.lng, radius: g.radius)
                let polygon = MLNPolygon(coordinates: coords, count: UInt(coords.count))
                polygon.title = g.name
                return polygon
            }
            if !geofenceShapes.isEmpty { map.addAnnotations(geofenceShapes) }
        }

        func sync(places: [SavedPlace], meetings: [Meeting], pin: MapPin?, on map: MLNMapView) {
            guard places != lastPlaces || meetings != lastMeetings || pin != lastPin else { return }
            lastPlaces = places
            lastMeetings = meetings
            lastPin = pin
            if !symbolAnnotations.isEmpty { map.removeAnnotations(symbolAnnotations) }
            var list = places.map {
                SymbolAnnotation(kind: .place, lat: $0.lat, lng: $0.lng, title: $0.name, colorHex: $0.color)
            }
            list += meetings.map {
                SymbolAnnotation(kind: .meeting, lat: $0.lat, lng: $0.lng, title: $0.label, subtitle: "Buluşma noktası")
            }
            if let pin {
                list.append(SymbolAnnotation(kind: .pin, lat: pin.lat, lng: pin.lng, title: pin.label))
            }
            symbolAnnotations = list
            if !list.isEmpty { map.addAnnotations(list) }
        }

        func sync(history: LocationHistory?, playbackIndex: Int, on map: MLNMapView) {
            if history?.id != lastHistoryId {
                lastHistoryId = history?.id
                if let line = historyLine { map.removeAnnotation(line) }
                if let playback { map.removeAnnotation(playback) }
                historyLine = nil
                playback = nil
                historyCoords = history?.points.map(\.coordinate) ?? []
                if historyCoords.count > 1 {
                    let line = MLNPolyline(coordinates: historyCoords, count: UInt(historyCoords.count))
                    historyLine = line
                    map.addAnnotation(line)
                }
                if let first = historyCoords.first {
                    let marker = SymbolAnnotation(kind: .playback, lat: first.latitude, lng: first.longitude, title: nil)
                    playback = marker
                    map.addAnnotation(marker)
                    didCenterOnUser = true
                    if historyCoords.count == 1 {
                        map.setCenter(first, zoomLevel: 16, animated: true)
                    } else {
                        map.setVisibleCoordinates(
                            historyCoords, count: UInt(historyCoords.count),
                            edgePadding: UIEdgeInsets(top: 160, left: 60, bottom: 200, right: 60),
                            animated: true
                        )
                    }
                }
            }
            if let playback, !historyCoords.isEmpty {
                let idx = min(max(playbackIndex, 0), historyCoords.count - 1)
                playback.coordinate = historyCoords[idx]
            }
        }

        private func circle(lat: Double, lng: Double, radius: Double) -> [CLLocationCoordinate2D] {
            let earth = 6_371_000.0
            let d = radius / earth
            let lat1 = lat * .pi / 180
            let lng1 = lng * .pi / 180
            return (0...64).map { i in
                let bearing = Double(i) / 64 * 2 * .pi
                let lat2 = asin(sin(lat1) * cos(d) + cos(lat1) * sin(d) * cos(bearing))
                let lng2 = lng1 + atan2(sin(bearing) * sin(d) * cos(lat1), cos(d) - sin(lat1) * sin(lat2))
                return CLLocationCoordinate2D(latitude: lat2 * 180 / .pi, longitude: lng2 * 180 / .pi)
            }
        }

        // MARK: Taps

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard placing, recognizer.state == .ended, let map = recognizer.view as? MLNMapView else { return }
            let coordinate = map.convert(recognizer.location(in: map), toCoordinateFrom: map)
            onTapMap?(coordinate)
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }

        // MARK: MLNMapViewDelegate

        func mapView(_ mapView: MLNMapView, viewFor annotation: MLNAnnotation) -> MLNAnnotationView? {
            if let a = annotation as? PeerAnnotation {
                let view = (mapView.dequeueReusableAnnotationView(withIdentifier: PeerAnnotationView.reuseId)
                    as? PeerAnnotationView) ?? PeerAnnotationView(reuseIdentifier: PeerAnnotationView.reuseId)
                view.configure(with: a.peer)
                return view
            }
            if let a = annotation as? SymbolAnnotation {
                let view = (mapView.dequeueReusableAnnotationView(withIdentifier: SymbolAnnotationView.reuseId)
                    as? SymbolAnnotationView) ?? SymbolAnnotationView(reuseIdentifier: SymbolAnnotationView.reuseId)
                view.configure(with: a)
                return view
            }
            return nil
        }

        func mapView(_ mapView: MLNMapView, annotationCanShowCallout annotation: MLNAnnotation) -> Bool {
            guard let a = annotation as? SymbolAnnotation else { return false }
            return a.kind != .playback
        }

        func mapView(_ mapView: MLNMapView, didSelect annotation: MLNAnnotation) {
            if let a = annotation as? PeerAnnotation {
                onSelect(a.peer)
                mapView.deselectAnnotation(annotation, animated: false)
            } else if !(annotation is SymbolAnnotation) {
                mapView.deselectAnnotation(annotation, animated: false)
            }
        }

        func mapView(_ mapView: MLNMapView, alphaForShapeAnnotation annotation: MLNShape) -> CGFloat {
            annotation === historyLine ? 0.85 : 1
        }

        func mapView(_ mapView: MLNMapView, strokeColorForShapeAnnotation annotation: MLNShape) -> UIColor {
            annotation === historyLine ? historyColor : geofenceColor
        }

        func mapView(_ mapView: MLNMapView, fillColorForPolygonAnnotation annotation: MLNPolygon) -> UIColor {
            geofenceColor.withAlphaComponent(0.13)
        }

        func mapView(_ mapView: MLNMapView, lineWidthForPolylineAnnotation annotation: MLNPolyline) -> CGFloat {
            3
        }

        func mapViewRegionIsChanging(_ mapView: MLNMapView) {
            reportBearing(mapView)
        }

        func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
            reportBearing(mapView)
        }

        /// Sends bearing and pitch to SwiftUI only when they really moved (avoids redraw storms).
        private func reportBearing(_ mapView: MLNMapView) {
            let bearing = mapView.direction
            if abs(bearing - lastBearing) >= 0.5 {
                lastBearing = bearing
                onBearingChange?(bearing)
            }
            let pitch = Double(mapView.camera.pitch)
            if abs(pitch - lastPitch) >= 0.5 {
                lastPitch = pitch
                onPitchChange?(pitch)
            }
        }

        func mapView(_ mapView: MLNMapView, didUpdate userLocation: MLNUserLocation?) {
            guard !didCenterOnUser, let loc = userLocation?.location else { return }
            didCenterOnUser = true
            mapView.setCenter(loc.coordinate, zoomLevel: 13, animated: true)
        }
    }
}
