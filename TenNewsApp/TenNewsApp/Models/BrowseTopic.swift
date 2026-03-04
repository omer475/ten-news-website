import SwiftUI

struct BrowseTopic: Identifiable {
    let id: String
    let name: String
    let icon: String
    let color: Color

    static let allTopics: [BrowseTopic] = [
        BrowseTopic(id: "politics", name: "Politics", icon: "building.columns.fill", color: Color(hex: "#4A6CF7")),
        BrowseTopic(id: "technology", name: "Technology", icon: "cpu.fill", color: Color(hex: "#7C3AED")),
        BrowseTopic(id: "business", name: "Business", icon: "chart.line.uptrend.xyaxis", color: Color(hex: "#059669")),
        BrowseTopic(id: "world", name: "World", icon: "globe.americas.fill", color: Color(hex: "#0891B2")),
        BrowseTopic(id: "science", name: "Science", icon: "atom", color: Color(hex: "#D946EF")),
        BrowseTopic(id: "health", name: "Health", icon: "heart.fill", color: Color(hex: "#E11D48")),
        BrowseTopic(id: "finance", name: "Finance", icon: "dollarsign.circle.fill", color: Color(hex: "#CA8A04")),
        BrowseTopic(id: "sports", name: "Sports", icon: "sportscourt.fill", color: Color(hex: "#EA580C")),
        BrowseTopic(id: "climate", name: "Climate", icon: "leaf.fill", color: Color(hex: "#16A34A")),
        BrowseTopic(id: "entertainment", name: "Entertainment", icon: "film.fill", color: Color(hex: "#DB2777")),
        BrowseTopic(id: "conflict", name: "Conflict", icon: "shield.fill", color: Color(hex: "#64748B")),
        BrowseTopic(id: "space", name: "Space", icon: "sparkles", color: Color(hex: "#1E1B4B")),
    ]
}
