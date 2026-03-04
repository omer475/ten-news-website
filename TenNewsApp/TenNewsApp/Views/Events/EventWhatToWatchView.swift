import SwiftUI

/// "What to Watch" — single white card with items separated by dividers.
struct EventWhatToWatchView: View {
    let items: [WhatToWatchItem]
    var accentColor: Color = Color(hex: "#0A84FF")

    @State private var expandedIndex: Int? = nil

    private var sortedItems: [WhatToWatchItem] {
        items.sorted { ($0.date ?? "9999") < ($1.date ?? "9999") }
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(sortedItems.enumerated()), id: \.offset) { index, item in
                VStack(spacing: 0) {
                    watchItem(item, index: index)

                    if index < sortedItems.count - 1 {
                        Divider()
                            .padding(.leading, 16)
                    }
                }
                .scrollReveal(offset: 14)
            }
        }
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.06), lineWidth: 0.5))
    }

    private func watchItem(_ item: WhatToWatchItem, index: Int) -> some View {
        let isExpanded = expandedIndex == index
        let isConfirmed = item.confirmed == true
        let countdown = daysUntil(item.date)
        let isToday = countdown == 0
        let isPast = (countdown ?? 0) < 0

        return Button {
            withAnimation(.easeInOut(duration: 0.25)) {
                expandedIndex = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Top row: date + countdown badge
                HStack {
                    Text(formatDateDisplay(item.dateDisplay ?? item.date))
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.primary.opacity(0.3))

                    Spacer()

                    if let days = countdown {
                        countdownBadge(days: days)
                    }
                }
                .padding(.bottom, 6)

                // Title with left indicator stripe
                HStack(alignment: .top, spacing: 10) {
                    Rectangle()
                        .fill(indicatorColor(isToday: isToday, isConfirmed: isConfirmed, isPast: isPast))
                        .frame(width: 3)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                        .frame(minHeight: 18)

                    Text(item.title ?? "")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.primary.opacity(isPast ? 0.3 : 1.0))
                        .lineSpacing(3)
                        .lineLimit(isExpanded ? nil : 2)
                        .multilineTextAlignment(.leading)
                }

                // Type + status badge row
                HStack(spacing: 8) {
                    if let type = item.type {
                        Text(type)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.primary.opacity(0.3))
                    }

                    statusBadge(isConfirmed: isConfirmed, isPast: isPast)
                }
                .padding(.top, 6)
                .padding(.leading, 13)

                // Expanded content
                if isExpanded {
                    VStack(alignment: .leading, spacing: 8) {
                        if let desc = item.description, !desc.isEmpty {
                            Text(desc)
                                .font(.system(size: 13))
                                .foregroundStyle(.primary.opacity(0.55))
                                .lineSpacing(5)
                                .padding(.top, 8)
                        }

                        if let source = item.source, !source.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "link")
                                    .font(.system(size: 9))
                                Text(source)
                                    .font(.system(size: 10))
                            }
                            .foregroundStyle(.primary.opacity(0.3))
                        }
                    }
                    .padding(.leading, 13)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Countdown Badge

    @ViewBuilder
    private func countdownBadge(days: Int) -> some View {
        if days == 0 {
            Text("Today")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        } else if days > 0 {
            Text("In \(days) days")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(accentColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(accentColor.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        } else {
            Text("\(abs(days)) days ago")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.primary.opacity(0.3))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(.black.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }

    // MARK: - Status Badge

    private func statusBadge(isConfirmed: Bool, isPast: Bool) -> some View {
        let text = isPast ? "COMPLETED" : (isConfirmed ? "CONFIRMED" : "EXPECTED")
        let color = isConfirmed && !isPast ? Color(hex: "#34C759") : Color.primary.opacity(0.3)
        let bg = isConfirmed && !isPast ? Color(hex: "#34C759").opacity(0.08) : Color.black.opacity(0.04)

        return Text(text)
            .font(.system(size: 9, weight: .heavy))
            .tracking(0.6)
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 3))
    }

    // MARK: - Helpers

    private func indicatorColor(isToday: Bool, isConfirmed: Bool, isPast: Bool) -> Color {
        if isPast { return .black.opacity(0.08) }
        if isToday { return accentColor }
        if isConfirmed { return Color(hex: "#34C759") }
        return .black.opacity(0.18)
    }

    private func formatDateDisplay(_ dateStr: String?) -> String {
        guard let dateStr else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return dateStr }
        let display = DateFormatter()
        display.dateFormat = "EEEE, MMM d"
        return display.string(from: date)
    }

    private func daysUntil(_ dateStr: String?) -> Int? {
        guard let dateStr else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let targetDate = formatter.date(from: dateStr) else { return nil }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let target = calendar.startOfDay(for: targetDate)
        return calendar.dateComponents([.day], from: today, to: target).day
    }
}
