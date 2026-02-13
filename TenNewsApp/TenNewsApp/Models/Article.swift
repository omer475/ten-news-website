import Foundation

// MARK: - Flexible Decoders for API Compatibility

/// FlexibleID handles both Int and String from API
/// Article IDs come as integers (e.g., 19647), WorldEvent IDs as UUID strings
struct FlexibleID: Codable, Hashable, CustomStringConvertible {
    let stringValue: String

    var description: String { stringValue }

    init(_ string: String) {
        self.stringValue = string
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            stringValue = String(intValue)
        } else if let strValue = try? container.decode(String.self) {
            stringValue = strValue
        } else {
            stringValue = UUID().uuidString
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(stringValue)
    }
}

/// FlexibleDouble handles Int, Double, or String numbers from API
/// importance comes as numbers (e.g., 9), final_score/base_score as integers (e.g., 780)
struct FlexibleDouble: Codable, Hashable {
    let value: Double

    init(_ value: Double) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let intValue = try? container.decode(Int.self) {
            value = Double(intValue)
        } else if let strValue = try? container.decode(String.self), let parsed = Double(strValue) {
            value = parsed
        } else {
            value = 0
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

// MARK: - Article

struct Article: Codable, Identifiable, Hashable {
    let id: FlexibleID
    let title: String?
    let titleNews: String?
    let summary: String?
    let summaryText: String?
    let summaryTextB2: String?
    let summaryBullets: [String]?
    let summaryBulletsNews: [String]?
    let summaryBulletsB2: [String]?
    let details: [DetailItem]?
    let detailsB2: [DetailItem]?
    let detailedText: String?
    let contentNews: String?
    let detailedBullets: [AnyCodable]?
    let detailedBulletsB2: [AnyCodable]?
    let url: String?
    let imageUrl: String?
    let urlToImage: String?
    let imageSource: String?
    let source: String?
    let category: String?
    let emoji: String?
    let timeline: [TimelineEntry]?
    let graph: GraphData?
    let graphData: GraphData?
    let map: MapData?
    let mapData: MapData?
    let fiveWs: FiveWs?
    let components: [String]?
    let citations: [Citation]?
    let publishedAt: String?
    let createdAt: String?
    let aiFinalScore: FlexibleDouble?
    let finalScore: FlexibleDouble?
    let baseScore: FlexibleDouble?
    let rank: Int?
    let worldEvent: ArticleWorldEvent?
    let countries: [String]?
    let topics: [String]?
    let matchReasons: [String]?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, url, source, category, emoji, timeline, graph, map
        case components, citations, rank, details
        case titleNews = "title_news"
        case summaryText = "summary_text"
        case summaryTextB2 = "summary_text_b2"
        case summaryBullets = "summary_bullets"
        case summaryBulletsNews = "summary_bullets_news"
        case summaryBulletsB2 = "summary_bullets_b2"
        case detailsB2 = "details_b2"
        case detailedText = "detailed_text"
        case contentNews = "content_news"
        case detailedBullets = "detailed_bullets"
        case detailedBulletsB2 = "detailed_bullets_b2"
        case imageUrl = "image_url"
        case urlToImage
        case imageSource = "image_source"
        case graphData = "graph_data"
        case mapData = "map_data"
        case fiveWs = "five_ws"
        case publishedAt
        case createdAt = "created_at"
        case aiFinalScore = "ai_final_score"
        case finalScore = "final_score"
        case baseScore = "base_score"
        case worldEvent = "world_event"
        case countries, topics
        case matchReasons = "match_reasons"
    }

    // MARK: - Computed Display Properties

    var displayTitle: String { titleNews ?? title ?? "Untitled" }

    var plainTitle: String { displayTitle.replacingOccurrences(of: "**", with: "") }

    var displayBullets: [String] { summaryBulletsNews ?? summaryBullets ?? [] }

    var displaySummary: String { summaryText ?? summary ?? "" }

    var displayImage: URL? {
        let urlString = imageUrl ?? urlToImage
        guard let urlString, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    var displayScore: Double { finalScore?.value ?? baseScore?.value ?? aiFinalScore?.value ?? 0 }

    var isImportant: Bool { displayScore >= 900 }

    var publishedDate: Date? {
        guard let dateString = publishedAt ?? createdAt else { return nil }
        return ISO8601DateFormatter.flexible.date(from: dateString)
    }

    var availableComponents: [String] { components ?? ["details"] }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: Article, rhs: Article) -> Bool { lhs.id == rhs.id }
}

// MARK: - Article Sub-Models

struct ArticleWorldEvent: Codable, Hashable {
    let id: FlexibleID
    let name: String
    let slug: String
}

/// Detail items from API use {label, value} format
/// Falls back to {title, content} for compatibility
struct DetailItem: Codable, Hashable {
    let label: String?
    let value: String?
    let title: String?
    let content: String?
    let type: String?

    var displayLabel: String { label ?? title ?? "" }
    var displayValue: String { value ?? content ?? "" }
}

/// Timeline entries from API use {date, event} format
/// Falls back to {date, headline} for compatibility
struct TimelineEntry: Codable, Identifiable, Hashable {
    let id: String?
    let date: String?
    let event: String?
    let headline: String?
    let description: String?
    let sourceArticleId: String?

    var identifier: String { id ?? UUID().uuidString }
    var displayText: String { event ?? headline ?? description ?? "" }

    enum CodingKeys: String, CodingKey {
        case id, date, event, headline, description
        case sourceArticleId = "source_article_id"
    }
}

// MARK: - Graph Data

struct GraphData: Codable, Hashable {
    let type: String?
    let title: String?
    let data: [GraphPoint]?
    let xLabel: String?
    let yLabel: String?

    enum CodingKeys: String, CodingKey {
        case type, title, data
        case xLabel = "x_label"
        case yLabel = "y_label"
    }
}

struct GraphPoint: Codable, Hashable {
    let label: String?
    let value: Double?
    let x: String?
    let y: Double?

    var displayLabel: String { label ?? x ?? "" }
    var displayValue: Double { value ?? y ?? 0 }
}

// MARK: - Map Data

struct MapData: Codable, Hashable {
    let type: String?
    let title: String?
    let locations: [MapLocation]?
    let regions: [MapRegion]?
}

struct MapLocation: Codable, Hashable {
    let name: String?
    let lat: Double?
    let lng: Double?
    let lon: Double?
    let description: String?

    var latitude: Double { lat ?? 0 }
    var longitude: Double { lng ?? lon ?? 0 }
}

struct MapRegion: Codable, Hashable {
    let name: String?
    let color: String?
}

// MARK: - Five Ws

/// API returns five_ws with lowercase keys: who, what, when, where, why
/// Custom decoder handles both lowercase and capitalized variants
struct FiveWs: Codable, Hashable {
    let who: String?
    let what: String?
    let when: String?
    let where_: String?
    let why: String?
    let how: String?

    init(who: String? = nil, what: String? = nil, when: String? = nil,
         where_: String? = nil, why: String? = nil, how: String? = nil) {
        self.who = who
        self.what = what
        self.when = when
        self.where_ = where_
        self.why = why
        self.how = how
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKeys.self)
        who = try container.decodeIfPresent(String.self, forKey: .init("who"))
            ?? container.decodeIfPresent(String.self, forKey: .init("Who"))
        what = try container.decodeIfPresent(String.self, forKey: .init("what"))
            ?? container.decodeIfPresent(String.self, forKey: .init("What"))
        when = try container.decodeIfPresent(String.self, forKey: .init("when"))
            ?? container.decodeIfPresent(String.self, forKey: .init("When"))
        where_ = try container.decodeIfPresent(String.self, forKey: .init("where"))
            ?? container.decodeIfPresent(String.self, forKey: .init("Where"))
        why = try container.decodeIfPresent(String.self, forKey: .init("why"))
            ?? container.decodeIfPresent(String.self, forKey: .init("Why"))
        how = try container.decodeIfPresent(String.self, forKey: .init("how"))
            ?? container.decodeIfPresent(String.self, forKey: .init("How"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKeys.self)
        try container.encodeIfPresent(who, forKey: .init("who"))
        try container.encodeIfPresent(what, forKey: .init("what"))
        try container.encodeIfPresent(when, forKey: .init("when"))
        try container.encodeIfPresent(where_, forKey: .init("where"))
        try container.encodeIfPresent(why, forKey: .init("why"))
        try container.encodeIfPresent(how, forKey: .init("how"))
    }

    private struct DynamicCodingKeys: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init(_ string: String) { self.stringValue = string }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { return nil }
    }
}

// MARK: - Supporting Types

struct Citation: Codable, Hashable {
    let source: String?
    let url: String?
    let title: String?
}

/// Type-erased codable that converts any simple value to String
struct AnyCodable: Codable, Hashable {
    let value: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let s = try? container.decode(String.self) {
            value = s
        } else if let i = try? container.decode(Int.self) {
            value = String(i)
        } else if let d = try? container.decode(Double.self) {
            value = String(d)
        } else {
            value = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

// MARK: - Date Formatter Extension

extension ISO8601DateFormatter {
    nonisolated(unsafe) static let flexible: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
