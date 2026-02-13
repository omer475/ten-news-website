import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL = "https://tennews.ai"
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
        config.urlCache = URLCache(
            memoryCapacity: 10_000_000,
            diskCapacity: 50_000_000
        )
        config.timeoutIntervalForRequest = 30
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

    // MARK: - Private Helpers

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
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

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(
                NSError(domain: "APIClient", code: -1, userInfo: [
                    NSLocalizedDescriptionKey: "Invalid response"
                ])
            )
        }
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 400:
            throw APIError.badRequest
        case 401:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }
}
