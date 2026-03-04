import SwiftUI

@MainActor @Observable
final class ExploreViewModel {
    var allArticles: [Article] = []
    var worldEvents: [WorldEvent] = []
    var isLoading = false
    var errorMessage: String?

    // Curated sections
    var spotlightArticle: Article?
    var liveNowEvents: [WorldEvent] = []
    var trendingTopics: [TrendingTopic] = []
    var forYouPicks: [Article] = []
    var quickReads: [Article] = []
    var aroundTheWorld: [RegionCluster] = []
    var deepDiveEvents: [WorldEvent] = []
    var categorySpotlights: [CategorySpotlight] = []

    private let feedService = FeedService()
    private let eventService = WorldEventService()

    // MARK: - Inner Types

    struct TrendingTopic: Identifiable {
        let id: String
        let name: String
        let count: Int
        let color: Color
        let icon: String
    }

    struct RegionCluster: Identifiable {
        let id: String
        let name: String
        let flag: String
        let articles: [Article]
    }

    struct CategorySpotlight: Identifiable {
        let id: String
        let name: String
        let articles: [Article]
        let color: Color
    }

    // MARK: - Load

    func loadData(preferences: UserPreferences = .empty) async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            async let feedResult = feedService.fetchTodayFeed(page: 1, pageSize: 50)
            async let eventsResult = eventService.fetchWorldEvents()

            let feed = try await feedResult
            let events = (try? await eventsResult)?.events ?? []

            allArticles = feed.articles
            worldEvents = events
            curateSections(preferences: preferences)
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func refresh(preferences: UserPreferences = .empty) async {
        isLoading = false // Allow reload
        await loadData(preferences: preferences)
    }

    // MARK: - Curation

    private func curateSections(preferences: UserPreferences) {
        // 1. Spotlight — top-scored article with image
        let sorted = allArticles.sorted { $0.displayScore > $1.displayScore }
        spotlightArticle = sorted.first { $0.displayImage != nil }

        // 2. Live Now — events with new updates
        liveNowEvents = worldEvents
            .filter { ($0.newUpdates ?? 0) > 0 }
            .sorted { ($0.newUpdates ?? 0) > ($1.newUpdates ?? 0) }
            .prefix(5)
            .map { $0 }

        // 3. Trending Topics
        var topicCounts: [String: Int] = [:]
        for article in allArticles {
            if let cat = article.category {
                topicCounts[cat, default: 0] += 1
            }
        }
        let browseMap = Dictionary(uniqueKeysWithValues: BrowseTopic.allTopics.map { ($0.name.lowercased(), $0) })
        trendingTopics = topicCounts
            .sorted { $0.value > $1.value }
            .prefix(6)
            .map { name, count in
                let browse = browseMap[name.lowercased()]
                return TrendingTopic(
                    id: name,
                    name: name,
                    count: count,
                    color: browse?.color ?? .blue,
                    icon: browse?.icon ?? "newspaper"
                )
            }

        // 4. For You — personalized via boost engine
        let excludeSpotlight = spotlightArticle?.id
        let topics = Set(preferences.followedTopics)
        let countries = Set(preferences.followedCountries)
        let home = preferences.homeCountry

        if !topics.isEmpty || !countries.isEmpty || home != nil {
            let boosted = allArticles
                .filter { $0.id != excludeSpotlight }
                .map { article -> (Article, Double) in
                    let boost = calculateBoost(for: article, homeCountry: home, followedCountries: countries, followedTopics: topics)
                    return (article, article.displayScore + boost)
                }
                .sorted { $0.1 > $1.1 }
                .prefix(6)
                .map(\.0)
            forYouPicks = boosted.shuffled()
        } else {
            forYouPicks = Array(sorted.filter { $0.id != excludeSpotlight }.prefix(6)).shuffled()
        }

        // 5. Quick Reads — short summaries
        quickReads = allArticles
            .filter { $0.displaySummary.count < 200 && !$0.displaySummary.isEmpty }
            .prefix(8)
            .map { $0 }

        // 6. Around the World
        aroundTheWorld = buildRegionClusters()

        // 7. Deep Dives — top importance events
        deepDiveEvents = worldEvents
            .sorted { $0.importanceLevel > $1.importanceLevel }
            .prefix(4)
            .map { $0 }

        // 8. Category Spotlights
        categorySpotlights = buildCategorySpotlights()
    }

    // MARK: - Region Clustering

    private static let regionMap: [String: (name: String, flag: String)] = [
        "usa": ("North America", "🇺🇸"), "canada": ("North America", "🇨🇦"), "mexico": ("North America", "🇲🇽"),
        "uk": ("Europe", "🇬🇧"), "germany": ("Europe", "🇩🇪"), "france": ("Europe", "🇫🇷"),
        "spain": ("Europe", "🇪🇸"), "italy": ("Europe", "🇮🇹"), "hungary": ("Europe", "🇭🇺"),
        "ukraine": ("Europe", "🇺🇦"), "belarus": ("Europe", "🇧🇾"),
        "japan": ("Asia Pacific", "🇯🇵"), "south_korea": ("Asia Pacific", "🇰🇷"),
        "china": ("Asia Pacific", "🇨🇳"), "india": ("Asia Pacific", "🇮🇳"),
        "australia": ("Asia Pacific", "🇦🇺"), "pakistan": ("Asia Pacific", "🇵🇰"),
        "kazakhstan": ("Asia Pacific", "🇰🇿"),
        "brazil": ("Latin America", "🇧🇷"),
        "israel": ("Middle East", "🇮🇱"), "iran": ("Middle East", "🇮🇷"),
        "iraq": ("Middle East", "🇮🇶"), "saudi_arabia": ("Middle East", "🇸🇦"),
        "uae": ("Middle East", "🇦🇪"), "qatar": ("Middle East", "🇶🇦"),
        "kuwait": ("Middle East", "🇰🇼"), "oman": ("Middle East", "🇴🇲"),
        "turkiye": ("Middle East", "🇹🇷"),
        "russia": ("Europe", "🇷🇺"),
        "afghanistan": ("Asia Pacific", "🇦🇫"),
        "azerbaijan": ("Asia Pacific", "🇦🇿"), "armenia": ("Asia Pacific", "🇦🇲"),
    ]

    private static let regionFlags: [String: String] = [
        "North America": "🌎", "Europe": "🌍", "Asia Pacific": "🌏",
        "Middle East": "🕌", "Latin America": "🌎",
    ]

    private func buildRegionClusters() -> [RegionCluster] {
        var regionArticles: [String: [Article]] = [:]
        var regionFlags: [String: String] = [:]

        for article in allArticles {
            guard let relevance = article.countryRelevance, !relevance.isEmpty else { continue }
            let topCountry = relevance.max(by: { $0.value < $1.value })?.key ?? ""
            guard let info = Self.regionMap[topCountry] else { continue }

            regionArticles[info.name, default: []].append(article)
            if regionFlags[info.name] == nil {
                regionFlags[info.name] = Self.regionFlags[info.name] ?? info.flag
            }
        }

        return regionArticles
            .sorted { $0.value.count > $1.value.count }
            .prefix(4)
            .map { name, articles in
                RegionCluster(
                    id: name,
                    name: name,
                    flag: regionFlags[name] ?? "🌍",
                    articles: Array(articles.prefix(5))
                )
            }
    }

    // MARK: - Category Spotlights

    private static let categoryColors: [String: String] = [
        "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
        "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
        "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
        "Climate": "#339966", "Economy": "#228866",
    ]

    private func buildCategorySpotlights() -> [CategorySpotlight] {
        var grouped: [String: [Article]] = [:]
        for article in allArticles {
            if let cat = article.category {
                grouped[cat, default: []].append(article)
            }
        }

        return grouped
            .sorted { $0.value.count > $1.value.count }
            .prefix(4)
            .map { name, articles in
                CategorySpotlight(
                    id: name,
                    name: name,
                    articles: Array(articles.prefix(3)),
                    color: Color(hex: Self.categoryColors[name] ?? "#3366CC")
                )
            }
    }

    // MARK: - Boost Engine (same as FeedViewModel)

    private static let homeCountryMaxBoost: Double = 300
    private static let followedCountryMaxBoost: Double = 150
    private static let topicMaxBoost: Double = 150

    private static let countryIDToAPIName: [String: String] = [
        "US": "usa", "GB": "uk", "CA": "canada", "AU": "australia",
        "DE": "germany", "FR": "france", "JP": "japan", "IN": "india",
        "BR": "brazil", "KR": "south_korea", "IL": "israel", "TR": "turkiye",
        "UA": "ukraine", "CN": "china", "RU": "russia", "PK": "pakistan",
        "IR": "iran", "ES": "spain", "IT": "italy",
    ]

    private static let topicIDToAPISlug: [String: [String]] = [
        "conflict": ["conflicts", "conflict"],
        "diplomacy": ["geopolitics", "diplomacy"],
        "economy": ["economics", "economy"],
        "technology": ["tech_industry", "technology", "consumer_tech"],
        "science": ["biotech", "science"],
        "sports": ["sports", "football", "basketball"],
        "entertainment": ["entertainment", "music"],
        "finance": ["finance", "startups"],
    ]

    private static let categoryToTopicID: [String: String] = [
        "Politics": "politics", "Tech": "technology", "Business": "business",
        "Science": "science", "Health": "health", "Sports": "sports",
        "Entertainment": "entertainment", "Finance": "finance",
        "Climate": "climate", "Economy": "economy",
    ]

    private func calculateBoost(
        for article: Article,
        homeCountry: String?,
        followedCountries: Set<String>,
        followedTopics: Set<String>
    ) -> Double {
        var boost: Double = 0
        let countryRel = article.countryRelevance ?? [:]
        let topicRel = article.topicRelevance ?? [:]
        let articleCountries = Set(article.countries ?? [])
        let articleTopics = Set(article.topics ?? [])

        if let home = homeCountry, let apiName = Self.countryIDToAPIName[home] {
            if let relevance = countryRel[apiName] {
                boost += Self.homeCountryMaxBoost * Double(relevance) / 100.0
            } else if countryRel.isEmpty, articleCountries.contains(apiName) {
                boost += Self.homeCountryMaxBoost
            }
        }

        var bestCountryScore: Double = 0
        for isoCode in followedCountries {
            guard let apiName = Self.countryIDToAPIName[isoCode] else { continue }
            if let relevance = countryRel[apiName] {
                bestCountryScore = max(bestCountryScore, Double(relevance) / 100.0)
            } else if countryRel.isEmpty, articleCountries.contains(apiName) {
                bestCountryScore = max(bestCountryScore, 1.0)
            }
        }
        boost += Self.followedCountryMaxBoost * bestCountryScore

        var bestTopicScore: Double = 0
        if let cat = article.category, let mappedTopic = Self.categoryToTopicID[cat], followedTopics.contains(mappedTopic) {
            bestTopicScore = max(bestTopicScore, 0.7)
        }
        for userTopic in followedTopics {
            let apiSlugs = Self.topicIDToAPISlug[userTopic] ?? [userTopic]
            for slug in apiSlugs {
                if let relevance = topicRel[slug] {
                    bestTopicScore = max(bestTopicScore, Double(relevance) / 100.0)
                } else if topicRel.isEmpty, articleTopics.contains(slug) {
                    bestTopicScore = max(bestTopicScore, 1.0)
                }
            }
        }
        boost += Self.topicMaxBoost * bestTopicScore

        return boost
    }
}
