// Copyright (c) 2026 PaperAxis. All rights reserved.
package com.paperaxis.papermap.notify

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.paperaxis.papermap.PaperMapApp

/**
 * FCM push for when the app is not running. Only active in builds that ship
 * google-services.json; without it Firebase never initialises and this
 * service is never called.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        PaperMapApp.instance.registerPushToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val app = PaperMapApp.instance
        // In the foreground the socket already delivers the same notification.
        if (app.isForeground) return
        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        Notifier.show(this, message.messageId ?: (title + body), title, body)
    }
}
