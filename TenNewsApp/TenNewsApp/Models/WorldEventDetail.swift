import Foundation

// MARK: - World Event Full Detail

struct WorldEventFull: Codable, Identifiable, Hashable {
    let id: FlexibleID
    let name: String
    let slug: String
    let imageUrl: String?
    let coverImageUrl: String?
    let thumbnailUrl: String?
    let blurColor: String?
    let importance: FlexibleDouble?
    let status: String
    let lastArticleAt: String?
    let createdAt: String?
    let background: String?
    let keyFacts: [KeyFact]?
    let timeline: [EventTimelineEntry]?
    let components: EventComponents?
    let latestDevelopment: LatestDevelopment?
    let liveUpdates: [LiveUpdate]?
    let dayCounter: DayCounter?
    let totalArticles: Int?
    let countries: [String]?
    let topics: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, slug, importance, status, background, timeline
        case components, countries, topics
        case imageUrl = "imageUrl"
        case coverImageUrl = "coverImageUrl"
        case thumbnailUrl = "thumbnailUrl"
        case blurColor = "blurColor"
        case lastArticleAt = "lastArticleAt"
        case createdAt = "createdAt"
        case keyFacts = "keyFacts"
        case latestDevelopment = "latestDevelopment"
        case liveUpdates = "liveUpdates"
        case dayCounter = "dayCounter"
        case totalArticles = "totalArticles"
    }

    var displayImage: URL? {
        guard let urlString = imageUrl ?? coverImageUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    var importanceLevel: Double { importance?.value ?? 0 }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: WorldEventFull, rhs: WorldEventFull) -> Bool { lhs.id == rhs.id }
}

// MARK: - Key Fact

struct KeyFact: Codable, Hashable {
    let label: String?
    let value: String?
}

// MARK: - Event Timeline Entry

struct EventTimelineEntry: Codable, Identifiable, Hashable {
    let id: String?
    let date: String?
    let headline: String?
    let summary: String?

    var identifier: String { id ?? UUID().uuidString }
}

// MARK: - Event Components

struct EventComponents: Codable, Hashable {
    let perspectives: [Perspective]?
    let whatToWatch: [WhatToWatchItem]?
    let geographicImpact: GeographicImpactData?
    let historicalComparison: HistoricalComparisonData?
    let dataAnalytics: DataAnalyticsData?

    enum CodingKeys: String, CodingKey {
        case perspectives
        case whatToWatch = "what_to_watch"
        case geographicImpact = "geographic_impact"
        case historicalComparison = "historical_comparison"
        case dataAnalytics = "data_analytics"
    }
}

// MARK: - Perspectives

struct Perspective: Codable, Hashable {
    let icon: String?
    let entity: String?
    let stance: String?
    let position: String?
    let sourceContext: String?

    enum CodingKeys: String, CodingKey {
        case icon, entity, stance, position
        case sourceContext = "source_context"
    }
}

// MARK: - What To Watch

struct WhatToWatchItem: Codable, Hashable {
    let date: String?
    let type: String?
    let title: String?
    let source: String?
    let confirmed: Bool?
    let description: String?
    let dateDisplay: String?

    enum CodingKeys: String, CodingKey {
        case date, type, title, source, confirmed, description
        case dateDisplay = "date_display"
    }
}

// MARK: - Geographic Impact

struct GeographicImpactData: Codable, Hashable {
    let countries: [ImpactCountry]?
    let primaryRegion: String?
    let regionsSummary: [RegionSummary]?
    let totalCountriesAffected: Int?

    enum CodingKeys: String, CodingKey {
        case countries
        case primaryRegion = "primary_region"
        case regionsSummary = "regions_summary"
        case totalCountriesAffected = "total_countries_affected"
    }
}

struct RegionSummary: Codable, Hashable {
    let region: String?
    let status: String?
}

struct ImpactCountry: Codable, Hashable {
    let code: String?
    let name: String?
    let role: String?
    let description: String?
}

// MARK: - Historical Comparison

struct HistoricalComparisonData: Codable, Hashable {
    let headline: String?
    let comparisons: [HistoricalComparison]?
    let contextNote: String?
    let timelineInsight: String?

    enum CodingKeys: String, CodingKey {
        case headline, comparisons
        case contextNote = "context_note"
        case timelineInsight = "timeline_insight"
    }
}

struct HistoricalComparison: Codable, Hashable {
    let years: String?
    let summary: String?
    let similarity: String?
    let description: String?
    let eventName: String?
    let resolution: String?
    let similarities: [String]?
    let differences: [String]?
    let keyLessons: String?
    let outcomeType: String?
    let durationMonths: Int?

    enum CodingKeys: String, CodingKey {
        case years, summary, similarity, description, resolution, similarities, differences
        case eventName = "event_name"
        case keyLessons = "key_lessons"
        case outcomeType = "outcome_type"
        case durationMonths = "duration_months"
    }
}

// MARK: - Data Analytics

struct DataAnalyticsData: Codable, Hashable {
    let summary: String?
    let charts: [AnalyticsChart]?
}

struct AnalyticsChart: Codable, Hashable, Identifiable {
    let id: String?
    let title: String?
    let description: String?
    let chartType: String?
    let xLabel: String?
    let yLabel: String?
    let yFormat: String?
    let series: [ChartSeries]?
    let source: String?

    var identifier: String { id ?? UUID().uuidString }

    enum CodingKeys: String, CodingKey {
        case id, title, description, series, source
        case chartType = "chart_type"
        case xLabel = "x_label"
        case yLabel = "y_label"
        case yFormat = "y_format"
    }
}

struct ChartSeries: Codable, Hashable {
    let name: String?
    let color: String?
    let data: [ChartDataPoint]?
}

struct ChartDataPoint: Codable, Hashable {
    let x: String?
    let y: FlexibleDouble?
}

// MARK: - Latest Development

struct LatestDevelopment: Codable, Hashable {
    let title: String?
    let summary: String?
    let image: String?
    let time: String?
    let components: DevelopmentComponents?
}

struct DevelopmentComponents: Codable, Hashable {
    let infoBox: [DetailItem]?
    let graph: GraphData?
    let map: MapData?

    enum CodingKeys: String, CodingKey {
        case graph, map
        case infoBox = "info_box"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        infoBox = try container.decodeIfPresent([DetailItem].self, forKey: .infoBox)
        graph = try container.decodeIfPresent(GraphData.self, forKey: .graph)
        // map can be dict or array in API - gracefully handle both
        map = try? container.decodeIfPresent(MapData.self, forKey: .map)
    }
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
