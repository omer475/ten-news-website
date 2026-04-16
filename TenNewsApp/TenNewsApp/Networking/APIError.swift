import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case badRequest(String)
    case unauthorized
    case notFound
    case serverError(Int, String?)
    case conflict(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Something went wrong. Please try again."
        case .networkError:
            return "Unable to connect. Check your internet and try again."
        case .decodingError:
            return "Something went wrong. Please try again."
        case .badRequest(let message):
            return message
        case .unauthorized:
            return "Your session has expired. Please sign in again."
        case .notFound:
            return "Not found."
        case .serverError(_, let message):
            return message ?? "Something went wrong. Please try again."
        case .conflict(let message):
            return message
        }
    }
}
