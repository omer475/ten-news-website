import SwiftUI

/// Category label badge with category-specific colors
struct CategoryBadge: View {
    let category: String

    var body: some View {
        Text(category.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(categoryColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(categoryColor.opacity(0.12))
            )
    }

    private var categoryColor: Color {
        switch category.lowercased() {
        case "politics": return Color(hex: "#4facfe")
        case "economy", "finance": return Color(hex: "#11998e")
        case "technology", "tech": return Color(hex: "#667eea")
        case "science": return Color(hex: "#fa709a")
        case "health": return Color(hex: "#a8edea")
        case "climate", "environment": return Color(hex: "#43e97b")
        case "business": return Color(hex: "#38ef7d")
        case "sports": return Color(hex: "#ff9a9e")
        case "entertainment": return Color(hex: "#fcb69f")
        case "defense", "conflict": return Color(hex: "#FF3B30")
        case "diplomacy": return Color(hex: "#AF52DE")
        case "energy": return Color(hex: "#FF9500")
        case "ai": return Color(hex: "#764ba2")
        default: return Theme.Colors.accent
        }
    }
}

#Preview("Category Badges") {
    VStack(spacing: 8) {
        HStack {
            CategoryBadge(category: "Politics")
            CategoryBadge(category: "Technology")
            CategoryBadge(category: "Climate")
        }
        HStack {
            CategoryBadge(category: "Economy")
            CategoryBadge(category: "Health")
            CategoryBadge(category: "Science")
        }
    }
    .padding()
}
