import Charts
import SwiftUI

/// Data Analytics section — renders Power BI-style charts with Swift Charts.
struct EventDataAnalyticsView: View {
    let data: DataAnalyticsData
    var accentColor: Color = Color(hex: "#0057B7")

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Summary
            if let summary = data.summary, !summary.isEmpty {
                Text(summary)
                    .font(.system(size: 15))
                    .foregroundStyle(.primary.opacity(0.8))
                    .lineSpacing(5)
            }

            // Charts
            if let charts = data.charts {
                ForEach(Array(charts.enumerated()), id: \.offset) { _, chart in
                    chartCard(chart)
                }
            }
        }
    }

    // MARK: - Chart Card

    private func chartCard(_ chart: AnalyticsChart) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            // Title
            if let title = chart.title {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.primary)
            }

            // Description
            if let desc = chart.description, !desc.isEmpty {
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineSpacing(3)
            }

            // Chart
            chartView(for: chart)
                .frame(height: chartHeight(for: chart))

            // Source
            if let source = chart.source, !source.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 10))
                    Text(source)
                        .font(.system(size: 11))
                }
                .foregroundStyle(.tertiary)
            }
        }
        .padding(16)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 18))
    }

    // MARK: - Chart Routing

    @ViewBuilder
    private func chartView(for chart: AnalyticsChart) -> some View {
        switch chart.chartType?.lowercased() {
        case "line":
            lineChart(chart)
        case "area":
            areaChart(chart)
        case "bar":
            barChart(chart)
        case "stacked_bar":
            stackedBarChart(chart)
        case "horizontal_bar":
            horizontalBarChart(chart)
        case "pie", "donut":
            pieChart(chart, isDonut: chart.chartType?.lowercased() == "donut")
        default:
            barChart(chart)
        }
    }

    private func chartHeight(for chart: AnalyticsChart) -> CGFloat {
        switch chart.chartType?.lowercased() {
        case "pie", "donut": return 220
        case "horizontal_bar": return CGFloat(max(150, (chart.series?.first?.data?.count ?? 3) * 36))
        default: return 200
        }
    }

    // MARK: - Line Chart

    private func lineChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                LineMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2.5))

                PointMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .symbolSize(20)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let v = value.as(String.self) {
                        Text(v)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Area Chart

    private func areaChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                AreaMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .opacity(0.3)

                LineMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .interpolationMethod(.catmullRom)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let v = value.as(String.self) {
                        Text(v)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Bar Chart

    private func barChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                BarMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let v = value.as(String.self) {
                        Text(v)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartLegend(position: .bottom, alignment: .leading)
    }

    // MARK: - Stacked Bar Chart

    private func stackedBarChart(_ chart: AnalyticsChart) -> some View {
        Chart {
            ForEach(chartEntries(chart), id: \.id) { entry in
                BarMark(
                    x: .value(chart.xLabel ?? "X", entry.x),
                    y: .value(chart.yLabel ?? "Y", entry.y),
                    stacking: .standard
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(3)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
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
                    x: .value(chart.yLabel ?? "Value", entry.y),
                    y: .value(chart.xLabel ?? "Category", entry.x)
                )
                .foregroundStyle(by: .value("Series", entry.series))
                .cornerRadius(4)
            }
        }
        .chartForegroundStyleScale(seriesColorMapping(chart))
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                    .foregroundStyle(.secondary.opacity(0.3))
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text(formatValue(v, format: chart.yFormat))
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
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
                    angle: .value("Value", entry.y),
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
        // For pie charts, use the first series' data points as categories
        if let firstSeries = chart.series?.first {
            for (idx, point) in (firstSeries.data ?? []).enumerated() {
                entries.append(ChartEntry(
                    id: "pie_\(idx)",
                    x: point.x ?? "",
                    y: point.y?.value ?? 0,
                    series: point.x ?? ""
                ))
            }
        } else {
            // Multiple series with single data point each
            for (idx, series) in (chart.series ?? []).enumerated() {
                let val = series.data?.first?.y?.value ?? 0
                entries.append(ChartEntry(
                    id: "pie_\(idx)",
                    x: series.name ?? "",
                    y: val,
                    series: series.name ?? ""
                ))
            }
        }
        return entries
    }

    private func seriesColorMapping(_ chart: AnalyticsChart) -> KeyValuePairs<String, Color> {
        let pairs = (chart.series ?? []).map { series in
            let name = series.name ?? "Data"
            let color = series.color.map { Color(hex: $0) } ?? accentColor
            return (name, color)
        }
        // KeyValuePairs doesn't support dynamic init, use switch for common counts
        switch pairs.count {
        case 1:
            return [pairs[0].0: pairs[0].1]
        case 2:
            return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1]
        case 3:
            return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1]
        case 4:
            return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1]
        default:
            return ["Data": accentColor]
        }
    }

    private func pieColorMapping(_ chart: AnalyticsChart) -> KeyValuePairs<String, Color> {
        let entries = pieEntries(chart)
        let defaultColors: [Color] = [
            accentColor,
            Color(hex: "#ef4444"),
            Color(hex: "#f59e0b"),
            Color(hex: "#10b981"),
            Color(hex: "#8b5cf6"),
            Color(hex: "#06b6d4"),
            Color(hex: "#ec4899"),
            Color(hex: "#6366f1"),
        ]

        // Try to use series colors if available
        if let firstSeries = chart.series?.first, firstSeries.data?.count == entries.count {
            // Single series with multiple data points — use default palette
        } else if let series = chart.series, series.count == entries.count {
            let pairs = entries.enumerated().map { idx, entry in
                (entry.x, series[idx].color.map { Color(hex: $0) } ?? defaultColors[idx % defaultColors.count])
            }
            return buildKVP(pairs)
        }

        let pairs = entries.enumerated().map { idx, entry in
            (entry.x, defaultColors[idx % defaultColors.count])
        }
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
            if pairs.count >= 8 {
                return [pairs[0].0: pairs[0].1, pairs[1].0: pairs[1].1, pairs[2].0: pairs[2].1, pairs[3].0: pairs[3].1, pairs[4].0: pairs[4].1, pairs[5].0: pairs[5].1, pairs[6].0: pairs[6].1, pairs[7].0: pairs[7].1]
            }
            return ["Data": accentColor]
        }
    }

    // MARK: - Value Formatting

    private func formatValue(_ value: Double, format: String?) -> String {
        switch format?.lowercased() {
        case "percent":
            return "\(Int(value))%"
        case "currency_b":
            if value >= 1000 {
                return "$\(String(format: "%.1f", value / 1000))T"
            }
            return "$\(String(format: value == value.rounded() ? "%.0f" : "%.1f", value))B"
        case "currency_m":
            if value >= 1000 {
                return "$\(String(format: "%.1f", value / 1000))B"
            }
            return "$\(String(format: value == value.rounded() ? "%.0f" : "%.1f", value))M"
        case "compact":
            if value >= 1_000_000_000 {
                return "\(String(format: "%.1f", value / 1_000_000_000))B"
            } else if value >= 1_000_000 {
                return "\(String(format: "%.1f", value / 1_000_000))M"
            } else if value >= 1_000 {
                return "\(String(format: "%.0f", value / 1_000))K"
            }
            return "\(Int(value))"
        default:
            if value == value.rounded() {
                return "\(Int(value))"
            }
            return String(format: "%.1f", value)
        }
    }
}
