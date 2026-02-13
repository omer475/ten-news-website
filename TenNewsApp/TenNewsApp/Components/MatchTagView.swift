import SwiftUI

/// Small pill tag showing match reason (country or topic)
struct MatchTagView: View {
    let text: String
    var type: TagType = .topic

    enum TagType {
        case country
        case topic

        var textColor: Color {
            switch self {
            case .country: return Theme.Colors.accent
            case .topic: return Theme.Colors.matchTagText
            }
        }

        var backgroundColor: Color {
            switch self {
            case .country: return Theme.Colors.accent.opacity(0.1)
            case .topic: return Theme.Colors.matchTagBackground
            }
        }
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(type.textColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(type.backgroundColor)
            )
    }
}

/// Boost badge for personalized feed score boosts
struct BoostBadge: View {
    let text: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 10))
            Text(text)
                .font(.system(size: 11, weight: .medium))
        }
        .foregroundStyle(Theme.Colors.boostText)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            Capsule()
                .fill(Theme.Colors.boostBackground)
        )
    }
}

#Preview("Match Tags") {
    VStack(spacing: 12) {
        HStack {
            MatchTagView(text: "United States", type: .country)
            MatchTagView(text: "Technology", type: .topic)
        }
        BoostBadge(text: "Boosted")
    }
    .padding()
}
