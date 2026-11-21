// Copyright (c) 2026 PaperAxis. All rights reserved.

import CoreLocation
import UIKit

/// Device location: foreground updates plus background delivery while sharing is on.
@MainActor
final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var authorization: CLAuthorizationStatus = .notDetermined
    @Published private(set) var lastLocation: CLLocation?

    /// Called for every accepted fix; the app decides where to send it.
    var onLocation: ((CLLocation) -> Void)?

    private let manager = CLLocationManager()
    private var lastSentAt: Date?
    private var lastSent: CLLocation?
    private var running = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 50
        manager.pausesLocationUpdatesAutomatically = false
        manager.activityType = .other
        authorization = manager.authorizationStatus
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    func start() {
        running = true
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse:
            // Ask once for "Always" so sharing keeps working with the app closed.
            manager.requestAlwaysAuthorization()
            beginUpdates()
        case .authorizedAlways:
            beginUpdates()
        default:
            break
        }
    }

    func stop() {
        running = false
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
    }

    /// Latest fix for one-off use (sharing a location in chat). Updates run with a
    /// 50 m distance filter, so the last fix is current until the device moves;
    /// without one, waits up to `timeout` seconds. Nil without permission or fix.
    func currentLocation(timeout: TimeInterval = 15) async -> CLLocation? {
        if let l = lastLocation { return l }
        let status = manager.authorizationStatus
        guard status == .authorizedAlways || status == .authorizedWhenInUse else { return nil }
        if !running { start() }
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let l = lastLocation { return l }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        return nil
    }

    var batteryPercent: Int? {
        let level = UIDevice.current.batteryLevel
        return level < 0 ? nil : Int((level * 100).rounded())
    }

    var isCharging: Bool? {
        switch UIDevice.current.batteryState {
        case .charging, .full: return true
        case .unplugged: return false
        default: return nil
        }
    }

    private func beginUpdates() {
        guard running else { return }
        let status = manager.authorizationStatus
        guard status == .authorizedAlways || status == .authorizedWhenInUse else { return }
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = status == .authorizedWhenInUse
        manager.startUpdatingLocation()
        if status == .authorizedAlways, CLLocationManager.significantLocationChangeMonitoringAvailable() {
            // Relaunches the app after it was terminated, so sharing resumes.
            manager.startMonitoringSignificantLocationChanges()
        }
    }

    private func handle(_ location: CLLocation) {
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy < 500 else { return }
        lastLocation = location
        // At most one upload per 15 s unless the device moved 50 m.
        if let at = lastSentAt, let prev = lastSent,
           Date().timeIntervalSince(at) < 15, location.distance(from: prev) < 50 {
            return
        }
        lastSentAt = Date()
        lastSent = location
        onLocation?(location)
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            self.authorization = status
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                self.beginUpdates()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in self.handle(last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Transient (no fix yet, airplane mode); CoreLocation keeps trying.
    }
}
