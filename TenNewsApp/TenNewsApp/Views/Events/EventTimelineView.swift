import SwiftUI

/// This Week — horizontal scroll of compact day cards with expand/collapse.
/// Collapsed: compact summary strip. Expanded: full horizontal scroll of day cards.
struct EventTimelineView: View {
    let entries: [EventTimelineEntry]
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var expandedDay: Int? = nil
    @State private var timelineExpanded = false

    /// Group entries by date (most recent first)
    private var groupedByDate: [(date: String, entries: [EventTimelineEntry])] {
        var groups: [(String, [EventTimelineEntry])] = []
        var current: (String, [EventTimelineEntry])? = nil
        for entry in entries.reversed() {
            let date = entry.date ?? ""
            if let c = current, c.0 == date {
                current = (date, c.1 + [entry])
            } else {
                if let c = current { groups.append(c) }
                current = (date, [entry])
            }
        }
        if let c = current { groups.append(c) }
        return groups
    }

    var body: some View {
        VStack(spacing: 0) {
            if timelineExpanded {
                // Full horizontal scroll
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(groupedByDate.enumerated()), id: \.offset) { groupIdx, group in
                            dayCard(group, isLatest: groupIdx == 0, dayIndex: groupIdx)
                        }
                    }
                    .padding(.horizontal, 2)
                }
                .padding(.horizontal, -2)
                .transition(.opacity)
            } else {
                // Collapsed: compact summary
                collapsedSummary
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    timelineExpanded.toggle()
                }
                HapticManager.light()
            } label: {
                Image(systemName: timelineExpanded
                    ? "arrow.down.right.and.arrow.up.left"
                    : "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                    .glassEffect(.regular.interactive(), in: Circle())
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: timelineExpanded)
    }

    // MARK: - Collapsed Summary

    private var collapsedSummary: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(groupedByDate.prefix(3).enumerated()), id: \.offset) { idx, group in
                HStack(spacing: 12) {
                    // Date
                    Text("\(monthName(group.date)) \(dayNumber(group.date))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(idx == 0 ? accentColor : .secondary)
                        .frame(width: 50, alignment: .leading)

                    // Latest headline
                    if let headline = group.entries.first?.headline ?? group.entries.first?.summary {
                        Text(headline)
                            .font(.system(size: 13, weight: idx == 0 ? .semibold : .regular))
                            .foregroundStyle(.primary.opacity(idx == 0 ? 0.9 : 0.6))
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)

                    // Entry count
                    if group.entries.count > 1 {
                        Text("+\(group.entries.count - 1)")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 14)

                if idx < min(groupedByDate.count, 3) - 1 {
                    Divider().padding(.leading, 76)
                }
            }

            if groupedByDate.count > 3 {
                Text("+\(groupedByDate.count - 3) more days")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(accentColor)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
            }
        }
        .padding(.vertical, 6)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 16))
    }

    private func dayCard(
        _ group: (date: String, entries: [EventTimelineEntry]),
        isLatest: Bool,
        dayIndex: Int
    ) -> some View {
        let isExpanded = expandedDay == dayIndex
        let visibleCount = isExpanded ? group.entries.count : min(group.entries.count, 3)
        let hasMore = group.entries.count > 3

        return VStack(alignment: .leading, spacing: 0) {
            // Day header
            HStack(spacing: 0) {
                // Day number
                Text(dayNumber(group.date))
                    .font(.system(size: 32, weight: .heavy, design: .rounded))
                    .foregroundStyle(isLatest ? accentColor : .primary)

                VStack(alignment: .leading, spacing: 1) {
                    Text(dayOfWeek(group.date))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isLatest ? accentColor : .secondary)
                        .tracking(0.5)
                    Text(monthName(group.date))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(.leading, 6)

                Spacer()

                if isLatest {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color(hex: "#ef4444"))
                            .frame(width: 6, height: 6)
                        Text("NEW")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(Color(hex: "#ef4444"))
                            .tracking(0.5)
                    }
                } else {
                    Text("\(group.entries.count)")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Thin separator
            Rectangle()
                .fill(isLatest ? accentColor.opacity(0.2) : .secondary.opacity(0.1))
                .frame(height: 1)
                .padding(.horizontal, 12)

            // Entries — fixed 3-slot area when collapsed
            VStack(alignment: .leading, spacing: 0) {
                ForEach(0..<visibleCount, id: \.self) { idx in
                    let entry = group.entries[idx]
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(isLatest && idx == 0 ? accentColor : accentColor.opacity(0.25))
                            .frame(width: 4, height: 4)
                            .padding(.top, 7)

                        Text(entry.headline ?? entry.summary ?? "")
                            .font(.system(size: 12, weight: idx == 0 && isLatest ? .semibold : .regular))
                            .foregroundStyle(.primary.opacity(isLatest ? 0.85 : 0.65))
                            .lineLimit(2)
                            .lineSpacing(2)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)

                    if idx < visibleCount - 1 {
                        Rectangle()
                            .fill(.secondary.opacity(0.08))
                            .frame(height: 1)
                            .padding(.leading, 24)
                    }
                }

                if !isExpanded {
                    Spacer(minLength: 0)
                }

                // Show more / less (or spacer to keep uniform height)
                if hasMore {
                    Button {
                        withAnimation(.spring(duration: 0.3, bounce: 0.1)) {
                            expandedDay = isExpanded ? nil : dayIndex
                            HapticManager.light()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(isExpanded ? "Show less" : "+\(group.entries.count - 3) more")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(accentColor)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(accentColor)
                                .rotationEffect(isExpanded ? .degrees(180) : .zero)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                } else {
                    // Reserve space matching the "+more" button height
                    Color.clear.frame(height: 24)
                }
            }
            .padding(.vertical, 4)
        }
        .frame(width: 240)
        .glassEffect(
            isLatest
                ? .regular.tint(accentColor.opacity(0.04)).interactive()
                : .regular.interactive(),
            in: RoundedRectangle(cornerRadius: 16)
        )
        .shadow(color: .clear, radius: 0)
    }

    // MARK: - Date Helpers

    private func dayOfWeek(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return "" }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "TODAY" }
        if calendar.isDateInYesterday(date) { return "YESTERDAY" }
        let display = DateFormatter()
        display.dateFormat = "EEEE"
        return display.string(from: date).uppercased()
    }

    private func dayNumber(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return "" }
        let display = DateFormatter()
        display.dateFormat = "d"
        return display.string(from: date)
    }

    private func monthName(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return "" }
        let display = DateFormatter()
        display.dateFormat = "MMM"
        return display.string(from: date).uppercased()
    }
}

// MARK: - Historical Timeline

/// Historical comparison timeline — shows how current events compare to history.
struct EventHistoricalTimelineView: View {
    let data: HistoricalComparisonData
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var expandedIndex: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Headline
            if let headline = data.headline, !headline.isEmpty {
                Text(headline)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineSpacing(4)
            }

            // Comparison cards
            if let comparisons = data.comparisons {
                ForEach(Array(comparisons.enumerated()), id: \.offset) { index, comp in
                    comparisonCard(comp, index: index)
                }
            }

            // Timeline insight
            if let insight = data.timelineInsight, !insight.isEmpty {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(.yellow)
                        .padding(.top, 2)
                    Text(insight)
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .lineSpacing(4)
                        .italic()
                }
                .padding(14)
                .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private func comparisonCard(_ comp: HistoricalComparison, index: Int) -> some View {
        let isExpanded = expandedIndex == index

        return Button {
            withAnimation(.spring(duration: 0.35, bounce: 0.15)) {
                expandedIndex = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Header with year and event name
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let years = comp.years {
                            Text(years)
                                .font(.system(size: 28, weight: .heavy, design: .rounded))
                                .foregroundStyle(accentColor)
                        }
                        if let name = comp.eventName {
                            Text(name)
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(.primary)
                        }
                    }
                    Spacer()

                    if let months = comp.durationMonths {
                        VStack(spacing: 1) {
                            Text("\(months)")
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(accentColor)
                            Text(months == 1 ? "month" : "months")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 10))
                    }
                }

                if let summary = comp.summary {
                    Text(summary)
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .lineSpacing(4)
                        .lineLimit(isExpanded ? nil : 2)
                        .padding(.top, 10)
                }

                if isExpanded {
                    VStack(alignment: .leading, spacing: 14) {
                        if let resolution = comp.resolution, !resolution.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Label("Resolution", systemImage: "checkmark.circle.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Color(hex: "#059669"))
                                Text(resolution)
                                    .font(.system(size: 14))
                                    .foregroundStyle(.primary.opacity(0.8))
                                    .lineSpacing(4)
                            }
                        }

                        if let lessons = comp.keyLessons, !lessons.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Label("Key Lesson", systemImage: "lightbulb.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(.yellow)
                                Text(lessons)
                                    .font(.system(size: 14))
                                    .foregroundStyle(.primary.opacity(0.8))
                                    .lineSpacing(4)
                            }
                        }
                    }
                    .padding(.top, 12)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                HStack {
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.tertiary)
                        .rotationEffect(isExpanded ? .degrees(180) : .zero)
                }
                .padding(.top, 8)
            }
            .padding(18)
            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.plain)
    }
}
