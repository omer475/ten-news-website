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
        Country(id: "PK", name: "Pakistan", flag: "🇵🇰", region: "Asia"),
        Country(id: "IR", name: "Iran", flag: "🇮🇷", region: "Middle East"),
        Country(id: "SA", name: "Saudi Arabia", flag: "🇸🇦", region: "Middle East"),
        Country(id: "AE", name: "UAE", flag: "🇦🇪", region: "Middle East"),
        Country(id: "ES", name: "Spain", flag: "🇪🇸", region: "Europe"),
        Country(id: "IT", name: "Italy", flag: "🇮🇹", region: "Europe"),
        Country(id: "MX", name: "Mexico", flag: "🇲🇽", region: "North America"),
        Country(id: "AF", name: "Afghanistan", flag: "🇦🇫", region: "Asia"),
        Country(id: "IQ", name: "Iraq", flag: "🇮🇶", region: "Middle East"),
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
        // New topics
        Topic(id: "tennis", name: "Tennis", icon: "tennisball.fill"),
        Topic(id: "golf", name: "Golf", icon: "figure.golf"),
        Topic(id: "bollywood", name: "Bollywood & Indian Cinema", icon: "film.fill"),
        Topic(id: "anime_manga", name: "Anime & Manga", icon: "sparkles"),
        Topic(id: "hip_hop", name: "Hip-Hop & Rap", icon: "music.mic"),
        Topic(id: "afrobeats", name: "Afrobeats & African Music", icon: "music.note"),
        Topic(id: "latin_music", name: "Latin Music & Reggaeton", icon: "guitars.fill"),
        Topic(id: "comedy", name: "Comedy & Humor", icon: "theatermasks.fill"),
        Topic(id: "food_cooking", name: "Food & Cooking", icon: "fork.knife"),
        Topic(id: "travel_adventure", name: "Travel & Adventure", icon: "airplane"),
        Topic(id: "fitness_workout", name: "Fitness & Workout", icon: "figure.run"),
        Topic(id: "beauty_skincare", name: "Beauty & Skincare", icon: "sparkle"),
        Topic(id: "parenting_family", name: "Parenting & Family", icon: "figure.2.and.child.holdinghands"),
        Topic(id: "news", name: "Breaking News & World Affairs", icon: "newspaper.fill"),
    ]

    static func find(byId id: String) -> Topic? {
        all.first { $0.id == id }
    }
}

// MARK: - Topic Category (hierarchical)

struct TopicCategory: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: String
    let subtopics: [Topic]
}

enum TopicCategories {
    static let all: [TopicCategory] = [
        TopicCategory(id: "news_politics", name: "News & Politics", icon: "newspaper.fill", subtopics: [
            Topic(id: "news", name: "Breaking News & World Affairs", icon: "newspaper.fill"),
            Topic(id: "war_conflict", name: "War & Conflict", icon: "exclamationmark.triangle.fill"),
            Topic(id: "us_politics", name: "US Politics", icon: "flag.fill"),
            Topic(id: "european_politics", name: "European Politics", icon: "globe.europe.africa"),
            Topic(id: "asian_politics", name: "Asian Politics", icon: "globe.asia.australia"),
            Topic(id: "middle_east", name: "Middle East", icon: "mappin.circle.fill"),
            Topic(id: "latin_america", name: "Latin America", icon: "globe.americas"),
            Topic(id: "africa_oceania", name: "Africa & Oceania", icon: "globe"),
            Topic(id: "human_rights", name: "Human Rights", icon: "person.2.fill"),
        ]),
        TopicCategory(id: "sports", name: "Sports", icon: "sportscourt.fill", subtopics: [
            Topic(id: "nfl", name: "NFL", icon: "football.fill"),
            Topic(id: "nba", name: "NBA", icon: "basketball.fill"),
            Topic(id: "soccer", name: "Soccer", icon: "soccerball"),
            Topic(id: "baseball", name: "Baseball", icon: "baseball.fill"),
            Topic(id: "cricket", name: "Cricket", icon: "figure.cricket"),
            Topic(id: "f1_motorsport", name: "F1 & Motorsport", icon: "car.fill"),
            Topic(id: "boxing_mma", name: "Boxing & MMA", icon: "figure.boxing"),
            Topic(id: "olympics", name: "Olympics", icon: "medal.fill"),
            Topic(id: "tennis", name: "Tennis", icon: "tennisball.fill"),
            Topic(id: "golf", name: "Golf", icon: "figure.golf"),
        ]),
        TopicCategory(id: "business", name: "Business", icon: "briefcase.fill", subtopics: [
            Topic(id: "oil_energy", name: "Oil & Energy", icon: "bolt.fill"),
            Topic(id: "automotive", name: "Automotive", icon: "car.fill"),
            Topic(id: "retail_consumer", name: "Retail & Consumer", icon: "cart.fill"),
            Topic(id: "corporate_deals", name: "Corporate Deals", icon: "handshake.fill"),
            Topic(id: "trade_tariffs", name: "Trade & Tariffs", icon: "arrow.left.arrow.right"),
            Topic(id: "corporate_earnings", name: "Corporate Earnings", icon: "chart.bar.fill"),
            Topic(id: "startups_vc", name: "Startups & VC", icon: "lightbulb.fill"),
            Topic(id: "real_estate", name: "Real Estate", icon: "building.2.fill"),
        ]),
        TopicCategory(id: "entertainment", name: "Entertainment", icon: "film.fill", subtopics: [
            Topic(id: "movies_film", name: "Movies & Film", icon: "film.fill"),
            Topic(id: "tv_streaming", name: "TV & Streaming", icon: "tv.fill"),
            Topic(id: "music", name: "Music", icon: "music.note"),
            Topic(id: "gaming", name: "Gaming", icon: "gamecontroller.fill"),
            Topic(id: "celebrity_news", name: "Celebrity News", icon: "star.fill"),
            Topic(id: "kpop_kdrama", name: "K-Pop & K-Drama", icon: "music.mic"),
            Topic(id: "bollywood", name: "Bollywood & Indian Cinema", icon: "film.fill"),
            Topic(id: "anime_manga", name: "Anime & Manga", icon: "sparkles"),
            Topic(id: "hip_hop", name: "Hip-Hop & Rap", icon: "music.mic"),
            Topic(id: "afrobeats", name: "Afrobeats & African Music", icon: "music.note"),
            Topic(id: "latin_music", name: "Latin Music & Reggaeton", icon: "guitars.fill"),
            Topic(id: "comedy", name: "Comedy & Humor", icon: "theatermasks.fill"),
        ]),
        TopicCategory(id: "tech", name: "Tech", icon: "cpu", subtopics: [
            Topic(id: "ai_ml", name: "AI & ML", icon: "brain"),
            Topic(id: "smartphones_gadgets", name: "Smartphones & Gadgets", icon: "iphone"),
            Topic(id: "social_media", name: "Social Media", icon: "bubble.left.and.bubble.right.fill"),
            Topic(id: "cybersecurity", name: "Cybersecurity", icon: "lock.shield"),
            Topic(id: "space_tech", name: "Space Tech", icon: "sparkles"),
            Topic(id: "robotics_hardware", name: "Robotics & Hardware", icon: "gearshape.2.fill"),
        ]),
        TopicCategory(id: "science", name: "Science", icon: "atom", subtopics: [
            Topic(id: "space_astronomy", name: "Space & Astronomy", icon: "moon.stars.fill"),
            Topic(id: "climate_environment", name: "Climate & Environment", icon: "cloud.sun.fill"),
            Topic(id: "biology_nature", name: "Biology & Nature", icon: "leaf.fill"),
            Topic(id: "earth_science", name: "Earth Science", icon: "globe.americas.fill"),
        ]),
        TopicCategory(id: "health", name: "Health", icon: "heart.fill", subtopics: [
            Topic(id: "medical_breakthroughs", name: "Medical Breakthroughs", icon: "cross.case.fill"),
            Topic(id: "public_health", name: "Public Health", icon: "heart.fill"),
            Topic(id: "mental_health", name: "Mental Health", icon: "brain.head.profile"),
            Topic(id: "pharma_drugs", name: "Pharma & Drug Industry", icon: "pills.fill"),
        ]),
        TopicCategory(id: "finance", name: "Finance", icon: "chart.line.uptrend.xyaxis", subtopics: [
            Topic(id: "stock_markets", name: "Stock Markets", icon: "chart.bar.fill"),
            Topic(id: "banking_lending", name: "Banking & Lending", icon: "building.columns.fill"),
            Topic(id: "commodities", name: "Commodities", icon: "dollarsign.circle.fill"),
        ]),
        TopicCategory(id: "crypto", name: "Crypto", icon: "bitcoinsign.circle.fill", subtopics: [
            Topic(id: "bitcoin", name: "Bitcoin", icon: "bitcoinsign.circle.fill"),
            Topic(id: "defi_web3", name: "DeFi & Web3", icon: "network"),
            Topic(id: "crypto_regulation", name: "Crypto Regulation", icon: "doc.text.fill"),
        ]),
        TopicCategory(id: "lifestyle", name: "Lifestyle", icon: "heart.circle.fill", subtopics: [
            Topic(id: "pets_animals", name: "Pets & Animals", icon: "pawprint.fill"),
            Topic(id: "home_garden", name: "Home & Garden", icon: "house.fill"),
            Topic(id: "shopping_reviews", name: "Shopping & Reviews", icon: "bag.fill"),
            Topic(id: "food_cooking", name: "Food & Cooking", icon: "fork.knife"),
            Topic(id: "travel_adventure", name: "Travel & Adventure", icon: "airplane"),
            Topic(id: "fitness_workout", name: "Fitness & Workout", icon: "figure.run"),
            Topic(id: "beauty_skincare", name: "Beauty & Skincare", icon: "sparkle"),
            Topic(id: "parenting_family", name: "Parenting & Family", icon: "figure.2.and.child.holdinghands"),
        ]),
        TopicCategory(id: "fashion", name: "Fashion", icon: "tshirt.fill", subtopics: [
            Topic(id: "sneakers_streetwear", name: "Sneakers & Streetwear", icon: "shoe.fill"),
            Topic(id: "celebrity_style", name: "Celebrity Style", icon: "sparkles"),
        ]),
    ]
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
