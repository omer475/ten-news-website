import SwiftUI

/// Event-specific timeline for WorldEventFull timeline entries
struct EventTimelineView: View {
    let entries: [TimelineEntry]

    private let dotColors: [Color] = [
        Color(hex: "#007AFF"),
        Color(hex: "#34C759"),
        Color(hex: "#FF9500"),
        Color(hex: "#AF52DE"),
        Color(hex: "#FF3B30"),
        Color(hex: "#5AC8FA"),
        Color(hex: "#FF2D55"),
        Color(hex: "#FFD60A"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TIMELINE")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(entries.enumerated()), id: \.offset) { index, entry in
                    timelineRow(entry: entry, index: index, isLast: index == entries.count - 1)
                }
            }
            .padding(Theme.Spacing.md)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }

    private func timelineRow(entry: TimelineEntry, index: Int, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: 14) {
            // Dot and connecting line
            VStack(spacing: 0) {
                Circle()
                    .fill(dotColors[index % dotColors.count])
                    .frame(width: 10, height: 10)

                if !isLast {
                    Rectangle()
                        .fill(Theme.Colors.separator)
                        .frame(width: 2)
                        .frame(minHeight: 36)
                }
            }

            // Entry content
            VStack(alignment: .leading, spacing: 3) {
                if let date = entry.date, !date.isEmpty {
                    Text(date)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(dotColors[index % dotColors.count])
                }

                Text(entry.displayText)
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.primaryText)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)

                if let source = entry.sourceArticleId, !source.isEmpty {
                    Text("Source #\(source)")
                        .font(Theme.Fonts.footnote())
                        .foregroundStyle(Theme.Colors.tertiaryText)
                }
            }
            .padding(.bottom, isLast ? 0 : 12)
        }
    }
}

#Preview {
    ScrollView {
        EventTimelineView(entries: PreviewData.sampleArticle.timeline ?? [])
            .padding()
    }
}
