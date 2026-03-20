import Foundation

enum APIEndpoints {
    // MARK: - News Feed
    static let newsFeed = "/api/news"
    static let mainFeed = "/api/feed/main"
    static let forYouFeed = "/api/feed/for-you"

    // MARK: - World Events
    static let worldEvents = "/api/world-events?limit=100"
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

    // MARK: - Search
    static func search(query: String, page: Int = 0, limit: Int = 40) -> String {
        "/api/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)&page=\(page)&limit=\(limit)"
    }
    static let searchTrending = "/api/search/trending"

    // MARK: - Analytics
    static let analyticsTrack = "/api/analytics/track"
}
