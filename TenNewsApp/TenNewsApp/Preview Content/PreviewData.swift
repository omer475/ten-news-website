import Foundation

// MARK: - Preview Data

/// Sample data for SwiftUI previews and testing
/// Uses JSON decode approach since FiveWs has a custom decoder
enum PreviewData {

    // MARK: - Sample Article

    static let sampleArticle: Article = {
        let json: [String: Any] = [
            "id": 99901,
            "title_news": "**Global Leaders** Agree on Historic **Climate Deal**",
            "title": "Global Leaders Agree on Historic Climate Deal",
            "summary_text": "World leaders from over 190 countries reached a landmark agreement on climate action, setting ambitious targets for carbon reduction by 2035.",
            "summary": "World leaders reached a landmark climate agreement.",
            "summary_bullets_news": [
                "**190+ countries** signed the agreement",
                "Carbon reduction targets set for **2035**",
                "**$500 billion** committed to green energy fund",
            ],
            "summary_bullets": [
                "190+ countries signed the agreement",
                "Carbon reduction targets set for 2035",
                "$500 billion committed to green energy fund",
            ],
            "details": [
                ["label": "Agreement", "value": "Paris Climate Accord Extension"],
                ["label": "Countries", "value": "193 signatory nations"],
                ["label": "Funding", "value": "$500 billion green energy fund"],
                ["label": "Target", "value": "50% carbon reduction by 2035"],
            ],
            "url": "https://tennews.ai/articles/99901",
            "image_url": "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800",
            "source": "Ten News",
            "category": "Climate",
            "emoji": "🌍",
            "timeline": [
                ["date": "2024-01", "event": "Preliminary talks begin in Geneva"],
                ["date": "2024-06", "event": "Draft agreement circulated among nations"],
                ["date": "2024-09", "event": "Final negotiations at UN General Assembly"],
                ["date": "2024-12", "event": "Historic deal signed by 193 countries"],
            ],
            "five_ws": [
                "who": "Leaders from 193 countries at the UN Climate Summit",
                "what": "Signed a historic climate agreement with binding carbon targets",
                "when": "December 2024",
                "where": "United Nations Headquarters, New York",
                "why": "To combat accelerating climate change and meet Paris Agreement goals",
            ],
            "components": ["details", "timeline", "five_ws", "graph"],
            "publishedAt": "2024-12-15T10:30:00.000Z",
            "final_score": 920,
            "base_score": 850,
            "world_event": [
                "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "name": "Global Climate Summit 2024",
                "slug": "global-climate-summit-2024",
            ],
            "countries": ["US", "GB", "FR", "DE", "CN"],
            "topics": ["climate", "diplomacy", "environment"],
            "citations": [
                ["source": "UN Press", "url": "https://press.un.org/climate-deal", "title": "Historic Climate Agreement Reached"],
                ["source": "Reuters", "url": "https://reuters.com/climate", "title": "World Leaders Sign Climate Pact"],
            ],
        ]
        let data = try! JSONSerialization.data(withJSONObject: json)
        return try! JSONDecoder().decode(Article.self, from: data)
    }()

    // MARK: - Sample Articles

    static let sampleArticles: [Article] = {
        let articles: [[String: Any]] = [
            [
                "id": 99901,
                "title_news": "**Global Leaders** Agree on Historic **Climate Deal**",
                "summary_text": "World leaders from over 190 countries reached a landmark agreement on climate action.",
                "image_url": "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800",
                "source": "Ten News",
                "category": "Climate",
                "emoji": "🌍",
                "publishedAt": "2024-12-15T10:30:00.000Z",
                "final_score": 920,
                "countries": ["US", "GB", "FR"],
                "topics": ["climate"],
                "components": ["details", "timeline"],
            ],
            [
                "id": 99902,
                "title_news": "**Tech Giants** Report Record **AI Investment**",
                "summary_text": "Major technology companies have collectively invested over $200 billion in artificial intelligence research.",
                "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
                "source": "Ten News",
                "category": "Technology",
                "emoji": "🤖",
                "publishedAt": "2024-12-14T08:00:00.000Z",
                "final_score": 870,
                "countries": ["US"],
                "topics": ["technology", "ai"],
                "components": ["details"],
            ],
            [
                "id": 99903,
                "title_news": "**Central Banks** Signal Coordinated **Rate Cuts**",
                "summary_text": "Federal Reserve and European Central Bank hint at synchronized interest rate reductions in early 2025.",
                "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
                "source": "Ten News",
                "category": "Economy",
                "emoji": "📉",
                "publishedAt": "2024-12-13T14:15:00.000Z",
                "final_score": 810,
                "countries": ["US", "DE"],
                "topics": ["economy", "finance"],
                "components": ["details", "graph"],
            ],
            [
                "id": 99904,
                "title_news": "**Space Agency** Announces **Mars Mission** Timeline",
                "summary_text": "NASA reveals detailed timeline for crewed Mars mission, targeting 2035 launch window.",
                "image_url": "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=800",
                "source": "Ten News",
                "category": "Science",
                "emoji": "🚀",
                "publishedAt": "2024-12-12T16:45:00.000Z",
                "final_score": 780,
                "countries": ["US"],
                "topics": ["science", "space"],
                "components": ["details", "timeline"],
            ],
            [
                "id": 99905,
                "title_news": "**WHO** Declares End of **Global Health Emergency**",
                "summary_text": "World Health Organization officially lifts the global health emergency status after three years.",
                "image_url": "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=800",
                "source": "Ten News",
                "category": "Health",
                "emoji": "🏥",
                "publishedAt": "2024-12-11T09:20:00.000Z",
                "final_score": 950,
                "countries": ["US", "GB", "IN", "BR"],
                "topics": ["health"],
                "components": ["details", "five_ws"],
            ],
        ]
        let data = try! JSONSerialization.data(withJSONObject: articles)
        return try! JSONDecoder().decode([Article].self, from: data)
    }()

    // MARK: - Sample World Event

    static let sampleEvent: WorldEvent = {
        let json: [String: Any] = [
            "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            "name": "Global Climate Summit 2024",
            "slug": "global-climate-summit-2024",
            "image_url": "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800",
            "blur_color": "#1a5c2e",
            "importance": 9,
            "status": "active",
            "last_article_at": "2024-12-15T10:30:00.000Z",
            "created_at": "2024-01-10T00:00:00.000Z",
            "background": "The Global Climate Summit brings together world leaders to address accelerating climate change.",
            "countries": ["US", "GB", "FR", "DE", "CN"],
            "topics": ["climate", "diplomacy", "environment"],
        ]
        let data = try! JSONSerialization.data(withJSONObject: json)
        return try! JSONDecoder().decode(WorldEvent.self, from: data)
    }()

    // MARK: - Sample World Events

    static let sampleEvents: [WorldEvent] = {
        let events: [[String: Any]] = [
            [
                "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "name": "Global Climate Summit 2024",
                "slug": "global-climate-summit-2024",
                "importance": 9,
                "status": "active",
                "last_article_at": "2024-12-15T10:30:00.000Z",
                "countries": ["US", "GB", "FR"],
                "topics": ["climate"],
            ],
            [
                "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
                "name": "US Presidential Election 2024",
                "slug": "us-presidential-election-2024",
                "importance": 10,
                "status": "active",
                "last_article_at": "2024-12-14T08:00:00.000Z",
                "countries": ["US"],
                "topics": ["politics"],
            ],
            [
                "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
                "name": "AI Regulation Debate",
                "slug": "ai-regulation-debate",
                "importance": 8,
                "status": "active",
                "last_article_at": "2024-12-13T14:15:00.000Z",
                "countries": ["US", "GB", "DE"],
                "topics": ["technology", "ai"],
            ],
        ]
        let data = try! JSONSerialization.data(withJSONObject: events)
        return try! JSONDecoder().decode([WorldEvent].self, from: data)
    }()

    // MARK: - Sample Preferences

    static let samplePreferences: UserPreferences = UserPreferences(
        homeCountry: "US",
        followedCountries: ["US", "GB", "DE"],
        followedTopics: ["technology", "climate", "economy"],
        onboardingCompleted: true,
        authUserId: "preview-user-123"
    )
}
