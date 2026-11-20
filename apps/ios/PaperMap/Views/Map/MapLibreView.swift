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

/// Round marker in the peer's avatar color with their initials.
final class PeerAnnotationView: MLNAnnotationView {
    static let reuseId = "peer"
    private let label = UILabel()
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
    }

    required init?(coder: NSCoder) { nil }

    func configure(with peer: Peer) {
        backgroundColor = UIColor(hex: peer.avatarColor) ?? UIColor(hex: "#315BDB")
        label.text = Format.initials(peer.displayName)
        accessibilityLabel = peer.displayName
        isAccessibilityElement = true
    }
}

struct MapLibreView: UIViewRepresentable {
    let peers: [Peer]
    let dark: Bool
    /// Increment to fly to the user's own location.
    let recenterRequest: Int
    /// Set to a peer id to fly to that peer.
    let focusPeerId: String?
    let onSelect: (Peer) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onSelect: onSelect) }

    func makeUIView(context: Context) -> MLNMapView {
        let map = MLNMapView(frame: .zero, styleURL: Config.mapStyleURL(dark: dark))
        map.delegate = context.coordinator
        map.showsUserLocation = true
        map.compassViewPosition = .topRight
        map.logoView.isHidden = true
        map.attributionButtonPosition = .bottomRight
        // Türkiye overview until the first fix arrives.
        map.setCenter(CLLocationCoordinate2D(latitude: 39.0, longitude: 35.2), zoomLevel: 4.8, animated: false)
        context.coordinator.dark = dark
        return map
    }

    func updateUIView(_ map: MLNMapView, context: Context) {
        let c = context.coordinator
        c.onSelect = onSelect
        if c.dark != dark {
            c.dark = dark
            map.styleURL = Config.mapStyleURL(dark: dark)
        }
        c.sync(peers: peers, on: map)

        if recenterRequest != c.lastRecenter {
            c.lastRecenter = recenterRequest
            if let loc = map.userLocation?.location {
                map.setCenter(loc.coordinate, zoomLevel: max(map.zoomLevel, 14), animated: true)
            }
        }
        if focusPeerId != c.lastFocus {
            c.lastFocus = focusPeerId
            if let id = focusPeerId, let p = peers.first(where: { $0.userId == id }) {
                map.setCenter(
                    CLLocationCoordinate2D(latitude: p.lat, longitude: p.lng),
                    zoomLevel: max(map.zoomLevel, 14),
                    animated: true
                )
            }
        }
    }

    @MainActor
    final class Coordinator: NSObject, MLNMapViewDelegate {
        var onSelect: (Peer) -> Void
        var dark = false
        var lastRecenter = 0
        var lastFocus: String?
        private var annotations: [String: PeerAnnotation] = [:]
        private var didCenterOnUser = false

        init(onSelect: @escaping (Peer) -> Void) {
            self.onSelect = onSelect
        }

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

        func mapView(_ mapView: MLNMapView, viewFor annotation: MLNAnnotation) -> MLNAnnotationView? {
            guard let a = annotation as? PeerAnnotation else { return nil }
            let view = (mapView.dequeueReusableAnnotationView(withIdentifier: PeerAnnotationView.reuseId)
                as? PeerAnnotationView) ?? PeerAnnotationView(reuseIdentifier: PeerAnnotationView.reuseId)
            view.configure(with: a.peer)
            return view
        }

        func mapView(_ mapView: MLNMapView, annotationCanShowCallout annotation: MLNAnnotation) -> Bool {
            false
        }

        func mapView(_ mapView: MLNMapView, didSelect annotation: MLNAnnotation) {
            if let a = annotation as? PeerAnnotation {
                onSelect(a.peer)
            }
            mapView.deselectAnnotation(annotation, animated: false)
        }

        func mapView(_ mapView: MLNMapView, didUpdate userLocation: MLNUserLocation?) {
            guard !didCenterOnUser, let loc = userLocation?.location else { return }
            didCenterOnUser = true
            mapView.setCenter(loc.coordinate, zoomLevel: 13, animated: true)
        }
    }
}
