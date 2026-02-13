import SwiftUI

/// Latest development card with title, summary, source
struct EventLatestDevelopmentView: View {
    let development: LatestDevelopment

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("LATEST DEVELOPMENT")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(alignment: .leading, spacing: 10) {
                // Title
                if let title = development.title {
                    Text(title)
                        .font(Theme.Fonts.cardTitle())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineSpacing(2)
                }

                // Date and source
                HStack(spacing: 8) {
                    if let date = development.date {
                        TimeAgoText(date)
                    }
                    if let source = development.source {
                        Text(source)
                            .font(Theme.Fonts.footnote())
                            .foregroundStyle(Theme.Colors.accent)
                    }
                }

                // Summary
                if let summary = development.summary, !summary.isEmpty {
                    Text(summary)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.bodyText)
                        .lineSpacing(5)
                }

                // Detail items from components
                if let details = development.components?.details, !details.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(details.prefix(4).enumerated()), id: \.offset) { _, item in
                            HStack(alignment: .top, spacing: 8) {
                                Circle()
                                    .fill(Theme.Colors.accent)
                                    .frame(width: 5, height: 5)
                                    .padding(.top, 6)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.displayLabel)
                                        .font(Theme.Fonts.captionMedium())
                                        .foregroundStyle(Theme.Colors.secondaryText)
                                    Text(item.displayValue)
                                        .font(Theme.Fonts.body())
                                        .foregroundStyle(Theme.Colors.primaryText)
                                }
                            }
                        }
                    }
                }
            }
            .padding(Theme.Spacing.md)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }
}

#Preview {
    let dev = LatestDevelopment(
        id: FlexibleID("1"),
        title: "New Climate Agreement Ratified",
        summary: "The latest round of negotiations has concluded with all parties agreeing to enhanced carbon targets.",
        date: "2024-12-15T10:30:00.000Z",
        source: "Reuters",
        url: nil,
        components: nil
    )
    return ScrollView {
        EventLatestDevelopmentView(development: dev)
            .padding()
    }
}
