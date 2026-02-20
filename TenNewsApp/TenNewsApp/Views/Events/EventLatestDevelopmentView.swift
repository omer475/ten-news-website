import Charts
import SwiftUI

/// Breaking-news style latest development card with Liquid Glass, pulse animation,
/// integrated key facts, and expandable graph.
struct EventLatestDevelopmentView: View {
    let development: LatestDevelopment
    var keyFacts: [KeyFact] = []
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var isPulsing = false
    @State private var graphExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header: pulsing live badge + time
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color(hex: "#ef4444"))
                        .frame(width: 8, height: 8)
                        .scaleEffect(isPulsing ? 1.4 : 1.0)
                        .opacity(isPulsing ? 0.5 : 1.0)
                        .animation(
                            .easeInOut(duration: 1.2).repeatForever(autoreverses: true),
                            value: isPulsing
                        )

                    Text("BREAKING")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(0.8)
                        .foregroundStyle(Color(hex: "#ef4444"))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .glassEffect(
                    .regular.tint(Color(hex: "#ef4444").opacity(0.15)).interactive(),
                    in: Capsule()
                )

                Spacer()

                if let time = development.time {
                    Text(time)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
            }

            // Main content card
            VStack(alignment: .leading, spacing: 14) {
                if let title = development.title {
                    Text(title)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.primary)
                        .tracking(-0.3)
                        .lineSpacing(3)
                }

                if let summary = development.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.system(size: 16))
                        .foregroundStyle(.primary.opacity(0.8))
                        .lineSpacing(6)
                }

                // Stats row from info_box
                if let infoItems = development.components?.infoBox, !infoItems.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(Array(infoItems.prefix(3).enumerated()), id: \.offset) { _, item in
                            VStack(spacing: 4) {
                                Text(item.displayValue)
                                    .font(.system(size: 18, weight: .bold, design: .rounded))
                                    .foregroundStyle(accentColor)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.5)
                                Text(item.displayLabel.uppercased())
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.secondary)
                                    .tracking(0.3)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                    .padding(.top, 4)
                }

                // Graph — expandable
                if let graph = development.components?.graph,
                   let points = graph.data, !points.isEmpty {
                    graphSection(graph: graph, points: points)
                }

                // Key Facts — article-style details layout
                if !keyFacts.isEmpty {
                    keyFactsDetailSection
                }
            }
            .padding(20)
            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 22))
        }
        .onAppear { isPulsing = true }
    }

    // MARK: - Graph (expandable like map)

    private func graphSection(graph: GraphData, points: [GraphPoint]) -> some View {
        let graphHeight: CGFloat = graphExpanded ? 240 : 90

        return VStack(alignment: .leading, spacing: 0) {
            if let title = graph.title, !title.isEmpty, graphExpanded {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.primary)
                    .padding(.bottom, 8)
                    .transition(.opacity)
            }

            Chart {
                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    let chartType = graph.type?.lowercased() ?? "bar"

                    if chartType == "line" || chartType == "area" {
                        LineMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue)
                        )
                        .foregroundStyle(accentColor)
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))

                        if chartType == "area" {
                            AreaMark(
                                x: .value(graph.xLabel ?? "X", point.displayLabel),
                                y: .value(graph.yLabel ?? "Y", point.displayValue)
                            )
                            .foregroundStyle(accentColor.opacity(0.15))
                            .interpolationMethod(.catmullRom)
                        }

                        PointMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue)
                        )
                        .foregroundStyle(accentColor)
                        .symbolSize(graphExpanded ? 25 : 15)
                    } else {
                        BarMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue)
                        )
                        .foregroundStyle(accentColor.gradient)
                        .cornerRadius(4)
                    }
                }
            }
            .chartXAxis(graphExpanded ? .visible : .hidden)
            .chartYAxis {
                if graphExpanded {
                    AxisMarks { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            .foregroundStyle(.secondary.opacity(0.3))
                        AxisValueLabel()
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(height: graphHeight)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(12)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .topTrailing) {
            expandButton(expanded: $graphExpanded)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: graphExpanded)
    }

    // MARK: - Expand Button (reusable)

    private func expandButton(expanded: Binding<Bool>) -> some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                expanded.wrappedValue.toggle()
            }
            HapticManager.light()
        } label: {
            Image(systemName: expanded.wrappedValue
                ? "arrow.down.right.and.arrow.up.left"
                : "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 28, height: 28)
                .glassEffect(.regular.interactive(), in: Circle())
        }
        .padding(8)
    }

    // MARK: - Key Facts (article-style label/value pairs)

    private var keyFactsDetailSection: some View {
        let validFacts = keyFacts.filter {
            ($0.label != nil && !$0.label!.isEmpty) &&
            ($0.value != nil && !$0.value!.isEmpty)
        }

        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(validFacts.enumerated()), id: \.offset) { idx, fact in
                HStack(alignment: .top, spacing: 12) {
                    Text(fact.label!)
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .frame(width: 90, alignment: .leading)

                    Text(fact.value!)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 8)

                if idx < validFacts.count - 1 {
                    Divider()
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }
}
