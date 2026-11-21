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
    @StateObject private var router = AppRouter()
    @StateObject private var network = NetworkMonitor()
    @StateObject private var branding = Branding()
    @StateObject private var mapStore = MapStore()
    @StateObject private var fonts = FontStore()

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
                .environmentObject(router)
                .environmentObject(network)
                .environmentObject(branding)
                .environmentObject(mapStore)
                .environmentObject(fonts)
                // Profile font for every text that does not pick a style itself;
                // `.paFont` call sites read the same typeface.
                .paFont(.body)
                .environment(\.paTypeface, fonts.typeface)
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
    @EnvironmentObject private var router: AppRouter
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var branding: Branding
    @EnvironmentObject private var mapStore: MapStore
    @EnvironmentObject private var fonts: FontStore
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if session.isSignedIn {
                MainTabView()
            } else {
                AuthFlowView()
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if network.isOffline { OfflineBanner() }
        }
        .preferredColorScheme(Appearance.colorScheme(for: session.user?.theme ?? Appearance.cachedThemeId))
        .sheet(item: $router.deepLink) { link in
            DeepLinkView(link: link)
        }
        .task(id: session.token) { await onTokenChange() }
        .task { await branding.load() }
        // A new pick (or the account's font after sign-in) applies at once;
        // signed out, the last font stays.
        .onChange(of: session.user?.fontPref) { value in
            if session.user != nil { fonts.apply(fontId: value) }
        }
        .onOpenURL { url in
            // papermap://sso is normally delivered to ASWebAuthenticationSession;
            // a stray callback (session already closed) is ignored. Reset and
            // verification links open their screen over whatever is showing.
            if let link = DeepLink(url: url) { router.deepLink = link }
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            // Only delivered once the app has an associated-domains entitlement.
            if let url = activity.webpageURL, let link = DeepLink(url: url) { router.deepLink = link }
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
            realtime.onSOS = nil
            realtime.onLocationRequest = nil
            realtime.onTripUpdate = nil
            realtime.onTripEnded = nil
            realtime.disconnect()
            location.stop()
            location.onLocation = nil
            chats.reset()
            notifications.reset()
            mapStore.reset()
            router.tab = .map
            return
        }
        chats.session = session
        notifications.session = session
        mapStore.session = session
        let c = chats, n = notifications, sess = session, m = mapStore
        realtime.onMessage = { [weak c, weak sess] event in
            c?.handle(event, myId: sess?.user?.id)
        }
        realtime.onNotification = { [weak n] item in
            n?.handle(item)
        }
        realtime.onSOS = { [weak m] event in
            m?.sosAlert = event
        }
        realtime.onLocationRequest = { [weak m] event in
            m?.locationRequest = event
        }
        realtime.onTripUpdate = { [weak m, weak sess] trip in
            m?.handleTripUpdate(trip, myId: sess?.user?.id)
        }
        realtime.onTripEnded = { [weak m, weak sess] userId in
            m?.handleTripEnded(userId, myId: sess?.user?.id)
        }
        realtime.onConnect = { [weak c, weak n, weak m] in
            Task {
                await c?.loadConversations()
                await n?.load()
                await m?.loadAll()
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
        await mapStore.loadAll()
    }
}

/// Sends a fix over the socket while the app is active, otherwise over HTTP.
/// Nothing is sent while sharing is off.
@MainActor
private func upload(_ loc: CLLocation, session: Session, realtime: RealtimeService, location: LocationService) {
    guard session.user?.sharingActive == true else { return }
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
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        TabView(selection: $router.tab) {
            MapScreen()
                .tabItem { Label("Harita", systemImage: "map") }
                .tag(AppTab.map)
            NavigationStack { ConversationListView() }
                .tabItem { Label("Sohbet", systemImage: "bubble.left.and.bubble.right") }
                .badge(chats.unreadTotal)
                .tag(AppTab.chat)
            NavigationStack { FriendsView() }
                .tabItem { Label("Arkadaşlar", systemImage: "person.2") }
                .tag(AppTab.friends)
            NavigationStack { FamilyListView() }
                .tabItem { Label("Aile", systemImage: "house") }
                .tag(AppTab.family)
            NavigationStack { ProfileView() }
                .tabItem { Label("Profil", systemImage: "person.crop.circle") }
                .tag(AppTab.profile)
        }
    }
}
