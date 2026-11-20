// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation
import UserNotifications

/// Notification history and unread count. Live `notification` events also raise a
/// local system notification; there is no remote push on iOS (unsigned build).
@MainActor
final class NotificationStore: ObservableObject {
    @Published private(set) var items: [NotificationItem] = []
    @Published private(set) var unread = 0
    @Published private(set) var loaded = false
    @Published var error: String?

    weak var session: Session?

    /// True while NotificationsView is on screen; banners are suppressed then.
    var isViewing = false {
        didSet { NotificationDelegate.shared.suppressBanners = isViewing }
    }

    func reset() {
        items = []
        unread = 0
        loaded = false
        error = nil
    }

    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    func load() async {
        guard let session else { return }
        do {
            let res: NotificationsResponse = try await session.api("GET", "/api/notifications")
            items = res.notifications
            unread = res.unread ?? res.notifications.filter { $0.readAt == nil }.count
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loaded = true
    }

    func markAllRead() async {
        guard let session else { return }
        do {
            let _: EmptyResponse = try await session.api("POST", "/api/notifications/read")
            let now = ISO8601DateFormatter().string(from: Date())
            items = items.map { item in
                var copy = item
                if copy.readAt == nil { copy.readAt = now }
                return copy
            }
            unread = 0
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Live `notification` event from the socket.
    func handle(_ item: NotificationItem) {
        guard !items.contains(where: { $0.id == item.id }) else { return }
        items.insert(item, at: 0)
        if isViewing {
            Task { await markAllRead() }
        } else {
            unread += 1
            postLocal(item)
        }
    }

    private func postLocal(_ item: NotificationItem) {
        let content = UNMutableNotificationContent()
        content.title = item.title
        content.body = item.body
        content.sound = .default
        let request = UNNotificationRequest(identifier: item.id, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { _ in }
    }
}

/// Shows local notifications as banners while the app is in the foreground.
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    /// Written from the main actor, read from the delegate callback (main thread).
    var suppressBanners = false

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler(suppressBanners ? [] : [.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }
}
