import SwiftUI

/// Shows multiple perspectives with viewpoint, summary, source, and region
struct EventPerspectivesView: View {
    let data: PerspectivesData

    private var perspectives: [Perspective] { data.perspectives ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(data.title?.uppercased() ?? "PERSPECTIVES")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            ForEach(Array(perspectives.enumerated()), id: \.offset) { index, perspective in
                perspectiveCard(perspective, index: index)
            }
        }
    }

    private func perspectiveCard(_ perspective: Perspective, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header with stance badge
            HStack {
                if let viewpoint = perspective.viewpoint {
                    Text(viewpoint)
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(stanceColor(index: index))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(stanceColor(index: index).opacity(0.12))
                        )
                }

                Spacer()

                if let region = perspective.region {
                    Text(region)
                        .font(Theme.Fonts.footnote())
                        .foregroundStyle(Theme.Colors.tertiaryText)
                }
            }

            // Summary / position
            if let summary = perspective.summary {
                Text(summary)
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.primaryText)
                    .lineSpacing(4)
            }

            // Source
            if let source = perspective.source {
                Text("Source: \(source)")
                    .font(Theme.Fonts.footnote())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }

    private func stanceColor(index: Int) -> Color {
        let colors: [Color] = [
            Color(hex: "#007AFF"),
            Color(hex: "#FF9500"),
            Color(hex: "#34C759"),
            Color(hex: "#AF52DE"),
            Color(hex: "#FF3B30"),
            Color(hex: "#5AC8FA"),
        ]
        return colors[index % colors.count]
    }
}

#Preview {
    let data = PerspectivesData(
        title: "Perspectives",
        perspectives: [
            Perspective(id: "1", viewpoint: "Western Nations", summary: "Strong support for binding carbon targets with financial commitments to developing nations.", source: "EU Commission", region: "Europe"),
            Perspective(id: "2", viewpoint: "Developing Nations", summary: "Cautious optimism but concerns about economic impact on industrializing economies.", source: "African Union", region: "Africa"),
        ]
    )
    return ScrollView {
        EventPerspectivesView(data: data)
            .padding()
    }
}
