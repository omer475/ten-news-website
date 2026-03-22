import Foundation
import SwiftUI

// MARK: - Search API Models

struct SearchResponse: Decodable {
    let articles: [SearchArticle]
    let entities: [SearchEntity]
    let totalArticles: Int?
    let page: Int?
    let hasMore: Bool?
    let query: String?

    enum CodingKeys: String, CodingKey {
        case articles, entities, page, query
        case totalArticles = "total_articles"
        case hasMore = "has_more"
    }
}

struct SearchArticle: Identifiable, Decodable {
    let id: FlexibleID
    let title: String?
    let imageUrl: String?
    let category: String?
    let likeCount: Int?
    let engagementCount: Int?
    let aiScore: Double?
    let publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category
        case imageUrl = "image_url"
        case likeCount = "like_count"
        case engagementCount = "engagement_count"
        case aiScore = "ai_score"
        case publishedAt = "published_at"
    }

    init(id: FlexibleID, title: String?, imageUrl: String?, category: String?,
         likeCount: Int? = nil, engagementCount: Int? = nil, aiScore: Double? = nil, publishedAt: String? = nil) {
        self.id = id; self.title = title; self.imageUrl = imageUrl; self.category = category
        self.likeCount = likeCount; self.engagementCount = engagementCount
        self.aiScore = aiScore; self.publishedAt = publishedAt
    }

    var displayTitle: String {
        (title ?? "Untitled").replacingOccurrences(of: "**", with: "")
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

struct SearchEntity: Identifiable, Decodable {
    let entityName: String
    let displayTitle: String
    let category: String
    let emoji: String
    let articleCount: Int?
    let articles: [SearchArticle]

    var id: String { entityName }

    enum CodingKeys: String, CodingKey {
        case entityName = "entity_name"
        case displayTitle = "display_title"
        case category, emoji, articles
        case articleCount = "article_count"
    }
}

struct TrendingEntity: Identifiable, Decodable {
    let entityName: String
    let displayTitle: String
    let category: String
    let emoji: String
    let articleCount: Int?

    var id: String { entityName }

    enum CodingKeys: String, CodingKey {
        case entityName = "entity_name"
        case displayTitle = "display_title"
        case category, emoji
        case articleCount = "article_count"
    }
}

struct TrendingResponse: Decodable {
    let trending: [TrendingEntity]
}

// MARK: - Search ViewModel

@MainActor @Observable
final class SearchViewModel {
    var searchText = ""
    var articles: [SearchArticle] = []
    var entities: [SearchEntity] = []
    var trending: [TrendingEntity] = []
    var recentSearches: [String] = []
    var isLoading = false
    var isLoadingTrending = false
    var hasSearched = false
    var errorMessage: String?
    var hasMore = false
    var currentPage = 0

    private var debounceTask: Task<Void, Never>?
    private let recentSearchesKey = "recent_searches"

    init() {
        recentSearches = UserDefaults.standard.stringArray(forKey: recentSearchesKey) ?? []
    }

    // MARK: - Debounced Search

    func onSearchTextChanged() {
        debounceTask?.cancel()

        let query = searchText.trimmingCharacters(in: .whitespaces)
        if query.count < 2 {
            if query.isEmpty {
                articles = []
                entities = []
                hasSearched = false
            }
            return
        }

        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms debounce
            guard !Task.isCancelled else { return }
            await search(query: query)
        }
    }

    func search(query: String) async {
        isLoading = true
        hasSearched = true
        errorMessage = nil
        currentPage = 0

        do {
            let response: SearchResponse = try await APIClient.shared.get(
                APIEndpoints.search(query: query, page: 0, limit: 40)
            )
            guard !Task.isCancelled else { return }
            articles = response.articles
            entities = response.entities
            hasMore = response.hasMore ?? false
            addRecentSearch(query)
        } catch is CancellationError {
            // Ignore cancellation
        } catch {
            errorMessage = "Search failed. Check your connection and try again."
            print("[Search] Error: \(error)")
        }

        isLoading = false
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        currentPage += 1

        do {
            let response: SearchResponse = try await APIClient.shared.get(
                APIEndpoints.search(query: searchText, page: currentPage, limit: 40)
            )
            articles.append(contentsOf: response.articles)
            hasMore = response.hasMore ?? false
        } catch {
            currentPage -= 1
        }

        isLoading = false
    }

    // MARK: - Trending

    func loadTrending() async {
        guard trending.isEmpty else { return }
        isLoadingTrending = true

        do {
            let response: TrendingResponse = try await APIClient.shared.get(
                APIEndpoints.searchTrending
            )
            trending = response.trending
        } catch {
            print("[Search] Trending error: \(error)")
        }

        isLoadingTrending = false
    }

    // MARK: - Recent Searches

    func addRecentSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        recentSearches.removeAll { $0.lowercased() == trimmed.lowercased() }
        recentSearches.insert(trimmed, at: 0)
        if recentSearches.count > 8 { recentSearches = Array(recentSearches.prefix(8)) }
        UserDefaults.standard.set(recentSearches, forKey: recentSearchesKey)

        // Track search query for feed personalization
        Task {
            try? await AnalyticsService().track(
                event: "search_query",
                metadata: ["query": trimmed]
            )
        }
    }

    func removeRecentSearch(_ query: String) {
        recentSearches.removeAll { $0 == query }
        UserDefaults.standard.set(recentSearches, forKey: recentSearchesKey)
    }

    func clearRecentSearches() {
        recentSearches = []
        UserDefaults.standard.removeObject(forKey: recentSearchesKey)
    }

    func selectTrending(_ entity: TrendingEntity) {
        searchText = entity.displayTitle
        Task { await search(query: entity.displayTitle) }
    }

    func selectRecent(_ query: String) {
        searchText = query
        Task { await search(query: query) }
    }
}
