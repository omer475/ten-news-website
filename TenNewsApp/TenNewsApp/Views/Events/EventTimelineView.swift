import SwiftUI

/// This Week — vertical timeline showing only the last 7 days of entries.
struct EventTimelineView: View {
    let entries: [EventTimelineEntry]
    var accentColor: Color = Color(hex: "#0A84FF")

    /// Entries filtered to last 7 days, most recent first
    private var recentEntries: [EventTimelineEntry] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        let sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date()

        let filtered = entries.filter { entry in
            guard let dateStr = entry.date,
                  let date = formatter.date(from: dateStr) else { return false }
            return date >= calendar.startOfDay(for: sevenDaysAgo)
        }
        // Most recent first
        return filtered.sorted { a, b in
            (a.date ?? "") > (b.date ?? "")
        }
    }

    /// Build flat display items: date headers interleaved with entries
    private var displayItems: [TimelineDisplayItem] {
        var items: [TimelineDisplayItem] = []
        var lastDate: String?
        for (index, entry) in recentEntries.enumerated() {
            let date = entry.date ?? ""
            if date != lastDate {
                items.append(.dateHeader(date: date, isFirst: lastDate == nil))
                lastDate = date
            }
            items.append(.entry(entry: entry, isFirst: index == 0, globalIndex: index))
        }
        return items
    }

    var body: some View {
        if recentEntries.isEmpty {
            Text("No recent updates")
                .font(.system(size: 13))
                .foregroundStyle(.primary.opacity(0.3))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(displayItems.enumerated()), id: \.offset) { _, item in
                    switch item {
                    case .dateHeader(let date, let isFirst):
                        dateHeaderView(date: date, isFirst: isFirst)

                    case .entry(let entry, let isFirst, let globalIndex):
                        let isLast = globalIndex == recentEntries.count - 1
                        let opacity = isFirst ? 0.85 : max(0.5, 0.75 - Double(globalIndex) * 0.03)
                        entryRow(entry: entry, isFirst: isFirst, isLast: isLast, opacity: opacity)
                    }
                }
            }
            .padding(16)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.06), lineWidth: 0.5))
        }
    }

    // MARK: - Date Header

    private func dateHeaderView(date: String, isFirst: Bool) -> some View {
        HStack(spacing: 8) {
            Text(formatDate(date).uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundColor(isFirst ? accentColor : Color.primary.opacity(0.3))

            if isFirst {
                Text("LATEST")
                    .font(.system(size: 8, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(accentColor)
                    .clipShape(RoundedRectangle(cornerRadius: 3))
            }

            VStack { Divider() }
        }
        .padding(.top, isFirst ? 0 : 24)
        .padding(.bottom, 14)
    }

    // MARK: - Entry Row (flat, consistent alignment)

    private func entryRow(entry: EventTimelineEntry, isFirst: Bool, isLast: Bool, opacity: Double) -> some View {
        HStack(alignment: .top, spacing: 14) {
            // Fixed-width timeline rail
            VStack(spacing: 0) {
                ZStack {
                    if isFirst {
                        Circle()
                            .fill(accentColor.opacity(0.08))
                            .frame(width: 20, height: 20)
                    }

                    Circle()
                        .fill(isFirst ? AnyShapeStyle(accentColor) : AnyShapeStyle(Color.primary.opacity(opacity * 0.35)))
                        .frame(width: isFirst ? 10 : 6, height: isFirst ? 10 : 6)
                }
                .frame(width: 22, height: 22)

                if !isLast {
                    Rectangle()
                        .fill(Color.primary.opacity(0.06))
                        .frame(width: 1.5)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 22)

            // Entry text
            Text(stripMarkdownBold(entry.headline ?? entry.summary ?? ""))
                .font(.system(size: 14, weight: isFirst ? .semibold : .regular))
                .foregroundStyle(.primary.opacity(opacity))
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 2)
                .padding(.bottom, 14)
        }
        .scrollReveal(offset: 12)
    }

    // MARK: - Helpers

    private func stripMarkdownBold(_ text: String) -> String {
        text.replacingOccurrences(of: "**", with: "")
    }

    private func formatDate(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return dateStr }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        let display = DateFormatter()
        display.dateFormat = "MMM d, EEEE"
        return display.string(from: date)
    }
}

// MARK: - Display Item

private enum TimelineDisplayItem {
    case dateHeader(date: String, isFirst: Bool)
    case entry(entry: EventTimelineEntry, isFirst: Bool, globalIndex: Int)
}

// MARK: - Historical Timeline (kept for backward compat, now used inside sheet)

/// Historical comparison timeline — used inside EventHistorySheetView.
struct EventHistoricalTimelineView: View {
    let data: HistoricalComparisonData
    var accentColor: Color = Color(hex: "#0A84FF")

    var body: some View {
        EventHistorySheetView(historicalData: data, timelineEntries: [EventTimelineEntry]?.none, accentColor: accentColor)
    }
}
