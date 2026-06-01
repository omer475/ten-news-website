import Foundation

// MARK: - Explore Topics API Response

struct ExploreTopicsResponse: Decodable {
    let topics: [ExploreTopic]
    let personalizedCount: Int?
    let trendingCount: Int?
    let total: Int?

    enum CodingKeys: String, CodingKey {
        case topics
        case personalizedCount = "personalized_count"
        case trendingCount = "trending_count"
        case total
    }
}

struct ExploreTopic: Identifiable, Decodable {
    let entityName: String
    let displayTitle: String
    let category: String
    let emoji: String
    let type: String // "personalized" or "trending"
    let weight: Double?
    let articles: [ExploreTopicArticle]

    var id: String { entityName }

    var isPersonalized: Bool { type == "personalized" }
    var isTrending: Bool { type == "trending" }

    enum CodingKeys: String, CodingKey {
        case entityName = "entity_name"
        case displayTitle = "display_title"
        case category
        case emoji
        case type
        case weight
        case articles
    }
}

struct ExploreTopicArticle: Identifiable, Decodable {
    let id: FlexibleID
    let title: String
    let imageUrl: String?
    let category: String?
    let publishedAt: String?
    /// Up to 2 bullets (already parsed server-side from summary_bullets_news).
    /// Optional because the explore endpoint only added this field in 2026-05;
    /// older cached responses or alternative pipelines may omit it.
    let bullets: [String]?
    /// Multi-page carousel pages (curated content has 3-8). Optional: only
    /// present on responses from the updated /api/explore/topics. Carried into
    /// the feed card so a curated carousel shows all pages, not just the cover.
    let pages: [ArticlePage]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case imageUrl = "image_url"
        case category
        case publishedAt = "published_at"
        case bullets
        case pages
    }

    /// Title with markdown bold markers stripped
    var cleanTitle: String {
        title.replacingOccurrences(of: "**", with: "")
    }

    var relativeTime: String {
        guard let publishedAt else { return "" }
        let date: Date? = ISO8601DateFormatter.flexible.date(from: publishedAt)
            ?? ISO8601DateFormatter.flexibleNoFraction.date(from: publishedAt)
        guard let date else { return "" }
        let interval = Date().timeIntervalSince(date)
        if interval < 3600 { return "\(max(1, Int(interval / 60)))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }
}
