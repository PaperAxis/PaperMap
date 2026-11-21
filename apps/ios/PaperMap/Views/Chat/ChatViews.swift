// Copyright (c) 2026 PaperAxis. All rights reserved.

import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject private var chats: ChatStore
    @State private var showNewGroup = false
    @State private var openTarget: ChatTarget?
    @State private var navigate = false

    var body: some View {
        List {
            if let error = chats.error {
                Section { ErrorText(message: error) }
            }
            if chats.conversations.isEmpty && chats.loaded {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Henüz sohbet yok").paFont(.headline).foregroundColor(Pa.text)
                    Text("Arkadaşlar sekmesinden birine mesaj gönderebilir ya da sağ üstten grup açabilirsin. Aile sohbetleri burada kendiliğinden görünür.")
                        .paFont(.subheadline).foregroundColor(Pa.muted)
                }
                .padding(.vertical, 8)
            }
            ForEach(chats.conversations) { conv in
                NavigationLink(value: ChatTarget(id: conv.id, title: conv.title, type: conv.type)) {
                    ConversationRow(conversation: conv)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("Sohbet")
        .navigationDestination(for: ChatTarget.self) { target in
            ChatView(target: target)
        }
        .navigationDestination(isPresented: $navigate) {
            if let openTarget { ChatView(target: openTarget) }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNewGroup = true } label: { Image(systemName: "person.3") }
                    .accessibilityLabel("Grup oluştur")
            }
        }
        .sheet(isPresented: $showNewGroup) {
            NewGroupView { target in
                showNewGroup = false
                openTarget = target
                // Push after the sheet has finished dismissing.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { navigate = true }
            }
        }
        .refreshable { await chats.loadConversations() }
        .task { if !chats.loaded { await chats.loadConversations() } }
    }
}

struct ConversationRow: View {
    let conversation: ConversationSummary

    var body: some View {
        HStack(spacing: 12) {
            avatar
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(conversation.title)
                        .paFont(.body, weight: conversation.unread > 0 ? .semibold : .regular)
                        .foregroundColor(Pa.text)
                        .lineLimit(1)
                    Spacer()
                    if let rel = Format.relative(conversation.lastMessage?.createdAt ?? conversation.updatedAt) {
                        Text(rel).paFont(.caption).foregroundColor(Pa.muted).lineLimit(1)
                    }
                }
                HStack {
                    Text(previewText)
                        .paFont(.subheadline)
                        .foregroundColor(conversation.unread > 0 ? Pa.text : Pa.muted)
                        .lineLimit(1)
                    Spacer()
                    if conversation.unread > 0 {
                        Text(verbatim: "\(conversation.unread)")
                            .paFont(.caption, weight: .semibold, monospacedDigit: true)
                            .foregroundColor(Pa.onPrimary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(Pa.primary)
                            .clipShape(Capsule())
                            .accessibilityLabel("\(conversation.unread) okunmamış mesaj")
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var previewText: String {
        guard let last = conversation.lastMessage, let body = last.body, !body.isEmpty else {
            return "Henüz mesaj yok"
        }
        if conversation.type != "direct", let name = last.senderName {
            return "\(name): \(body)"
        }
        return body
    }

    @ViewBuilder
    private var avatar: some View {
        if conversation.type == "direct" {
            AvatarView(
                name: conversation.title,
                color: conversation.otherUser?.avatarColor,
                path: conversation.otherUser?.avatarPath,
                size: 44
            )
        } else {
            ZStack {
                Circle().fill(Pa.surface)
                Image(systemName: conversation.type == "family" ? "house" : "person.3")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundColor(Pa.text)
            }
            .frame(width: 44, height: 44)
            .accessibilityHidden(true)
        }
    }
}

struct ChatView: View {
    let target: ChatTarget

    @EnvironmentObject private var chats: ChatStore
    @EnvironmentObject private var session: Session
    @EnvironmentObject private var mapStore: MapStore
    @EnvironmentObject private var router: AppRouter
    @Environment(\.openURL) private var openURL
    @State private var draft = ""
    @State private var sending = false
    @State private var sendError: String?
    @State private var showPlacePicker = false

    private var messages: [ChatMessage] { chats.messages[target.id] ?? [] }
    private var showSender: Bool { target.type != "direct" }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            MessageBubble(
                                message: message,
                                mine: message.senderId == session.user?.id,
                                showSender: showSender,
                                openPlace: { open(message) },
                                openExternal: { openInAppleMaps(message) }
                            )
                            .id(message.id)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                }
                .onAppear { scrollToBottom(proxy, animated: false) }
                .onChange(of: messages.count) { _ in scrollToBottom(proxy, animated: true) }
            }
            if let sendError {
                ErrorText(message: sendError).padding(.horizontal, 16).padding(.top, 6)
            }
            composer
        }
        .background(Pa.bg)
        .navigationTitle(target.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            chats.open(target.id)
            await chats.loadMessages(target.id)
        }
        .onDisappear { chats.close(target.id) }
        .sheet(isPresented: $showPlacePicker) {
            PlacePickerSheet(conversationId: target.id) { message in
                sendError = message
            }
            .presentationDetents([.medium, .large])
        }
    }

    private var composer: some View {
        HStack(spacing: 8) {
            Button {
                showPlacePicker = true
            } label: {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(Pa.text)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Konum paylaş")
            TextField("Mesaj yaz", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color(uiColor: .systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: Pa.radiusSm)
                        .stroke(Color(UIColor(hex: "#7E817A") ?? .gray), lineWidth: 1)
                )
            Button {
                Task { await send() }
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(Pa.onPrimary)
                    .frame(width: 44, height: 44)
                    .background(Pa.primary)
                    .clipShape(RoundedRectangle(cornerRadius: Pa.radiusSm))
            }
            .disabled(sending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
            .accessibilityLabel("Gönder")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Pa.bg)
    }

    @MainActor
    private func send() async {
        let text = draft
        sending = true
        defer { sending = false }
        do {
            try await chats.send(text, to: target.id)
            draft = ""
            sendError = nil
        } catch {
            sendError = error.localizedDescription
        }
    }

    /// Shows the point on the in-app map (Harita tab).
    private func open(_ message: ChatMessage) {
        guard let lat = message.placeLat, let lng = message.placeLng else { return }
        mapStore.show(lat: lat, lng: lng, label: message.placeLabel ?? "Konum")
        router.tab = .map
    }

    private func openInAppleMaps(_ message: ChatMessage) {
        guard let lat = message.placeLat, let lng = message.placeLng else { return }
        let label = message.placeLabel ?? "Konum"
        var comps = URLComponents(string: "http://maps.apple.com/")
        comps?.queryItems = [
            URLQueryItem(name: "ll", value: "\(lat),\(lng)"),
            URLQueryItem(name: "q", value: label),
        ]
        if let url = comps?.url { openURL(url) }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let last = messages.last?.id else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(last, anchor: .bottom) }
        } else {
            proxy.scrollTo(last, anchor: .bottom)
        }
    }
}

/// "Konum paylaş": send the current position or a saved place to a chat.
struct PlacePickerSheet: View {
    let conversationId: String
    /// Reports a send error to the chat screen (nil clears it).
    let onError: (String?) -> Void

    @EnvironmentObject private var chats: ChatStore
    @EnvironmentObject private var mapStore: MapStore
    @EnvironmentObject private var location: LocationService
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        Task { await sendCurrent() }
                    } label: {
                        HStack {
                            Label(busy ? "Konum alınıyor…" : "Şu anki konumum", systemImage: "location.fill")
                            if busy {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(busy)
                }
                if let error {
                    Section { ErrorText(message: error) }
                }
                Section("Kayıtlı yerler") {
                    if mapStore.places.isEmpty {
                        Text("Kayıtlı yerin yok. Haritadan yer ekleyebilirsin.").foregroundColor(Pa.muted)
                    }
                    ForEach(mapStore.places) { place in
                        Button {
                            Task { await send(lat: place.lat, lng: place.lng, label: place.name) }
                        } label: {
                            HStack(spacing: 12) {
                                Circle().fill(paColor(place.color, fallback: placeColors[0])).frame(width: 14, height: 14)
                                Text(place.name).foregroundColor(Pa.text)
                            }
                        }
                        .disabled(busy)
                    }
                }
            }
            .navigationTitle("Konum paylaş")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { dismiss() }
                }
            }
            .task { await mapStore.loadPlaces() }
        }
    }

    @MainActor
    private func sendCurrent() async {
        busy = true
        guard let loc = await location.currentLocation() else {
            busy = false
            error = "Konum alınamadı. Konum izni verildiğinden emin olun."
            return
        }
        busy = false
        await send(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude, label: "Şu anki konumum")
    }

    @MainActor
    private func send(lat: Double, lng: Double, label: String) async {
        busy = true
        defer { busy = false }
        do {
            try await chats.sendPlace(lat: lat, lng: lng, label: label, to: conversationId)
            onError(nil)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    let mine: Bool
    let showSender: Bool
    let openPlace: () -> Void
    var openExternal: (() -> Void)? = nil

    var body: some View {
        HStack {
            if mine { Spacer(minLength: 48) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
                if showSender && !mine, let name = message.senderName {
                    Text(name).paFont(.caption, weight: .semibold).foregroundColor(Pa.muted)
                }
                content
                if let rel = Format.relative(message.createdAt) {
                    Text(rel).paFont(.caption2).foregroundColor(Pa.muted)
                }
            }
            if !mine { Spacer(minLength: 48) }
        }
    }

    @ViewBuilder
    private var content: some View {
        if message.isPlace {
            Button(action: openPlace) {
                VStack(alignment: .leading, spacing: 2) {
                    Label(message.placeLabel ?? "Konum", systemImage: "mappin.and.ellipse")
                        .paFont(.subheadline, weight: .medium)
                    Text("Haritada göster").paFont(.caption)
                }
                .foregroundColor(mine ? Pa.onPrimary : Pa.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(mine ? Pa.primary : Pa.surface)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
            }
            .accessibilityHint("Haritada gösterir")
            .contextMenu {
                Button(action: openPlace) {
                    Label("Haritada göster", systemImage: "map")
                }
                if let openExternal {
                    Button(action: openExternal) {
                        Label("Haritalar'da aç", systemImage: "arrow.up.forward.app")
                    }
                }
            }
        } else {
            Text(message.body ?? "")
                .paFont(.body)
                .foregroundColor(mine ? Pa.onPrimary : Pa.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(mine ? Pa.primary : Pa.surface)
                .clipShape(RoundedRectangle(cornerRadius: Pa.radiusMd))
                .textSelection(.enabled)
        }
    }
}

struct NewGroupView: View {
    let onCreated: (ChatTarget) -> Void

    @EnvironmentObject private var session: Session
    @EnvironmentObject private var chats: ChatStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var friends: [FriendEntry] = []
    @State private var selected = Set<String>()
    @State private var busy = false
    @State private var error: String?

    private var canCreate: Bool {
        !busy && !selected.isEmpty && !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledField(label: "Grup adı", text: $name)
                        .listRowSeparator(.hidden)
                }
                if let error {
                    Section { ErrorText(message: error) }
                }
                Section("Üyeler") {
                    if friends.isEmpty {
                        Text("Gruba eklemek için önce arkadaş eklemelisin.")
                            .paFont(.subheadline).foregroundColor(Pa.muted)
                    }
                    ForEach(friends) { entry in
                        Button {
                            if selected.contains(entry.user.id) {
                                selected.remove(entry.user.id)
                            } else {
                                selected.insert(entry.user.id)
                            }
                        } label: {
                            HStack {
                                PersonRow(person: entry.user)
                                Spacer()
                                Image(systemName: selected.contains(entry.user.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(selected.contains(entry.user.id) ? Pa.primary : Pa.muted)
                            }
                        }
                        .accessibilityAddTraits(selected.contains(entry.user.id) ? .isSelected : [])
                    }
                }
            }
            .navigationTitle("Yeni grup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Oluştur") { Task { await create() } }
                        .disabled(!canCreate)
                }
            }
            .task { await loadFriends() }
        }
    }

    @MainActor
    private func loadFriends() async {
        do {
            let res: FriendsResponse = try await session.api("GET", "/api/friends")
            friends = res.friends
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func create() async {
        busy = true
        defer { busy = false }
        do {
            let target = try await chats.createGroup(name: name, memberIds: Array(selected))
            onCreated(target)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct NotificationsView: View {
    @EnvironmentObject private var notifications: NotificationStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if let error = notifications.error {
                    Section { ErrorText(message: error) }
                }
                if notifications.items.isEmpty && notifications.loaded {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Bildirim yok").paFont(.headline).foregroundColor(Pa.text)
                        Text("Yeni mesajlar, alan giriş-çıkışları ve diğer olaylar burada görünür.")
                            .paFont(.subheadline).foregroundColor(Pa.muted)
                    }
                    .padding(.vertical, 8)
                }
                ForEach(notifications.items) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.title)
                            .paFont(.body, weight: item.readAt == nil ? .semibold : .regular)
                            .foregroundColor(Pa.text)
                        Text(item.body)
                            .paFont(.subheadline)
                            .foregroundColor(item.readAt == nil ? Pa.text : Pa.muted)
                        if let rel = Format.relative(item.createdAt) {
                            Text(rel).paFont(.caption).foregroundColor(Pa.muted)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Bildirimler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Kapat") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Tümünü okundu say") { Task { await notifications.markAllRead() } }
                        .disabled(notifications.unread == 0)
                }
            }
            .refreshable { await notifications.load() }
            .task { await notifications.load() }
            .onAppear { notifications.isViewing = true }
            .onDisappear { notifications.isViewing = false }
        }
    }
}
