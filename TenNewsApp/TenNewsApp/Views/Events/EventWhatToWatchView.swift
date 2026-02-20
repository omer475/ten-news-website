import SwiftUI

/// "What to Watch" — elegant vertical timeline with muted tones.
/// Monochromatic design using accent color only, no multi-color noise.
struct EventWhatToWatchView: View {
    let items: [WhatToWatchItem]
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var expandedIndex: Int? = nil

    /// Sort items by date (nearest first)
    private var sortedItems: [WhatToWatchItem] {
        items.sorted { a, b in
            (a.date ?? "9999") < (b.date ?? "9999")
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(sortedItems.enumerated()), id: \.offset) { index, item in
                watchRow(item, index: index, isLast: index == sortedItems.count - 1)
            }
        }
    }

    private func watchRow(_ item: WhatToWatchItem, index: Int, isLast: Bool) -> some View {
        let isExpanded = expandedIndex == index
        let isConfirmed = item.confirmed == true
        let countdown = daysUntil(item.date)

        return Button {
            withAnimation(.spring(duration: 0.3, bounce: 0.15)) {
                expandedIndex = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            HStack(alignment: .top, spacing: 0) {
                // Timeline rail
                VStack(spacing: 0) {
                    // Line above node
                    Rectangle()
                        .fill(index == 0 ? .clear : .secondary.opacity(0.12))
                        .frame(width: 1.5, height: 14)

                    // Node
                    ZStack {
                        Circle()
                            .fill(accentColor.opacity(0.1))
                            .frame(width: 18, height: 18)
                        Circle()
                            .fill(isConfirmed ? accentColor : accentColor.opacity(0.4))
                            .frame(width: 7, height: 7)
                    }

                    // Line below node
                    Rectangle()
                        .fill(isLast ? .clear : .secondary.opacity(0.12))
                        .frame(width: 1.5)
                        .frame(maxHeight: .infinity)
                }
                .frame(width: 18)

                // Content
                VStack(alignment: .leading, spacing: 6) {
                    // Type + countdown
                    HStack(spacing: 0) {
                        Text((item.type ?? "event").uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.secondary)
                            .tracking(0.5)

                        Spacer()

                        if let days = countdown {
                            if days == 0 {
                                Text("Today")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(accentColor)
                            } else if days > 0 {
                                Text("In \(days) \(days == 1 ? "day" : "days")")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Title
                    if let title = item.title {
                        Text(title)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(isExpanded ? nil : 2)
                            .multilineTextAlignment(.leading)
                    }

                    // Date + status
                    HStack(spacing: 8) {
                        if let dateDisplay = item.dateDisplay ?? item.date {
                            Text(dateDisplay)
                                .font(.system(size: 12))
                                .foregroundStyle(.tertiary)
                        }

                        Text("·")
                            .foregroundStyle(.tertiary)

                        Text(isConfirmed ? "Confirmed" : "Expected")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(isConfirmed ? accentColor : accentColor.opacity(0.35))
                    }

                    // Expanded description
                    if isExpanded, let desc = item.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 14))
                            .foregroundStyle(.primary.opacity(0.6))
                            .lineSpacing(4)
                            .padding(.top, 4)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(.leading, 14)
                .padding(.bottom, 22)
                .padding(.top, 8)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func daysUntil(_ dateStr: String?) -> Int? {
        guard let dateStr = dateStr else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let targetDate = formatter.date(from: dateStr) else { return nil }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let target = calendar.startOfDay(for: targetDate)
        return calendar.dateComponents([.day], from: today, to: target).day
    }
}
