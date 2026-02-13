import Foundation

// MARK: - Personalization Config

enum PersonalizationConfig {
    /// Boost factor applied to articles matching user's home country
    static let homeCountryBoost: Double = 1.5

    /// Boost factor applied to articles matching followed countries
    static let followedCountryBoost: Double = 1.2

    /// Boost factor applied to articles matching followed topics
    static let followedTopicBoost: Double = 1.3

    /// Minimum score threshold for articles to appear in feed
    static let minimumScoreThreshold: Double = 200

    /// Maximum number of articles per feed page
    static let feedPageSize: Int = 20
}

// MARK: - Country

struct Country: Identifiable, Hashable {
    let id: String
    let name: String
    let flag: String
    let region: String
}

// MARK: - Topic

struct Topic: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: String
}

// MARK: - Available Countries

enum Countries {
    static let all: [Country] = [
        Country(id: "US", name: "United States", flag: "🇺🇸", region: "North America"),
        Country(id: "GB", name: "United Kingdom", flag: "🇬🇧", region: "Europe"),
        Country(id: "CA", name: "Canada", flag: "🇨🇦", region: "North America"),
        Country(id: "AU", name: "Australia", flag: "🇦🇺", region: "Oceania"),
        Country(id: "DE", name: "Germany", flag: "🇩🇪", region: "Europe"),
        Country(id: "FR", name: "France", flag: "🇫🇷", region: "Europe"),
        Country(id: "JP", name: "Japan", flag: "🇯🇵", region: "Asia"),
        Country(id: "IN", name: "India", flag: "🇮🇳", region: "Asia"),
        Country(id: "BR", name: "Brazil", flag: "🇧🇷", region: "South America"),
        Country(id: "KR", name: "South Korea", flag: "🇰🇷", region: "Asia"),
        Country(id: "IL", name: "Israel", flag: "🇮🇱", region: "Middle East"),
        Country(id: "TR", name: "Turkey", flag: "🇹🇷", region: "Middle East"),
        Country(id: "UA", name: "Ukraine", flag: "🇺🇦", region: "Europe"),
        Country(id: "CN", name: "China", flag: "🇨🇳", region: "Asia"),
        Country(id: "RU", name: "Russia", flag: "🇷🇺", region: "Europe"),
    ]

    static func find(byId id: String) -> Country? {
        all.first { $0.id == id }
    }

    static func find(byName name: String) -> Country? {
        all.first { $0.name.lowercased() == name.lowercased() }
    }
}

// MARK: - Available Topics

enum Topics {
    static let all: [Topic] = [
        Topic(id: "politics", name: "Politics", icon: "building.columns"),
        Topic(id: "economy", name: "Economy", icon: "chart.line.uptrend.xyaxis"),
        Topic(id: "technology", name: "Technology", icon: "cpu"),
        Topic(id: "science", name: "Science", icon: "atom"),
        Topic(id: "health", name: "Health", icon: "heart.fill"),
        Topic(id: "environment", name: "Environment", icon: "leaf.fill"),
        Topic(id: "business", name: "Business", icon: "briefcase.fill"),
        Topic(id: "defense", name: "Defense", icon: "shield.fill"),
        Topic(id: "diplomacy", name: "Diplomacy", icon: "globe"),
        Topic(id: "energy", name: "Energy", icon: "bolt.fill"),
        Topic(id: "ai", name: "Artificial Intelligence", icon: "brain"),
        Topic(id: "space", name: "Space", icon: "sparkles"),
        Topic(id: "cybersecurity", name: "Cybersecurity", icon: "lock.shield"),
        Topic(id: "trade", name: "Trade", icon: "arrow.left.arrow.right"),
        Topic(id: "climate", name: "Climate", icon: "cloud.sun.fill"),
        Topic(id: "human_rights", name: "Human Rights", icon: "person.2.fill"),
        Topic(id: "migration", name: "Migration", icon: "airplane.departure"),
        Topic(id: "education", name: "Education", icon: "book.fill"),
        Topic(id: "finance", name: "Finance", icon: "dollarsign.circle.fill"),
        Topic(id: "crypto", name: "Cryptocurrency", icon: "bitcoinsign.circle.fill"),
        Topic(id: "sports", name: "Sports", icon: "sportscourt.fill"),
        Topic(id: "entertainment", name: "Entertainment", icon: "film.fill"),
        Topic(id: "culture", name: "Culture", icon: "theatermasks.fill"),
        Topic(id: "conflict", name: "Conflict", icon: "exclamationmark.triangle.fill"),
        Topic(id: "disaster", name: "Natural Disasters", icon: "tornado"),
        Topic(id: "law", name: "Law & Justice", icon: "scale.3d"),
        Topic(id: "transportation", name: "Transportation", icon: "car.fill"),
        Topic(id: "agriculture", name: "Agriculture", icon: "leaf.arrow.circlepath"),
        Topic(id: "infrastructure", name: "Infrastructure", icon: "building.2.fill"),
    ]

    static func find(byId id: String) -> Topic? {
        all.first { $0.id == id }
    }
}

// MARK: - Region Names

enum RegionNames {
    static let northAmerica = "North America"
    static let southAmerica = "South America"
    static let europe = "Europe"
    static let asia = "Asia"
    static let middleEast = "Middle East"
    static let oceania = "Oceania"
    static let africa = "Africa"

    static let all: [String] = [
        northAmerica, europe, asia, middleEast, southAmerica, oceania, africa,
    ]
}
