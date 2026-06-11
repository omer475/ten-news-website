import SwiftUI

// MARK: - TodayPlus Feed Redesign — shared card components + engagement helpers
// Spec §5 (common card chrome), §6 (open stats row), §7 (engagement mechanics).

// MARK: Session state (read counter, one-shot animation registry, bookmarks)

@MainActor @Observable
final class TPFeedState {
    /// Read counter (§7.1): increments once per story card at ≥55% visibility.
    /// Session-only by design — not gamified across days yet.
    private(set) var readCount = 0
    private var countedCards: Set<String> = []

    /// One-shot animation registry (§7.2/§10.3): count-ups, bar fills and
    /// entrances fire exactly once per key, never re-animating on scroll-back
    /// (LazyVStack recreates views, so per-view @State can't enforce this).
    private var animatedKeys: Set<String> = []

    var bookmarked: Set<String> = Set(
        UserDefaults.standard.stringArray(forKey: "tp_bookmarked_ids") ?? []
    )

    func countRead(cardId: String) {
        guard !countedCards.contains(cardId) else { return }
        countedCards.insert(cardId)
        readCount += 1
    }

    /// Returns true the FIRST time a key is seen; false afterwards.
    func shouldAnimate(_ key: String) -> Bool {
        guard !animatedKeys.contains(key) else { return false }
        animatedKeys.insert(key)
        return true
    }

    func hasAnimated(_ key: String) -> Bool { animatedKeys.contains(key) }

    func toggleBookmark(_ id: String) {
        if bookmarked.contains(id) { bookmarked.remove(id) } else { bookmarked.insert(id) }
        UserDefaults.standard.set(Array(bookmarked), forKey: "tp_bookmarked_ids")
    }
}

// MARK: - Attributed styling (em → accent, b → bold ink)

enum TPStyle {
    /// Map the decode-time inline intents onto concrete colors/weights.
    /// <em> entities: accent color, same weight, no italic (§2.3).
    /// <b>: bold spans in `ink` (or the provided strong color).
    static func styled(
        _ source: AttributedString,
        emColor: Color,
        strongColor: Color = TP.ink,
        boldStrong: Bool = true
    ) -> AttributedString {
        var result = source
        for run in result.runs {
            guard let intent = run.inlinePresentationIntent else { continue }
            if intent.contains(.emphasized) {
                result[run.range].foregroundColor = emColor
                result[run.range].inlinePresentationIntent = nil
            } else if intent.contains(.stronglyEmphasized) {
                result[run.range].foregroundColor = strongColor
                result[run.range].inlinePresentationIntent = boldStrong ? .stronglyEmphasized : nil
            }
        }
        return result
    }
}

// MARK: - One-shot visibility trigger

extension View {
    /// Fires `action` the first time the view is at least `threshold` visible.
    func tpOnVisible(threshold: Double, perform action: @escaping () -> Void) -> some View {
        modifier(TPVisibleOnce(threshold: threshold, action: action))
    }
}

private struct TPVisibleOnce: ViewModifier {
    let threshold: Double
    let action: () -> Void
    @State private var fired = false

    func body(content: Content) -> some View {
        content.onScrollVisibilityChange(threshold: threshold) { visible in
            if visible && !fired {
                fired = true
                action()
            }
        }
    }
}

// MARK: - Card entrance (§5 common): fade in + rise 22pt at ≥12% visible

extension View {
    func tpEntrance(key: String, state: TPFeedState) -> some View {
        modifier(TPEntrance(key: key, state: state))
    }
}

private struct TPEntrance: ViewModifier {
    let key: String
    let state: TPFeedState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        let alreadyDone = state.hasAnimated("entrance.\(key)")
        content
            .opacity(shown || alreadyDone || reduceMotion ? 1 : 0)
            .offset(y: shown || alreadyDone || reduceMotion ? 0 : 22)
            .onScrollVisibilityChange(threshold: 0.12) { visible in
                guard visible, !shown, !alreadyDone else { return }
                if reduceMotion {
                    shown = true
                    _ = state.shouldAnimate("entrance.\(key)")
                    return
                }
                guard state.shouldAnimate("entrance.\(key)") else { shown = true; return }
                withAnimation(TP.entrance) { shown = true }
            }
    }
}

// MARK: - Count-up number (§7.2)
// 0 → target over 0.9s, ease-out-cubic, thousands separators, one decimal iff
// the target has decimals, prefix included from frame zero. Animates exactly
// once (registry-keyed); Reduce Motion renders the final value instantly.

struct TPCountUpText: View {
    let value: Double
    var prefix: String = ""
    var unit: String = ""
    let key: String
    let state: TPFeedState
    let valueFont: Font
    let valueColor: Color
    var unitFont: Font? = nil
    var unitColor: Color? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animStart: Date? = nil
    @State private var settled = false

    private static let duration: TimeInterval = 0.9

    var body: some View {
        Group {
            if let start = animStart, !settled {
                TimelineView(.animation) { context in
                    let t = min(1, context.date.timeIntervalSince(start) / Self.duration)
                    let eased = 1 - pow(1 - t, 3)
                    text(for: value * eased)
                        .onChange(of: t >= 1) { _, done in
                            if done { settled = true }
                        }
                }
            } else if settled || state.hasAnimated("countup.\(key)") || reduceMotion {
                text(for: value)
            } else {
                // Not yet visible: hold at 0 (prefix visible from frame zero).
                text(for: 0)
                    .tpOnVisible(threshold: 0.5) {
                        if reduceMotion || !state.shouldAnimate("countup.\(key)") {
                            settled = true
                        } else {
                            animStart = Date()
                        }
                    }
            }
        }
        .accessibilityLabel("\(prefix)\(TPNumberFormat.string(for: value))\(unit)")
    }

    private func text(for v: Double) -> Text {
        // Keep the decimal shape of the TARGET while animating, so the layout
        // doesn't jitter between integer and decimal frames.
        let targetHasDecimals = value.truncatingRemainder(dividingBy: 1) != 0
        let shown = targetHasDecimals ? v : v.rounded(.down)
        var s = TPNumberFormat.string(for: shown)
        if targetHasDecimals && !s.contains(".") { s += ".0" }
        let main = Text("\(prefix)\(s)")
            .font(valueFont)
            .foregroundStyle(valueColor)
        guard !unit.isEmpty else { return main.monospacedDigit() }
        let unitText = Text(unit)
            .font(unitFont ?? valueFont)
            .foregroundStyle(unitColor ?? valueColor)
        return (main + unitText).monospacedDigit()
    }
}

// MARK: - Image parallax (§7.3)
// Translate by (cardCenterOffsetFromViewportCenter / viewportHeight) × −26pt.
// Image layer oversized (−12% vertical inset) so edges never show.

struct TPParallaxImage: View {
    let url: URL?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let screenH = UIScreen.main.bounds.height
            let offsetFromCenter = geo.frame(in: .global).midY - screenH / 2
            let parallax: CGFloat = reduceMotion ? 0 : (offsetFromCenter / screenH) * -26

            AsyncCachedImage(url: url, contentMode: .fill)
                .frame(width: geo.size.width, height: geo.size.height * 1.24)
                .offset(y: -geo.size.height * 0.12 + parallax)
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
        }
    }
}

// MARK: - Kicker row (§5 common)

struct TPKickerRow: View {
    let category: String
    let accent: Color
    let ageLabel: String
    var prefixText: String? = nil   // e.g. "DEVELOPING" / "ON THE MAP"

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(prefixText.map { "\($0) · \(category)" } ?? category)
                .tpKicker(color: accent)
            Spacer()
            Text(ageLabel)
                .font(TP.mono(9.5))
                .foregroundStyle(TP.ink3)
        }
    }
}

// MARK: - Bullets (accent dots, §2.4)

struct TPBullets: View {
    let bullets: [AttributedString]
    let accent: Color
    var maxCount: Int = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            ForEach(Array(bullets.prefix(maxCount).enumerated()), id: \.offset) { _, bullet in
                HStack(alignment: .top, spacing: 0) {
                    Circle()
                        .fill(accent)
                        .frame(width: TP.bulletDot, height: TP.bulletDot)
                        .padding(.leading, 2)
                        .padding(.top, 7.5)
                    Text(TPStyle.styled(bullet, emColor: accent))
                        .font(TP.body(15))
                        .foregroundStyle(TP.ink2)
                        .lineSpacing(15 * 0.55)
                        .padding(.leading, TP.bulletIndent - TP.bulletDot - 2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

// MARK: - Open stats row (§6) — never inside a box; dash + value + label + sub

struct TPStatsRow: View {
    let stats: [DisplayStat]
    let accent: Color
    let cardKey: String
    let state: TPFeedState

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ForEach(Array(stats.prefix(3).enumerated()), id: \.offset) { idx, stat in
                VStack(alignment: .leading, spacing: 0) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(accent)
                        .frame(width: 22, height: 2)
                        .padding(.bottom, 10)
                    TPCountUpText(
                        value: stat.value,
                        prefix: stat.prefix,
                        unit: stat.unit,
                        key: "\(cardKey).stat\(idx)",
                        state: state,
                        valueFont: TP.headline(26),
                        valueColor: TP.ink,
                        unitFont: TP.headline(26 * 0.6),
                        unitColor: accent
                    )
                    Text(stat.label)
                        .font(TP.mono(9, weight: .medium))
                        .kerning(9 * 0.10)
                        .foregroundStyle(TP.ink3)
                        .textCase(.uppercase)
                        .padding(.top, 7)
                    if !stat.sub.isEmpty {
                        Text(stat.sub)
                            .font(TP.body(11.5))
                            .foregroundStyle(TP.ink2)
                            .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Footer (§5 common): tag pills + info / bookmark / share

struct TPCardFooter: View {
    let article: Article
    let tags: [String]
    let state: TPFeedState
    var onTagTap: ((String) -> Void)? = nil
    var onInfoTap: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bookmarkPop = false

    private var articleId: String { article.id.stringValue }
    private var isBookmarked: Bool { state.bookmarked.contains(articleId) }

    var body: some View {
        HStack(spacing: 6) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(tags, id: \.self) { tag in
                        Button {
                            onTagTap?(tag)
                        } label: {
                            Text(tag)
                                .font(TP.body(12.5, weight: .medium))
                                .foregroundStyle(TP.ink2)
                                .padding(.horizontal, 13)
                                .padding(.vertical, 7)
                                .background(
                                    Capsule().strokeBorder(TP.line, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Spacer(minLength: 4)

            if let onInfoTap {
                footerIcon("info.circle") { onInfoTap() }
            }
            footerIcon(isBookmarked ? "bookmark.fill" : "bookmark", tint: isBookmarked ? TP.gold : TP.ink3) {
                state.toggleBookmark(articleId)
                HapticManager.selection()
                guard !reduceMotion else { return }
                // §5: pop — scale to 1.3 at 45% then back, 0.4s spring curve
                withAnimation(TP.bookmarkPop) { bookmarkPop = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                    withAnimation(TP.bookmarkPop) { bookmarkPop = false }
                }
            }
            .scaleEffect(bookmarkPop ? 1.3 : 1.0)

            if let urlString = article.url, let url = URL(string: urlString) {
                ShareLink(item: url, subject: Text(article.display?.plainTitle ?? article.plainTitle)) {
                    iconLabel("square.and.arrow.up")
                }
                .buttonStyle(.plain)
            } else {
                ShareLink(item: article.display?.plainTitle ?? article.plainTitle) {
                    iconLabel("square.and.arrow.up")
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func footerIcon(_ systemName: String, tint: Color = TP.ink3, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            iconLabel(systemName, tint: tint)
        }
        .buttonStyle(.plain)
    }

    private func iconLabel(_ systemName: String, tint: Color = TP.ink3) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 15.5, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: 36, height: 36)
            .contentShape(Circle())
    }
}

// MARK: - Headline helper

struct TPHeadline: View {
    let attributed: AttributedString
    let accent: Color
    var size: CGFloat = 25
    var color: Color = TP.ink

    var body: some View {
        Text(TPStyle.styled(attributed, emColor: accent, strongColor: color, boldStrong: false))
            .font(TP.headline(size))
            .foregroundStyle(color)
            .lineSpacing(size * 0.13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}
