import SwiftUI

/// "What to Watch" items with title, timeframe, description, likelihood badge
struct EventWhatToWatchView: View {
    let data: WhatToWatchData

    private var items: [WhatToWatchItem] { data.items ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(data.title?.uppercased() ?? "WHAT TO WATCH")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                watchItemCard(item)
            }
        }
    }

    private func watchItemCard(_ item: WhatToWatchItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    if let title = item.title {
                        Text(title)
                            .font(Theme.Fonts.cardTitle())
                            .foregroundStyle(Theme.Colors.primaryText)
                            .lineLimit(2)
                    }

                    // Timeframe
                    if let date = item.date {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(.system(size: 11))
                            Text(date)
                                .font(Theme.Fonts.footnote())
                        }
                        .foregroundStyle(Theme.Colors.secondaryText)
                    }
                }

                Spacer()

                // Importance/likelihood badge
                if let importance = item.importance {
                    Text(importance.capitalized)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(importanceColor(importance))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(importanceColor(importance).opacity(0.12))
                        )
                }
            }

            // Description
            if let description = item.description, !description.isEmpty {
                Text(description)
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.bodyText)
                    .lineSpacing(4)
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }

    private func importanceColor(_ importance: String) -> Color {
        switch importance.lowercased() {
        case "high", "critical", "likely":
            return Color(hex: "#FF3B30")
        case "medium", "moderate", "possible":
            return Color(hex: "#FF9500")
        case "low", "unlikely":
            return Color(hex: "#34C759")
        default:
            return Theme.Colors.accent
        }
    }
}

#Preview {
    let data = WhatToWatchData(
        title: "What to Watch",
        items: [
            WhatToWatchItem(id: "1", title: "Implementation Summit", description: "Follow-up meeting to establish enforcement mechanisms for carbon targets.", date: "March 2025", importance: "high"),
            WhatToWatchItem(id: "2", title: "Green Energy Fund Launch", description: "Initial disbursement of the $500B fund to qualifying nations.", date: "June 2025", importance: "medium"),
        ]
    )
    return ScrollView {
        EventWhatToWatchView(data: data)
            .padding()
    }
}
