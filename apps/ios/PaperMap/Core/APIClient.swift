// Copyright (c) 2026 PaperAxis. All rights reserved.

import Foundation

struct APIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }

    var isUnauthorized: Bool { status == 401 }
}

private struct ServerError: Decodable {
    let error: String?
}

/// Thin async/await wrapper around the PaperMap REST API.
enum APIClient {
    private static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.waitsForConnectivity = false
        return URLSession(configuration: c)
    }()

    static func send<T: Decodable>(
        _ method: String,
        _ path: String,
        body: (any Encodable)? = nil,
        token: String?,
        as type: T.Type = T.self
    ) async throws -> T {
        guard let url = URL(string: Config.apiBase.absoluteString + path) else {
            throw APIError(status: 0, message: "Geçersiz adres")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError(status: 0, message: "Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let msg = (try? JSONDecoder().decode(ServerError.self, from: data))?.error
            throw APIError(status: status, message: msg ?? "İstek başarısız oldu (\(status)).")
        }
        if data.isEmpty, let empty = EmptyResponse() as? T {
            return empty
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(status: status, message: "Sunucu yanıtı okunamadı.")
        }
    }
}
