// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation
import SocketIO

/// Decodes a Socket.IO payload (JSON-compatible Foundation object) into a model.
private func decodePayload<T: Decodable>(_ any: Any?, as type: T.Type) -> T? {
    guard let any, JSONSerialization.isValidJSONObject(any),
          let data = try? JSONSerialization.data(withJSONObject: any) else { return nil }
    return try? JSONDecoder().decode(T.self, from: data)
}

/// Live peer locations over Socket.IO (see apps/README.md for the event list).
@MainActor
final class RealtimeService: ObservableObject {
    @Published private(set) var peers: [String: Peer] = [:]
    @Published private(set) var isConnected = false

    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private var currentToken: String?

    var sortedPeers: [Peer] {
        peers.values.sorted { $0.displayName.localizedCompare($1.displayName) == .orderedAscending }
    }

    func connect(token: String) {
        if currentToken == token, socket != nil { return }
        disconnect()
        currentToken = token

        let manager = SocketManager(
            socketURL: Config.apiBase,
            config: [.log(false), .compress, .reconnects(true), .reconnectWait(3), .reconnectWaitMax(30)]
        )
        let socket = manager.defaultSocket

        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor in self?.isConnected = true }
        }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            Task { @MainActor in self?.isConnected = false }
        }
        socket.on("peers:snapshot") { [weak self] data, _ in
            let list = decodePayload(data.first, as: [Peer].self) ?? []
            Task { @MainActor in
                self?.peers = Dictionary(list.map { ($0.userId, $0) }, uniquingKeysWith: { _, b in b })
            }
        }
        socket.on("peer:location") { [weak self] data, _ in
            guard let peer = decodePayload(data.first, as: Peer.self) else { return }
            Task { @MainActor in self?.peers[peer.userId] = peer }
        }
        socket.on("peer:offline") { [weak self] data, _ in
            guard let dict = data.first as? [String: Any], let id = dict["userId"] as? String else { return }
            Task { @MainActor in self?.peers[id] = nil }
        }
        socket.on("peers:changed") { [weak self] _, _ in
            Task { @MainActor in self?.refresh() }
        }

        self.manager = manager
        self.socket = socket
        // Socket.IO v3+/v4 handshake auth payload, read by the server as handshake.auth.token.
        socket.connect(withPayload: ["token": token])
    }

    func disconnect() {
        socket?.removeAllHandlers()
        socket?.disconnect()
        manager?.disconnect()
        socket = nil
        manager = nil
        currentToken = nil
        isConnected = false
        peers = [:]
    }

    func refresh() {
        socket?.emit("refresh")
    }

    /// Sends a location over the socket; returns false when not connected.
    func send(_ payload: LocationPayload) -> Bool {
        guard isConnected, let socket else { return false }
        var dict: [String: Any] = ["lat": payload.lat, "lng": payload.lng]
        if let a = payload.accuracy { dict["accuracy"] = a }
        if let b = payload.battery { dict["battery"] = b }
        if let c = payload.charging { dict["charging"] = c }
        socket.emit("location:update", dict)
        return true
    }
}
