import Charts
import SwiftUI

/// Latest development card — white card with red accent bar, stats row with borders, mini chart.
struct EventLatestDevelopmentView: View {
    let development: LatestDevelopment
    var accentColor: Color = Color(hex: "#0A84FF")

    @State private var isPulsing = false
    @State private var graphExpanded = false
    @State private var graphProgress: CGFloat = 0
    @State private var statsProgress: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 3px red gradient accent bar at top
            LinearGradient(
                colors: [Color(hex: "#FF3B30"), Color(hex: "#FF3B30").opacity(0.3)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 3)

            VStack(alignment: .leading, spacing: 0) {
                // Live dot + label + time
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color(hex: "#FF3B30"))
                        .frame(width: 7, height: 7)
                        .scaleEffect(isPulsing ? 1.3 : 1.0)
                        .opacity(isPulsing ? 0.4 : 1.0)
                        .animation(
                            .easeInOut(duration: 2.0).repeatForever(autoreverses: true),
                            value: isPulsing
                        )

                    Text("Live")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color(hex: "#FF3B30"))
                        .tracking(0.3)

                    Spacer()

                    if let time = development.time {
                        Text(time)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.primary.opacity(0.3))
                    }
                }
                .padding(.bottom, 14)

                // Title
                if let title = development.title {
                    Text(title)
                        .font(.system(size: 21, weight: .heavy))
                        .foregroundStyle(.primary)
                        .tracking(-0.4)
                        .lineSpacing(3)
                        .padding(.bottom, 12)
                }

                // Summary
                if let summary = development.summary, !summary.isEmpty {
                    Text(summary)
                        .font(.system(size: 14))
                        .foregroundStyle(.primary.opacity(0.55))
                        .lineSpacing(6)
                        .padding(.bottom, 18)
                }

                // Stats row — separated by border lines (not individual cards)
                if let infoItems = development.components?.infoBox, !infoItems.isEmpty {
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(.black.opacity(0.06))
                            .frame(height: 1)

                        HStack(spacing: 0) {
                            ForEach(Array(infoItems.prefix(3).enumerated()), id: \.offset) { idx, item in
                                VStack(spacing: 4) {
                                    CountUpText(
                                        fullText: item.displayValue,
                                        progress: statsProgress
                                    )
                                    .font(.system(size: 22, weight: .black, design: .rounded))
                                    .foregroundStyle(.primary)
                                    .tracking(-0.5)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.5)

                                    Text(item.displayLabel.uppercased())
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.primary.opacity(0.3))
                                        .tracking(0.5)
                                        .lineLimit(1)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)

                                if idx < min(infoItems.count, 3) - 1 {
                                    Rectangle()
                                        .fill(.black.opacity(0.06))
                                        .frame(width: 1, height: 40)
                                }
                            }
                        }
                    }
                    .onScrollVisibilityChange(threshold: 0.3) { visible in
                        guard visible, statsProgress < 1 else { return }
                        withAnimation(AppAnimations.countUpAnimation) {
                            statsProgress = 1
                        }
                    }
                }

                // Mini chart in gray container
                if let graph = development.components?.graph,
                   let points = graph.data, !points.isEmpty {
                    graphSection(graph: graph, points: points)
                        .padding(.top, 16)
                }
            }
            .padding(20)
        }
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.06), lineWidth: 0.5))
        .onAppear { isPulsing = true }
    }

    // MARK: - Graph (expandable)

    private func graphSection(graph: GraphData, points: [GraphPoint]) -> some View {
        let graphHeight: CGFloat = graphExpanded ? 200 : 80

        return VStack(alignment: .leading, spacing: 0) {
            // Header: title + badge
            HStack {
                if let title = graph.title, !title.isEmpty {
                    Text(title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.primary.opacity(0.55))
                }
                Spacer()
            }
            .padding(.bottom, 10)

            Chart {
                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    let chartType = graph.type?.lowercased() ?? "line"

                    if chartType == "bar" {
                        BarMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue * graphProgress)
                        )
                        .foregroundStyle(accentColor.gradient)
                        .cornerRadius(3)
                    } else {
                        LineMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue * graphProgress)
                        )
                        .foregroundStyle(accentColor)
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2))

                        AreaMark(
                            x: .value(graph.xLabel ?? "X", point.displayLabel),
                            y: .value(graph.yLabel ?? "Y", point.displayValue * graphProgress)
                        )
                        .foregroundStyle(accentColor.opacity(0.12 * graphProgress))
                        .interpolationMethod(.catmullRom)
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
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .padding(14)
        .background(Color(hex: "#F2F2F7"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .scrollProgress($graphProgress)
        .overlay(alignment: .topTrailing) {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    graphExpanded.toggle()
                }
                HapticManager.light()
            } label: {
                Image(systemName: graphExpanded
                    ? "arrow.down.right.and.arrow.up.left"
                    : "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .glassEffect(.regular.interactive(), in: Circle())
            }
            .padding(8)
        }
        .animation(.easeInOut(duration: 0.25), value: graphExpanded)
    }
}

// MARK: - Count-Up Text

/// Animates numeric portions of a string from 0 to their final value.
private struct CountUpText: View, Animatable {
    let fullText: String
    var progress: CGFloat

    nonisolated var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        // Try to find a number in the text (e.g. "$1.2T", "340M", "89%")
        if let match = fullText.firstMatch(of: /^([^0-9]*)([0-9]+\.?[0-9]*)(.*)$/),
           let num = Double(match.2) {
            let pre = String(match.1)
            let suf = String(match.3)
            let current = num * progress
            let formatted = num == num.rounded()
                ? "\(pre)\(Int(current))\(suf)"
                : "\(pre)\(String(format: "%.1f", current))\(suf)"
            Text(formatted)
        } else {
            Text(progress > 0.5 ? fullText : " ")
        }
    }
}
