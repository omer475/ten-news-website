import Foundation

enum APIEndpoints {
    // MARK: - News Feed
    static let newsFeed = "/api/news"
    static let forYouFeed = "/api/feed/for-you"

    // MARK: - World Events
    static let worldEvents = "/api/world-events"
    static func eventDetail(slug: String) -> String { "/api/world-events/\(slug)" }

    // MARK: - Article
    static func article(id: String) -> String { "/api/news/\(id)" }

    // MARK: - Auth
    static let login = "/api/auth/login"
    static let signup = "/api/auth/signup"
    static let logout = "/api/auth/logout"
    static let forgotPassword = "/api/auth/forgot-password"

    // MARK: - User
    static let userProfile = "/api/user/profile"
    static let userPreferences = "/api/user/preferences"

    // MARK: - Analytics
    static let analyticsTrack = "/api/analytics/track"
}
