import SwiftUI

// MARK: - TodayPlus Feed Redesign — interstitial modules (spec §8)
// All modules share the header treatment: mono gold label + hairline rule.
// No boxes/backgrounds — open layouts with hairline dividers only.
// Banned: polls, quizzes, anything displaying aggregate user counts.

// MARK: Shared header

private struct TPModuleHeaderRow: View {
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            Text(title).tpModuleHeader()
            Rectangle()
                .fill(TP.line)
                .frame(height: 1)
        }
    }
}

// MARK: - Dispatcher

struct TPModuleView: View {
    let item: TPModuleItem
    let moduleKey: String
    let state: TPFeedState

    var body: some View {
        switch item {
        case .countdown(let row):
            TPCountdownModule(row: row)
        case .history(let module):
            TPHistoryModule(module: module)
        case .briefs(let module, let variantTitle):
            TPBriefsModule(module: module, title: variantTitle)
        case .notd(let module):
            TPNotdModule(module: module, moduleKey: moduleKey, state: state)
        }
    }
}

// MARK: - 8.1 COUNTING DOWN

struct TPCountdownModule: View {
    let row: CountdownsModule.Row

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            TPModuleHeaderRow(title: "COUNTING DOWN")

            Text(row.name)
                .font(TP.headlineBold(18.4))
                .foregroundStyle(TP.ink)

            // Ticks every second. This is a live clock (content), so it keeps
            // ticking under Reduce Motion — only decorative motion is killed.
            TimelineView(.periodic(from: .now, by: 1)) { context in
                columns(remaining: max(0, (row.date ?? .now).timeIntervalSince(context.date)))
            }

            if let context = row.context, !context.isEmpty {
                Text(context)
                    .font(TP.body(14))
                    .foregroundStyle(TP.ink2)
                    .lineSpacing(14 * 0.4)
            }
        }
    }

    private func columns(remaining: TimeInterval) -> some View {
        let total = Int(remaining)
        let parts: [(value: Int, label: String)] = [
            (total / 86400, "DAYS"),
            ((total % 86400) / 3600, "HOURS"),
            ((total % 3600) / 60, "MIN"),
            (total % 60, "SEC"),
        ]
        return HStack(spacing: 0) {
            ForEach(Array(parts.enumerated()), id: \.offset) { idx, part in
                if idx > 0 {
                    Rectangle().fill(TP.line).frame(width: 1, height: 44)
                }
                VStack(spacing: 4) {
                    Text(String(format: "%02d", part.value))
                        .font(TP.headline(34))
                        .monospacedDigit()
                        .foregroundStyle(TP.ink)
                    Text(part.label)
                        .font(TP.mono(9, weight: .medium))
                        .kerning(9 * 0.12)
                        .foregroundStyle(TP.ink3)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - 8.2 TODAY IN HISTORY

struct TPHistoryModule: View {
    let module: HistoryModule

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPModuleHeaderRow(title: "TODAY IN HISTORY")
                .padding(.bottom, 16)

            ForEach(Array(module.rows.prefix(3).enumerated()), id: \.offset) { idx, row in
                if idx > 0 {
                    Rectangle().fill(TP.line).frame(height: 1)
                        .padding(.vertical, 13)
                }
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(String(row.year))
                        .font(TP.headline(20.8))
                        .monospacedDigit()
                        .foregroundStyle(TP.gold)
                        .frame(width: 64, alignment: .leading)
                    Text(TPStyle.styled(row.attributedText, emColor: TP.gold))
                        .font(TP.body(14.7))
                        .foregroundStyle(TP.ink2)
                        .lineSpacing(14.7 * 0.4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

// MARK: - 8.3 IN 10 SECONDS / WHILE YOU SCROLLED

struct TPBriefsModule: View {
    let module: BriefsModule
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TPModuleHeaderRow(title: title)

            ForEach(Array(module.rows.prefix(3).enumerated()), id: \.offset) { _, row in
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(row.tag)
                        .font(TP.mono(10, weight: .medium))
                        .kerning(10 * 0.10)
                        .foregroundStyle(TP.gold)
                        .textCase(.uppercase)
                        .frame(width: 42, alignment: .leading)
                    Text(TPStyle.styled(row.attributedText, emColor: TP.gold))
                        .font(TP.body(14.9))
                        .foregroundStyle(TP.ink2)
                        .lineSpacing(14.9 * 0.4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

// MARK: - 8.5 NUMBER OF THE DAY

struct TPNotdModule: View {
    let module: NotdModule
    let moduleKey: String
    let state: TPFeedState

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TPModuleHeaderRow(title: "NUMBER OF THE DAY")

            TPCountUpText(
                value: module.value.value,
                prefix: module.prefix ?? "",
                unit: module.unit ?? "",
                key: "\(moduleKey).notd",
                state: state,
                valueFont: TP.headline(64),
                valueColor: TP.ink,
                unitFont: TP.headline(64 * 0.42),
                unitColor: TP.gold
            )

            if let context = module.context, !context.isEmpty {
                Text(context)
                    .font(TP.body(14.7))
                    .foregroundStyle(TP.ink2)
                    .lineSpacing(14.7 * 0.4)
            }
        }
    }
}
