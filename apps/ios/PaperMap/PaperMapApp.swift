// Copyright (c) 2026 PaperAxis. All rights reserved.
// PaperMap — native iOS app. Bir PaperAxis ürünüdür.

import CoreLocation
import SwiftUI
import UIKit

@main
struct PaperMapApp: App {
    @StateObject private var session = Session()
    @StateObject private var realtime = RealtimeService()
    @StateObject private var location = LocationService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(realtime)
                .environmentObject(location)
                .tint(Pa.primary)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @EnvironmentObject private var location: LocationService
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if session.isSignedIn {
                MainTabView()
            } else {
                AuthFlowView()
            }
        }
        .task(id: session.token) { await onTokenChange() }
        .onChange(of: scenePhase) { phase in
            if phase == .active, let token = session.token {
                realtime.connect(token: token)
                realtime.refresh()
            }
        }
    }

    @MainActor
    private func onTokenChange() async {
        guard let token = session.token else {
            realtime.disconnect()
            location.stop()
            location.onLocation = nil
            return
        }
        let s = session, r = realtime, l = location
        location.onLocation = { [weak s, weak r, weak l] loc in
            guard let s, let r, let l else { return }
            upload(loc, session: s, realtime: r, location: l)
        }
        realtime.connect(token: token)
        await session.refreshMe()
        location.start()
    }
}

/// Sends a fix over the socket while the app is active, otherwise over HTTP.
/// Nothing is sent while sharing is off.
@MainActor
private func upload(_ loc: CLLocation, session: Session, realtime: RealtimeService, location: LocationService) {
    guard session.user?.sharingEnabled == true else { return }
    let payload = LocationPayload(
        lat: loc.coordinate.latitude,
        lng: loc.coordinate.longitude,
        accuracy: loc.horizontalAccuracy,
        battery: location.batteryPercent,
        charging: location.isCharging
    )
    if UIApplication.shared.applicationState == .active, realtime.send(payload) {
        return
    }
    // In the background the app runs under the location background mode, so a
    // plain request completes without an extra background task.
    Task { @MainActor in
        let _: EmptyResponse? = try? await session.api("POST", "/api/location", body: payload)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            MapScreen()
                .tabItem { Label("Harita", systemImage: "map") }
            NavigationStack { FriendsView() }
                .tabItem { Label("Arkadaşlar", systemImage: "person.2") }
            NavigationStack { FamilyListView() }
                .tabItem { Label("Aile", systemImage: "house") }
            NavigationStack { ProfileView() }
                .tabItem { Label("Profil", systemImage: "person.crop.circle") }
        }
    }
}
