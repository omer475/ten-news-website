import Foundation

// MARK: - World Event (List Item)

struct WorldEvent: Codable, Identifiable, Hashable {
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
    let newUpdates: Int?
    let countries: [String]?
    let topics: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, slug, importance, status, background, countries, topics
        case imageUrl = "image_url"
        case blurColor = "blur_color"
        case lastArticleAt = "last_article_at"
        case createdAt = "created_at"
        case newUpdates
    }

    var displayImage: URL? {
        guard let urlString = imageUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    var importanceLevel: Double { importance?.value ?? 0 }

    var lastArticleDate: Date? {
        guard let dateString = lastArticleAt else { return nil }
        return ISO8601DateFormatter.flexible.date(from: dateString)
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: WorldEvent, rhs: WorldEvent) -> Bool { lhs.id == rhs.id }
}

// MARK: - API Response

struct WorldEventsResponse: Codable {
    let events: [WorldEvent]
    let total: Int?
}
