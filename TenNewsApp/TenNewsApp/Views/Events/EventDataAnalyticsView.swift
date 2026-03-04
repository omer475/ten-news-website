import Charts
import SwiftUI

/// Data Analytics section — renders charts with Swift Charts in white cards.
struct EventDataAnalyticsView: View {
    let data: DataAnalyticsData
    var accentColor: Color = Color(hex: "#0057B7")

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let charts = data.charts {
                ForEach(Array(charts.enumerated()), id: \.offset) { _, chart in
                    AnimatedChartCard(chart: chart, accentColor: accentColor)
                }
            }
        }
    }
}

// MARK: - Animated Chart Card

private struct AnimatedChartCard: View {
    let chart: AnalyticsChart
    var accentColor: Color

    @State private var animationProgress: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // White card
            VStack(alignment: .leading, spacing: 0) {
                // Title header
                if let title = chart.title {
                    HStack {
                        Text(title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.primary)
                        Spacer()
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 16)
                    .padding(.bottom, 6)
                }

                // Chart area
                chartView(for: chart)
                    .frame(height: chartHeight(for: chart))
                    .padding(.horizontal, 14)
                    .padding(.top, 6)
                    .padding(.bottom, 16)
            }
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.06), lineWidth: 0.5))

            // Source outside card
            if let source = chart.source, !source.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 10))
                    Text(source)
                        .font(.system(size: 10))
                }
                .foregroundStyle(.primary.opacity(0.18))
                .padding(.top, 8)
                .padding(.leading, 4)
            }
        }
        .scrollProgress($animationProgress)
    }

    @ViewBuilder
    private func chartView(for chart: AnalyticsChart) -> some View {
        switch chart.chartType?.lowercased() {
        case "line": lineChart(chart)
        case "area": areaChart(chart)
        case "bar": barChart(chart)
        case "stacked_bar": stackedBarChart(chart)
        case "horizontal_bar": horizontalBarChart(chart)
        case "pie", "donut": pieChart(chart, isDonut: chart.chartType?.lowercased() == "donut")
        default: barChart(chart)
        }
    }

    private func chartHeight(for chart: AnalyticsChart) -> CGFloat {
        switch chart.chartType?.lowercased() {
        case "pie", "donut": return 200
        case "horizontal_bar": return CGFloat(max(150, (chart.series?.first?.data?.count ?? 3) * 36))
        default: return 180
        }
    }

    // MARK: - Line Chart

    private func lineChart(_ chart: AnalyticsChart) -> some View {
        let entries = chartEntries(chart)
        let maxY = entries.map(\.y).max() ?? 1
        let minY = entries.map(\.y).min() ?? 0
        let yLower = minY < 0 ? minY * 1.15 : 0.0
        let yUpper = maxY * 1.15

        return Chart {
            ForEach(entries, id: \.id) { entry in
                LineMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2.5))

                PointMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .symbolSize(20)
                .opacity(Double(animationProgress))
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYScale(domain: yLower...yUpper)
        .chartPlotStyle { $0.clipped() }
        .standardAxes(chart: chart, formatValue: formatValue)
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Area Chart

    private func areaChart(_ chart: AnalyticsChart) -> some View {
        let entries = chartEntries(chart)
        let maxY = entries.map(\.y).max() ?? 1
        let minY = entries.map(\.y).min() ?? 0
        let yLower = minY < 0 ? minY * 1.15 : 0.0
        let yUpper = maxY * 1.15

        return Chart {
            ForEach(entries, id: \.id) { entry in
                AreaMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .opacity(0.3 * Double(animationProgress))

                LineMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYScale(domain: yLower...yUpper)
        .chartPlotStyle { $0.clipped() }
        .standardAxes(chart: chart, formatValue: formatValue)
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Bar Chart

    private func barChart(_ chart: AnalyticsChart) -> some View {
        let entries = chartEntries(chart)
        let maxY = entries.map(\.y).max() ?? 1
        let minY = entries.map(\.y).min() ?? 0
        let yLower = minY < 0 ? minY * 1.15 : 0.0
        let yUpper = maxY * 1.15

        return Chart {
            ForEach(entries, id: \.id) { entry in
                BarMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYScale(domain: yLower...yUpper)
        .chartPlotStyle { $0.clipped() }
        .standardAxes(chart: chart, formatValue: formatValue)
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Stacked Bar Chart

    private func stackedBarChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                BarMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y * animationProgress),
                    stacking: .standard
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartPlotStyle { $0.clipped() }
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.black.opacity(0.08))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(.primary.opacity(0.7))
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Horizontal Bar Chart

    private func horizontalBarChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                BarMark(
                    x: .value(chart.yLabel ?? "Value", entry.y * animationProgress),
                    y: .value(chart.xLabel ?? "Category", entry.x)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartPlotStyle { $0.clipped() }
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.black.opacity(0.08))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(.primary.opacity(0.7))
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Pie / Donut Chart

    private func pieChart(_ chart: AnalyticsChart, isDonut: Bool) -> some View {
        let entries = pieEntries(chart)

        return Chart {
            ForEach(entries, id: \.id) { entry in
                SectorMark(
                    angle: .value("Value", entry.y * animationProgress),
                    innerRadius: isDonut ? .ratio(0.55) : .ratio(0),
                    angularInset: 1.5
                )
                .foregroundStyle(by: .value("Category", entry.x))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(pieColorMapping(chart))
        .chartLegend(position: .bottom, alignment: .center)
    }

    // MARK: - Data Helpers

    private struct ChartEntry: Identifiable {
        let id: String
        let x: String
        let y: Double
        let series: String
    }

    private func chartEntries(_ chart: AnalyticsChart) -> [ChartEntry] {
        var entries: [ChartEntry] = []
        for series in chart.series ?? [] {
            let name = series.name ?? "Data"
            for (idx, point) in (series.data ?? []).enumerated() {
                entries.append(ChartEntry(
                    id: "\(name)_\(idx)",
                    x: point.x ?? "",
                    y: point.y?.value ?? 0,
                    series: name
                ))
            }
        }
        return entries
    }

    private func pieEntries(_ chart: AnalyticsChart) -> [ChartEntry] {
        var entries: [ChartEntry] = []
        if let firstSeries = chart.series?.first {
            for (idx, point) in (firstSeries.data ?? []).enumerated() {
                entries.append(ChartEntry(
                    id: "pie_\(idx)", x: point.x ?? "",
                    y: point.y?.value ?? 0, series: point.x ?? ""
                ))
            }
        } else {
            for (idx, series) in (chart.series ?? []).enumerated() {
                let val = series.data?.first?.y?.value ?? 0
                entries.append(ChartEntry(
                    id: "pie_\(idx)", x: series.name ?? "",
                    y: val, series: series.name ?? ""
                ))
            }
        }
        return entries
    }

    private func seriesColorMapping(_ chart: AnalyticsChart) -> KeyValuePairs<String, Color> {
        let pairs = (chart.series ?? []).map { s in (s.name ?? "Data", s.color.map { Color(hex: $0) } ?? accentColor) }
        switch pairs.count {
        case 1: return [pairs[0].0: pairs[0].1]
        case 2: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1]
        case 3: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1]
        case 4: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1]
        default: return ["Data": accentColor]
        }
    }

    private func pieColorMapping(_ chart: AnalyticsChart) -> KeyValuePairs<String, Color> {
        let entries = pieEntries(chart)
        let c: [Color] = [accentColor, Color(hex: "#ef4444"), Color(hex: "#f59e0b"), Color(hex: "#10b981"), Color(hex: "#8b5cf6"), Color(hex: "#06b6d4"), Color(hex: "#ec4899"), Color(hex: "#6366f1")]
        if let series = chart.series, series.count == entries.count, chart.series?.first?.data?.count != entries.count {
            let pairs = entries.enumerated().map { i, e in (e.x, series[i].color.map { Color(hex: $0) } ?? c[i % c.count]) }
            return buildKVP(pairs)
        }
        let pairs = entries.enumerated().map { i, e in (e.x, c[i % c.count]) }
        return buildKVP(pairs)
    }

    private func buildKVP(_ pairs: [(String, Color)]) -> KeyValuePairs<String, Color> {
        switch pairs.count {
        case 1: return [pairs[0].0: pairs[0].1]
        case 2: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1]
        case 3: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1]
        case 4: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1]
        case 5: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1, pairs[4].0: pairs[4].1]
        case 6: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1, pairs[4].0: pairs[4].1, pairs[5].0: pairs[5].1]
        case 7: return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1, pairs[4].0: pairs[4].1, pairs[5].0: pairs[5].1, pairs[6].0: pairs[6].1]
        default:
            if pairs.count >= 8 { return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1, pairs[4].0: pairs[4].1, pairs[5].0: pairs[5].1, pairs[6].0: pairs[6].1, pairs[7].0: pairs[7].1] }
            return ["Data": accentColor]
        }
    }

    private func formatValue(_ value: Double, format: String?) -> String {
        switch format?.lowercased() {
        case "percent": return "\(Int(value))%"
        case "currency_b":
            return value >= 1000 ? "$\(String(format: "%.1f", value / 1000))T" : "$\(String(format: value == value.rounded() ? "%.0f" : "%.1f", value))B"
        case "currency_m":
            return value >= 1000 ? "$\(String(format: "%.1f", value / 1000))B" : "$\(String(format: value == value.rounded() ? "%.0f" : "%.1f", value))M"
        case "compact":
            if value >= 1_000_000_000 { return "\(String(format: "%.1f", value / 1_000_000_000))B" }
            else if value >= 1_000_000 { return "\(String(format: "%.1f", value / 1_000_000))M" }
            else if value >= 1_000 { return "\(String(format: "%.0f", value / 1_000))K" }
            return "\(Int(value))"
        default:
            return value == value.rounded() ? "\(Int(value))" : String(format: "%.1f", value)
        }
    }
}

// MARK: - Chart Axis Helper

private extension View {
    func standardAxes(chart: AnalyticsChart, formatValue: @escaping (Double, String?) -> String) -> some View {
        self
            .chartYAxis {
                AxisMarks { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                        .foregroundStyle(.black.opacity(0.08))
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text(formatValue(v, chart.yFormat))
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(.primary.opacity(0.7))
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let v = value.as(String.self) {
                            Text(v)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(.primary.opacity(0.7))
                        }
                    }
                }
            }
    }
}
