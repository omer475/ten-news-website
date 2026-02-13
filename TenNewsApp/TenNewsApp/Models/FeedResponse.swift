import Foundation

// MARK: - News Feed Response

struct NewsFeedResponse: Codable {
    let status: String?
    let totalResults: Int?
    let articles: [Article]
}

// MARK: - For You Feed Response

struct ForYouFeedResponse: Codable {
    let articles: [Article]
    let total: Int?
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case articles, total
        case hasMore = "has_more"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articles = try container.decodeIfPresent([Article].self, forKey: .articles) ?? []
        total = try container.decodeIfPresent(Int.self, forKey: .total)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
    }
}
