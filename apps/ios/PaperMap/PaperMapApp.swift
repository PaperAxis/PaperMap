// Copyright (c) 2026 PaperAxis. All rights reserved.
// PaperMap — native iOS app. Bir PaperAxis ürünüdür.

import CoreLocation
import SwiftUI
import UIKit
import UserNotifications

@main
struct PaperMapApp: App {
    @StateObject private var session = Session()
    @StateObject private var realtime = RealtimeService()
    @StateObject private var location = LocationService()
    @StateObject private var chats = ChatStore()
    @StateObject private var notifications = NotificationStore()

    init() {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(realtime)
                .environmentObject(location)
                .environmentObject(chats)
                .environmentObject(notifications)
                .tint(Pa.primary)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var realtime: RealtimeService
    @EnvironmentObject private var location: LocationService
    @EnvironmentObject private var chats: ChatStore
    @EnvironmentObject private var notifications: NotificationStore
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
        .onOpenURL { url in
            // papermap://sso is normally delivered to ASWebAuthenticationSession;
            // a stray callback (session already closed) is ignored, as is any other URL.
            guard url.scheme == SSOFlow.callbackScheme else { return }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active, let token = session.token {
                realtime.connect(token: token)
                realtime.refresh()
                Task {
                    await chats.loadConversations()
                    await notifications.load()
                }
            }
        }
    }

    @MainActor
    private func onTokenChange() async {
        guard let token = session.token else {
            realtime.onMessage = nil
            realtime.onNotification = nil
            realtime.onConnect = nil
            realtime.disconnect()
            location.stop()
            location.onLocation = nil
            chats.reset()
            notifications.reset()
            return
        }
        chats.session = session
        notifications.session = session
        let c = chats, n = notifications, sess = session
        realtime.onMessage = { [weak c, weak sess] event in
            c?.handle(event, myId: sess?.user?.id)
        }
        realtime.onNotification = { [weak n] item in
            n?.handle(item)
        }
        realtime.onConnect = { [weak c, weak n] in
            Task {
                await c?.loadConversations()
                await n?.load()
            }
        }
        let s = session, r = realtime, l = location
        location.onLocation = { [weak s, weak r, weak l] loc in
            guard let s, let r, let l else { return }
            upload(loc, session: s, realtime: r, location: l)
        }
        realtime.connect(token: token)
        await session.refreshMe()
        location.start()
        notifications.requestAuthorization()
        await chats.loadConversations()
        await notifications.load()
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
    @EnvironmentObject private var chats: ChatStore

    var body: some View {
        TabView {
            MapScreen()
                .tabItem { Label("Harita", systemImage: "map") }
            NavigationStack { ConversationListView() }
                .tabItem { Label("Sohbet", systemImage: "bubble.left.and.bubble.right") }
                .badge(chats.unreadTotal)
            NavigationStack { FriendsView() }
                .tabItem { Label("Arkadaşlar", systemImage: "person.2") }
            NavigationStack { FamilyListView() }
                .tabItem { Label("Aile", systemImage: "house") }
            NavigationStack { ProfileView() }
                .tabItem { Label("Profil", systemImage: "person.crop.circle") }
        }
    }
}
