import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL = "https://www.tennews.ai"
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return decoder
    }()
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .useDefaultKeys
        return encoder
    }()

    private init() {
        let config = URLSessionConfiguration.default
        // Disable URL caching — news feed APIs must always return fresh data.
        // Cached responses caused "pages don't refresh" and stale feed content.
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        // 30s was tight against Vercel cold starts: a typical feed request
        // returns in 9-16s warm, but a function cold-start can add 10-20s
        // on top. Bumped to 60s 2026-04-26 after a user-reported "Unable to
        // load news" that traced to an iOS-side URLSession timeout while
        // the server was still computing successfully.
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 90
        config.httpAdditionalHeaders = ["Content-Type": "application/json"]
        session = URLSession(configuration: config)
    }

    // MARK: - Public Methods

    func get<T: Decodable>(_ endpoint: String) async throws -> T {
        let url = try makeURL(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuth(&request)
        return try await perform(request)
    }

    func post<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        let url = try makeURL(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(body)
        addAuth(&request)
        return try await perform(request)
    }

    func patch<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        let url = try makeURL(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.httpBody = try encoder.encode(body)
        addAuth(&request)
        return try await perform(request)
    }

    func delete<T: Decodable>(_ endpoint: String) async throws -> T {
        let url = try makeURL(endpoint)
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        addAuth(&request)
        return try await perform(request)
    }

    // MARK: - Private Helpers

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        try validateResponse(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            print("‼️ Decoding error for \(T.self): \(error)")
            throw APIError.decodingError(error)
        }
    }

    private func makeURL(_ endpoint: String) throws -> URL {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        return url
    }

    private func addAuth(_ request: inout URLRequest) {
        if let token = KeychainManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    /// Extract a user-friendly error message from the server's JSON response
    private func parseServerMessage(_ data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        // Try common keys: "message", "error", "detail"
        return (json["message"] as? String) ?? (json["error"] as? String) ?? (json["detail"] as? String)
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(
                NSError(domain: "APIClient", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: "Invalid response"
                ])
            )
        }
        let status = httpResponse.statusCode
        guard !(200...299).contains(status) else { return }

        let serverMessage = parseServerMessage(data)

        switch status {
        case 400:
            throw APIError.badRequest(serverMessage ?? "Something went wrong. Please try again.")
        case 401:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 409:
            throw APIError.conflict(serverMessage ?? "This already exists.")
        case 500...599:
            throw APIError.serverError(status, serverMessage)
        default:
            throw APIError.serverError(status, serverMessage)
        }
    }
}
