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
    /// First 1-2 bullets from summary_bullets_news. May be empty when the
    /// article has no bullets, or when the field is missing on older clients.
    let bullets: [String]?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case imageUrl = "image_url"
        case category
        case publishedAt = "published_at"
        case bullets
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(FlexibleID.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        imageUrl = try c.decodeIfPresent(String.self, forKey: .imageUrl)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        publishedAt = try c.decodeIfPresent(String.self, forKey: .publishedAt)
        bullets = try c.decodeIfPresent([String].self, forKey: .bullets)
    }

    init(
        id: FlexibleID,
        title: String,
        imageUrl: String?,
        category: String?,
        publishedAt: String?,
        bullets: [String]? = nil
    ) {
        self.id = id
        self.title = title
        self.imageUrl = imageUrl
        self.category = category
        self.publishedAt = publishedAt
        self.bullets = bullets
    }

    /// Title with markdown bold markers stripped
    var cleanTitle: String {
        title.replacingOccurrences(of: "**", with: "")
    }

    /// Bullets with markdown bold markers stripped, capped at 2.
    var cleanBullets: [String] {
        (bullets ?? []).prefix(2).map { $0.replacingOccurrences(of: "**", with: "") }
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
