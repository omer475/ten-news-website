import Foundation

enum APIEndpoints {
    static let baseURL = "https://www.tennews.ai"

    // MARK: - News Feed
    static let newsFeed = "/api/news"
    static let mainFeed = "/api/feed/main"
    static let forYouFeed = "/api/feed/for-you"
    static let topicFeed = "/api/feed/topic"

    // MARK: - World Events
    static let worldEvents = "/api/world-events?limit=100"
    static func eventDetail(slug: String) -> String { "/api/world-events/\(slug)" }

    // MARK: - Article
    static func article(id: String) -> String { "/api/news/\(id)" }

    // MARK: - Auth
    static let login = "/api/auth/login"
    static let signup = "/api/auth/signup"
    static let verifyOtp = "/api/auth/verify-otp"
    static let logout = "/api/auth/logout"
    static let forgotPassword = "/api/auth/forgot-password"
    static let resetPassword = "/api/auth/reset-password"
    static let googleAuth = "/api/auth/google"
    static let completeProfile = "/api/auth/complete-profile"

    // MARK: - User
    static let userProfile = "/api/user/profile"
    static let userPreferences = "/api/user/preferences"
    static func userLiked(userId: String) -> String { "/api/user/liked?user_id=\(userId)" }

    // MARK: - Search
    static func search(query: String, page: Int = 0, limit: Int = 40) -> String {
        "/api/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)&page=\(page)&limit=\(limit)"
    }
    static let searchTrending = "/api/search/trending"

    // MARK: - Content Creation
    static let contentCreate = "/api/content/create"
    static let contentUploadImage = "/api/content/upload-image"

    // MARK: - Publishers
    static func publisher(id: String) -> String { "/api/publishers/\(id)" }
    static func publisherArticles(id: String, page: Int = 0) -> String { "/api/publishers/\(id)/articles?page=\(page)&limit=20" }
    static func publisherFollow(id: String) -> String { "/api/publishers/\(id)/follow" }
    static let discoverPublishers = "/api/publishers/discover"
    static func searchPublishers(query: String) -> String { "/api/publishers/discover?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)" }

    // MARK: - Users (social graph: user → user follows)
    static func userFollowAction(id: String) -> String { "/api/users/\(id)/follow" }
    static func userFollowers(id: String, limit: Int = 50, offset: Int = 0) -> String {
        "/api/users/\(id)/followers?limit=\(limit)&offset=\(offset)"
    }
    static func userFollowing(id: String, limit: Int = 50, offset: Int = 0) -> String {
        "/api/users/\(id)/following?limit=\(limit)&offset=\(offset)"
    }
    static func userProfileLookup(id: String, viewerId: String? = nil) -> String {
        let base = "/api/users/\(id)/profile"
        guard let viewerId else { return base }
        return base + "?user_id=\(viewerId)"
    }
    static func userSearch(query: String, excludeId: String? = nil) -> String {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        var url = "/api/users/search?q=\(encoded)&limit=20"
        if let excludeId { url += "&exclude_id=\(excludeId)" }
        return url
    }

    // MARK: - Analytics
    static let analyticsTrack = "/api/analytics/track"
}
