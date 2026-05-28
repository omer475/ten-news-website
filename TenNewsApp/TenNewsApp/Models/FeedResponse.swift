import Foundation

// MARK: - News Feed Response

struct NewsFeedResponse: Codable {
    let status: String?
    let totalResults: Int?
    let articles: [Article]
}

// MARK: - Main Feed Response (Cursor-Based)

struct MainFeedResponse: Codable {
    let articles: [Article]
    let nextCursor: String?
    let hasMore: Bool
    let total: Int?
    let feedState: String?
    let freshCount: Int?
    let caughtUpMessage: String?

    enum CodingKeys: String, CodingKey {
        case articles, total
        case nextCursor = "next_cursor"
        case hasMore = "has_more"
        case feedState = "feed_state"
        case freshCount = "fresh_count"
        case caughtUpMessage = "caught_up_message"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articles = try container.decodeIfPresent([Article].self, forKey: .articles) ?? []
        nextCursor = try container.decodeIfPresent(String.self, forKey: .nextCursor)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
        total = try container.decodeIfPresent(Int.self, forKey: .total)
        feedState = try container.decodeIfPresent(String.self, forKey: .feedState)
        freshCount = try container.decodeIfPresent(Int.self, forKey: .freshCount)
        caughtUpMessage = try container.decodeIfPresent(String.self, forKey: .caughtUpMessage)
    }
}

// MARK: - Following Feed Response

/// Cursor-paginated chronological feed for the new Following tab.
/// `next_cursor` is the ISO 8601 `published_at` of the last article in the
/// page; the client passes it back as `?cursor=` to get the next page.
/// `has_more` lets the iOS view stop scrolling-fetch when the user reaches
/// the end of their followed-publisher history.
struct FollowingFeedResponse: Codable {
    let articles: [Article]
    let nextCursor: String?
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case articles
        case nextCursor = "next_cursor"
        case hasMore = "has_more"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articles = try container.decodeIfPresent([Article].self, forKey: .articles) ?? []
        nextCursor = try container.decodeIfPresent(String.self, forKey: .nextCursor)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
    }
}

// MARK: - Topic Feed Response

struct TopicFeedResponse: Codable {
    let entity: String?
    let articles: [Article]
    let count: Int?
    let offset: Int?
    let limit: Int?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        entity = try container.decodeIfPresent(String.self, forKey: .entity)
        articles = try container.decodeIfPresent([Article].self, forKey: .articles) ?? []
        count = try container.decodeIfPresent(Int.self, forKey: .count)
        offset = try container.decodeIfPresent(Int.self, forKey: .offset)
        limit = try container.decodeIfPresent(Int.self, forKey: .limit)
    }

    enum CodingKeys: String, CodingKey {
        case entity, articles, count, offset, limit
    }
}

// MARK: - Explore Feed Response (discovery)

/// Server response shape for `/api/explore/feed` (lib/exploreServe.js). The
/// discovery endpoint returns a single slate (no cursor pagination — the
/// Explore page re-fetches a fresh slate on refresh) plus a `request_id` for
/// impression-correlation and an optional `debug` block (categoryCounts /
/// bucketCounts) we surface to the device log when diagnosing.
struct ExploreFeedResponse: Codable {
    let articles: [Article]
    let count: Int?
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case articles, count
        case requestId = "request_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        articles = try container.decodeIfPresent([Article].self, forKey: .articles) ?? []
        count = try container.decodeIfPresent(Int.self, forKey: .count)
        requestId = try container.decodeIfPresent(String.self, forKey: .requestId)
    }
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
