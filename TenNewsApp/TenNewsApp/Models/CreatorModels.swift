import Foundation

struct Creator: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let username: String
    let bio: String
    let avatarUrl: String?
    let isVerified: Bool
    let followerCount: Int
    let followingCount: Int
    let articleCount: Int
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id, name, username, bio, category
        case avatarUrl = "avatar_url"
        case isVerified = "is_verified"
        case followerCount = "follower_count"
        case followingCount = "following_count"
        case articleCount = "article_count"
    }

    var displayInitial: String {
        String(name.prefix(1)).uppercased()
    }
}

// MARK: - Sample Creators (mapped from news sources)

enum SampleCreators {
    static let all: [String: Creator] = {
        var map: [String: Creator] = [:]
        for creator in list { map[creator.name] = creator }
        return map
    }()

    static let list: [Creator] = [
        Creator(
            id: "creator_reuters", name: "Reuters", username: "reuters",
            bio: "Trusted global news agency delivering breaking news, analysis, and multimedia from around the world since 1851.",
            avatarUrl: nil, isVerified: true,
            followerCount: 284_000, followingCount: 0, articleCount: 12_450,
            category: "News"
        ),
        Creator(
            id: "creator_bbc", name: "BBC News", username: "bbcnews",
            bio: "The world's most trusted news source. Breaking stories, features, and expert analysis from every corner of the globe.",
            avatarUrl: nil, isVerified: true,
            followerCount: 520_000, followingCount: 0, articleCount: 18_200,
            category: "News"
        ),
        Creator(
            id: "creator_cnn", name: "CNN", username: "cnn",
            bio: "Go there. CNN delivers the latest breaking news and information on the latest top stories, politics, business, entertainment, and more.",
            avatarUrl: nil, isVerified: true,
            followerCount: 445_000, followingCount: 0, articleCount: 15_800,
            category: "News"
        ),
        Creator(
            id: "creator_nyt", name: "The New York Times", username: "nytimes",
            bio: "The New York Times: Find breaking news, multimedia, reviews & opinion on Washington, business, sports, movies, travel, books, jobs, education, real estate, cars & more at nytimes.com.",
            avatarUrl: nil, isVerified: true,
            followerCount: 612_000, followingCount: 0, articleCount: 22_100,
            category: "News"
        ),
        Creator(
            id: "creator_ap", name: "Associated Press", username: "apnews",
            bio: "Advancing the power of facts. Independent, not-for-profit news cooperative. Breaking news from around the globe.",
            avatarUrl: nil, isVerified: true,
            followerCount: 198_000, followingCount: 0, articleCount: 9_800,
            category: "News"
        ),
        Creator(
            id: "creator_bloomberg", name: "Bloomberg", username: "bloomberg",
            bio: "Global business and financial news, stock quotes, and market data & analysis.",
            avatarUrl: nil, isVerified: true,
            followerCount: 380_000, followingCount: 0, articleCount: 14_500,
            category: "Business"
        ),
        Creator(
            id: "creator_espn", name: "ESPN", username: "espn",
            bio: "The Worldwide Leader in Sports. Scores, highlights, analysis, and fantasy sports.",
            avatarUrl: nil, isVerified: true,
            followerCount: 890_000, followingCount: 0, articleCount: 25_600,
            category: "Sports"
        ),
        Creator(
            id: "creator_techcrunch", name: "TechCrunch", username: "techcrunch",
            bio: "Reporting on the business of technology, startups, venture capital funding, and Silicon Valley.",
            avatarUrl: nil, isVerified: true,
            followerCount: 310_000, followingCount: 0, articleCount: 8_900,
            category: "Tech"
        ),
        Creator(
            id: "creator_theverge", name: "The Verge", username: "theverge",
            bio: "The Verge covers the intersection of technology, science, art, and culture.",
            avatarUrl: nil, isVerified: true,
            followerCount: 275_000, followingCount: 0, articleCount: 7_200,
            category: "Tech"
        ),
        Creator(
            id: "creator_guardian", name: "The Guardian", username: "guardian",
            bio: "The Guardian is a British daily newspaper. Independent journalism from around the world.",
            avatarUrl: nil, isVerified: true,
            followerCount: 410_000, followingCount: 0, articleCount: 16_300,
            category: "News"
        ),
    ]

    static func find(bySource source: String) -> Creator {
        // Try exact match first
        if let creator = all[source] { return creator }

        // Try partial match
        let lowered = source.lowercased()
        if let creator = list.first(where: { lowered.contains($0.name.lowercased()) || $0.name.lowercased().contains(lowered) }) {
            return creator
        }

        // Generate a creator from the source name
        let id = "creator_\(source.lowercased().replacingOccurrences(of: " ", with: "_"))"
        return Creator(
            id: id, name: source, username: source.lowercased().replacingOccurrences(of: " ", with: ""),
            bio: "Follow \(source) for the latest news and updates.",
            avatarUrl: nil, isVerified: false,
            followerCount: Int.random(in: 1_000...50_000),
            followingCount: 0,
            articleCount: Int.random(in: 100...2_000),
            category: nil
        )
    }
}
