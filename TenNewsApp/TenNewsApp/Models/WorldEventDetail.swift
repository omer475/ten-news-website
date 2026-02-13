import Foundation

// MARK: - World Event Full Detail

struct WorldEventFull: Codable, Identifiable, Hashable {
    let id: FlexibleID
    let name: String
    let slug: String
    let imageUrl: String?
    let blurColor: String?
    let importance: FlexibleDouble?
    let status: String
    let lastArticleAt: String?
    let createdAt: String?
    let background: String?
    let summary: String?
    let summaryBullets: [String]?
    let fiveWs: FiveWs?
    let timeline: [TimelineEntry]?
    let articles: [Article]?
    let components: EventComponents?
    let latestDevelopments: [LatestDevelopment]?
    let liveUpdates: [LiveUpdate]?
    let daysSinceStart: DayCounter?
    let countries: [String]?
    let topics: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, slug, importance, status, background, summary, timeline
        case articles, components, countries, topics
        case imageUrl = "image_url"
        case blurColor = "blur_color"
        case lastArticleAt = "last_article_at"
        case createdAt = "created_at"
        case summaryBullets = "summary_bullets"
        case fiveWs = "five_ws"
        case latestDevelopments = "latest_developments"
        case liveUpdates = "live_updates"
        case daysSinceStart = "days_since_start"
    }

    var displayImage: URL? {
        guard let urlString = imageUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    var importanceLevel: Double { importance?.value ?? 0 }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: WorldEventFull, rhs: WorldEventFull) -> Bool { lhs.id == rhs.id }
}

// MARK: - Event Components

struct EventComponents: Codable, Hashable {
    let perspectives: PerspectivesData?
    let whatToWatch: WhatToWatchData?
    let geographicImpact: GeographicImpactData?
    let historicalComparison: HistoricalComparisonData?
    let graph: GraphData?
    let map: MapData?

    enum CodingKeys: String, CodingKey {
        case perspectives, graph, map
        case whatToWatch = "what_to_watch"
        case geographicImpact = "geographic_impact"
        case historicalComparison = "historical_comparison"
    }
}

// MARK: - Perspectives

struct PerspectivesData: Codable, Hashable {
    let title: String?
    let perspectives: [Perspective]?
}

struct Perspective: Codable, Identifiable, Hashable {
    let id: String?
    let viewpoint: String?
    let summary: String?
    let source: String?
    let region: String?

    var identifier: String { id ?? UUID().uuidString }
}

// MARK: - What To Watch

struct WhatToWatchData: Codable, Hashable {
    let title: String?
    let items: [WhatToWatchItem]?
}

struct WhatToWatchItem: Codable, Identifiable, Hashable {
    let id: String?
    let title: String?
    let description: String?
    let date: String?
    let importance: String?

    var identifier: String { id ?? UUID().uuidString }
}

// MARK: - Geographic Impact

struct GeographicImpactData: Codable, Hashable {
    let title: String?
    let regions: [ImpactRegion]?
}

struct ImpactRegion: Codable, Identifiable, Hashable {
    let id: String?
    let name: String?
    let impact: String?
    let description: String?

    var identifier: String { id ?? UUID().uuidString }
}

// MARK: - Historical Comparison

struct HistoricalComparisonData: Codable, Hashable {
    let title: String?
    let comparisons: [HistoricalComparison]?
}

struct HistoricalComparison: Codable, Identifiable, Hashable {
    let id: String?
    let event: String?
    let year: String?
    let similarity: String?
    let description: String?

    var identifier: String { id ?? UUID().uuidString }
}

// MARK: - Latest Developments

struct LatestDevelopment: Codable, Identifiable, Hashable {
    let id: FlexibleID?
    let title: String?
    let summary: String?
    let date: String?
    let source: String?
    let url: String?
    let components: DevelopmentComponents?

    var identifier: String { id?.stringValue ?? UUID().uuidString }
}

struct DevelopmentComponents: Codable, Hashable {
    let details: [DetailItem]?
    let timeline: [TimelineEntry]?
    let graph: GraphData?
}

// MARK: - Live Updates

struct LiveUpdate: Codable, Identifiable, Hashable {
    let id: FlexibleID
    let content: String?
    let source: String?
    let timestamp: String?
    let type: String?
    let importance: String?

    var displayTime: String {
        guard let timestamp else { return "" }
        return timestamp
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: LiveUpdate, rhs: LiveUpdate) -> Bool { lhs.id == rhs.id }
}

// MARK: - Day Counter

struct DayCounter: Codable, Hashable {
    let startDate: String?
    let days: Int?
    let label: String?

    enum CodingKeys: String, CodingKey {
        case days, label
        case startDate = "start_date"
    }
}
