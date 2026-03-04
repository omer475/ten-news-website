import SwiftUI

/// Simple bar chart visualization using GraphData/GraphPoint
struct ArticleGraphView: View {
    let graph: GraphData

    private var points: [GraphPoint] { graph.data ?? [] }

    private var maxValue: Double {
        points.map(\.displayValue).max() ?? 1
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            // Title
            if let title = graph.title, !title.isEmpty {
                Text(title.uppercased())
                    .font(Theme.Fonts.sectionLabel())
                    .foregroundStyle(Theme.Colors.secondaryText)
                    .tracking(1)
            }

            if points.isEmpty {
                Text("No data available")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, Theme.Spacing.xl)
            } else {
                // Y-axis label
                if let yLabel = graph.yLabel {
                    Text(yLabel)
                        .font(Theme.Fonts.footnote())
                        .foregroundStyle(Theme.Colors.tertiaryText)
                }

                // Bar chart
                HStack(alignment: .bottom, spacing: barSpacing) {
                    ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                        barView(point: point, index: index)
                    }
                }
                .frame(height: 180)
                .padding(.top, 8)

                // X-axis label
                if let xLabel = graph.xLabel {
                    Text(xLabel)
                        .font(Theme.Fonts.footnote())
                        .foregroundStyle(Theme.Colors.tertiaryText)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }

    private var barSpacing: CGFloat {
        points.count > 8 ? 4 : 8
    }

    private func barView(point: GraphPoint, index: Int) -> some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)

            // Value label
            Text(formatValue(point.displayValue))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Colors.accent)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            // Bar
            RoundedRectangle(cornerRadius: 4)
                .fill(barColor(index: index))
                .frame(maxWidth: .infinity)
                .frame(height: barHeight(for: point.displayValue))

            // Label
            Text(point.displayLabel)
                .font(.system(size: 10))
                .foregroundStyle(Theme.Colors.secondaryText)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
        }
    }

    private func barHeight(for value: Double) -> CGFloat {
        guard maxValue > 0 else { return 10 }
        let ratio = value / maxValue
        return max(CGFloat(ratio) * 140, 8)
    }

    private func barColor(index: Int) -> Color {
        let colors: [Color] = [
            Theme.Colors.accent,
            Color(hex: "#34C759"),
            Color(hex: "#FF9500"),
            Color(hex: "#AF52DE"),
            Color(hex: "#FF3B30"),
            Color(hex: "#5AC8FA"),
        ]
        return colors[index % colors.count]
    }

    private func formatValue(_ value: Double) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.0fK", value / 1_000)
        } else if value == value.rounded() {
            return String(format: "%.0f", value)
        } else {
            return String(format: "%.1f", value)
        }
    }
}

#Preview {
    let graph = GraphData(
        type: "bar",
        title: "Investment by Year",
        data: [
            GraphPoint(label: "2020", value: 50, x: nil, y: nil),
            GraphPoint(label: "2021", value: 80, x: nil, y: nil),
            GraphPoint(label: "2022", value: 120, x: nil, y: nil),
            GraphPoint(label: "2023", value: 200, x: nil, y: nil),
        ],
        xLabel: "Year",
        yLabel: "Billions USD"
    )
    return ScrollView {
        ArticleGraphView(graph: graph)
            .padding()
    }
}
