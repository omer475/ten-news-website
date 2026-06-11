import SwiftUI

// MARK: - TodayPlus Feed Redesign — article card templates (spec §5)
// 8 of the 9 live here; MAP (§5.9) is in TPMapCard.swift. The legacy
// fallback (display == nil) reuses ArticleCardContinuousView at feed level.

// MARK: Shared card context

struct TPCardContext {
    let article: Article
    let display: ArticleDisplay
    let state: TPFeedState
    var onTagTap: ((String) -> Void)? = nil
    var onInfoTap: (() -> Void)? = nil

    var accent: Color { TP.accent(for: display.category) }
    var key: String { article.id.stringValue }
}

// MARK: - 5.1 COVER — headline inside the photo

struct TPCoverCard: View {
    let ctx: TPCardContext
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            figure
            if !ctx.display.stats.isEmpty {
                TPStatsRow(stats: ctx.display.stats, accent: ctx.accent, cardKey: ctx.key, state: ctx.state)
                    .padding(.top, 18)
            }
            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }

    private var figure: some View {
        ZStack(alignment: .bottomLeading) {
            TPParallaxImage(url: ctx.display.image)

            // Scrim (§5.1): bottom 40% near-opaque so white text always passes
            // contrast on bright photos. Exact stops — do not eyeball.
            LinearGradient(
                stops: [
                    .init(color: Color(red: 12/255, green: 11/255, blue: 8/255).opacity(0.18), location: 0.0),
                    .init(color: Color(red: 12/255, green: 11/255, blue: 8/255).opacity(0.0), location: 0.32),
                    .init(color: Color(red: 12/255, green: 11/255, blue: 8/255).opacity(0.50), location: 0.60),
                    .init(color: Color(red: 12/255, green: 11/255, blue: 8/255).opacity(0.94), location: 0.96),
                ],
                startPoint: .top, endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 8) {
                kicker
                Text(TPStyle.styled(ctx.display.titleAttributed, emColor: TP.goldSoft,
                                    strongColor: .white, boldStrong: false))
                    .font(TP.headline(27))
                    .foregroundStyle(.white)
                    .lineSpacing(27 * 0.10)
                    .shadow(color: .black.opacity(0.4), radius: 12, y: 2)
                    .fixedSize(horizontal: false, vertical: true)
                if !ctx.display.lede.isEmpty {
                    Text(ctx.display.lede)
                        .font(TP.body(14.7))
                        .foregroundStyle(.white.opacity(0.82))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(20)
        }
        .aspectRatio(4 / 4.8, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: TP.imageRadius))
        .overlay(alignment: .topTrailing) {
            Text(ctx.article.tpAgeLabel)
                .font(TP.mono(9.5))
                .foregroundStyle(.white)
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .background(
                    Capsule().fill(Color(red: 12/255, green: 11/255, blue: 8/255).opacity(0.4))
                )
                .padding(12)
        }
    }

    private var kicker: some View {
        HStack(spacing: 7) {
            if ctx.display.breaking {
                ZStack {
                    if !reduceMotion {
                        Circle()
                            .stroke(TP.breakingDot.opacity(pulse ? 0 : 0.9), lineWidth: 1.5)
                            .frame(width: 7, height: 7)
                            .scaleEffect(pulse ? 3.5 : 1)
                    }
                    Circle()
                        .fill(TP.breakingDot)
                        .frame(width: 7, height: 7)
                }
                .onAppear {
                    guard !reduceMotion else { return }
                    withAnimation(.easeOut(duration: 2).repeatForever(autoreverses: false)) {
                        pulse = true
                    }
                }
            }
            Text(ctx.display.breaking ? "BREAKING · \(ctx.display.category)" : ctx.display.category)
                .tpKicker(color: .white.opacity(0.85))
        }
    }
}

// MARK: - 5.2 CLASSIC — photo top, text below

struct TPClassicCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPParallaxImage(url: ctx.display.image)
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: TP.imageRadius))
                .overlay(alignment: .topLeading) {
                    Text(ctx.display.category)
                        .font(TP.mono(9.5, weight: .medium))
                        .kerning(9.5 * 0.18)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(Capsule().fill(ctx.accent.mix(with: .black, by: 0.15)))
                        .padding(12)
                }

            HStack(alignment: .firstTextBaseline, spacing: 10) {
                TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 24)
                Text(ctx.article.tpAgeLabel)
                    .font(TP.mono(9.5))
                    .foregroundStyle(TP.ink3)
            }
            .padding(.top, 16)

            TPBullets(bullets: ctx.display.bulletsAttributed, accent: ctx.accent)
                .padding(.top, 14)

            if !ctx.display.stats.isEmpty {
                TPStatsRow(stats: ctx.display.stats, accent: ctx.accent, cardKey: ctx.key, state: ctx.state)
                    .padding(.top, 18)
            }

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }
}

// MARK: - 5.3 STAT-HERO — no photo, one giant number

struct TPStatHeroCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(ctx.accent)
                .frame(height: 3)
                .padding(.bottom, 18)

            TPKickerRow(category: ctx.display.category, accent: ctx.accent, ageLabel: ctx.article.tpAgeLabel)

            TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 30)
                .padding(.top, 10)

            if let big = ctx.display.big {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    TPCountUpText(
                        value: big.value,
                        prefix: big.prefix,
                        unit: big.unit,
                        key: "\(ctx.key).big",
                        state: ctx.state,
                        valueFont: TP.headline(56),
                        valueColor: ctx.accent,
                        unitFont: TP.headline(56 * 0.42),
                        unitColor: ctx.accent
                    )
                    Text(big.caption)
                        .font(TP.body(13.6))
                        .foregroundStyle(TP.ink2)
                        .frame(maxWidth: 220, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 20)
            }

            TPBullets(bullets: ctx.display.bulletsAttributed, accent: ctx.accent, maxCount: 2)
                .padding(.top, 16)

            // NO stats row — the big number replaces it (§5.3).
            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }
}

// MARK: - 5.4 QUOTE — pull-quote led

struct TPQuoteCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPKickerRow(category: ctx.display.category, accent: ctx.accent, ageLabel: ctx.article.tpAgeLabel)

            if let quote = ctx.display.quote {
                // Oversized opening mark, clipped so it hangs over the quote.
                Text("\u{201C}")
                    .font(TP.headline(86))
                    .foregroundStyle(ctx.accent)
                    .frame(height: 34, alignment: .topLeading)
                    .clipped()
                    .padding(.top, 14)

                Text(TPStyle.styled(quote.attributedText, emColor: ctx.accent,
                                    strongColor: TP.ink, boldStrong: false))
                    .font(TP.quoteItalic(26))
                    .foregroundStyle(TP.ink)
                    .lineSpacing(26 * 0.2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)

                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(ctx.accent)
                        .frame(width: 26, height: 1.5)
                    Text(attributionText(quote.who))
                        .font(TP.mono(10, weight: .medium))
                        .kerning(10 * 0.10)
                        .textCase(.uppercase)
                        .lineLimit(1)
                }
                .padding(.top, 14)
            }

            // Story headline restyled as a subhead — the quote owns the color,
            // so emphasis inverts: body ink2, <em> in ink (§5.4).
            Text(TPStyle.styled(ctx.display.titleAttributed, emColor: TP.ink,
                                strongColor: TP.ink, boldStrong: false))
                .font(TP.headlineBold(17))
                .foregroundStyle(TP.ink2)
                .lineSpacing(17 * 0.18)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 18)

            TPBullets(bullets: ctx.display.bulletsAttributed, accent: ctx.accent, maxCount: 2)
                .padding(.top, 14)

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }

    private func attributionText(_ who: String) -> AttributedString {
        // "Name · Role" — name in ink2, the rest ink3.
        var result = AttributedString(who)
        result.foregroundColor = TP.ink3
        if let sep = result.range(of: " · ") {
            result[result.startIndex..<sep.lowerBound].foregroundColor = TP.ink2
        }
        return result
    }
}

// MARK: - 5.5 VERSUS — two sides face off

struct TPVersusCard: View {
    let ctx: TPCardContext
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var barFilled = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPKickerRow(category: ctx.display.category, accent: ctx.accent, ageLabel: ctx.article.tpAgeLabel)

            TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 24)
                .padding(.top, 10)

            if let versus = ctx.display.versus {
                HStack(alignment: .top, spacing: 12) {
                    side(versus.a, keySuffix: "a")
                    ZStack {
                        Circle().strokeBorder(ctx.accent, lineWidth: 1.5)
                        Text("VS")
                            .font(TP.headline(12.5))
                            .foregroundStyle(ctx.accent)
                    }
                    .frame(width: 40, height: 40)
                    side(versus.b, keySuffix: "b")
                }
                .padding(.top, 20)

                ratioBar(versus.ratio)
                    .padding(.top, 18)

                if let note = versus.note, !note.isEmpty {
                    TPBullets(bullets: [AttributedString(note)], accent: ctx.accent, maxCount: 1)
                        .padding(.top, 14)
                }
            }

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }

    private func side(_ s: DisplayVersus.Side, keySuffix: String) -> some View {
        VStack(spacing: 6) {
            TPCountUpText(
                value: s.val.value,
                unit: s.unit ?? "",
                key: "\(ctx.key).vs.\(keySuffix)",
                state: ctx.state,
                valueFont: TP.headline(38),
                valueColor: TP.ink,
                unitFont: TP.headline(38 * 0.45),
                unitColor: ctx.accent
            )
            Text(s.who)
                .font(TP.mono(9, weight: .medium))
                .kerning(9 * 0.10)
                .foregroundStyle(TP.ink3)
                .textCase(.uppercase)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private func ratioBar(_ ratio: Double) -> some View {
        GeometryReader { geo in
            let target = geo.size.width * ratio
            ZStack(alignment: .leading) {
                Capsule().fill(TP.line)
                HStack(spacing: 0) {
                    Capsule()
                        .fill(ctx.accent)
                        .frame(width: barFilled || reduceMotion ? target : 0)
                    Spacer(minLength: 0)
                }
                HStack(spacing: 0) {
                    Spacer().frame(width: target)
                    Capsule()
                        .fill(ctx.accent.mix(with: .white, by: 0.7))
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .frame(height: 6)
        .tpOnVisible(threshold: 0.5) {
            guard !reduceMotion, ctx.state.shouldAnimate("\(ctx.key).vsbar") else {
                barFilled = true
                return
            }
            withAnimation(TP.barFill.delay(0.15)) { barFilled = true }
        }
        .onAppear {
            // Scroll-back after the one-shot fired: render full instantly.
            if ctx.state.hasAnimated("\(ctx.key).vsbar") { barFilled = true }
        }
    }
}

// MARK: - 5.6 TIMELINE — developing story

struct TPTimelineCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPKickerRow(category: ctx.display.category, accent: ctx.accent,
                        ageLabel: ctx.article.tpAgeLabel, prefixText: "DEVELOPING")

            TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 24)
                .padding(.top, 10)

            rail
                .padding(.top, 20)

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }

    private var rail: some View {
        let entries = ctx.display.timelineEntries
        return VStack(alignment: .leading, spacing: 18) {
            ForEach(Array(entries.enumerated()), id: \.offset) { idx, entry in
                HStack(alignment: .top, spacing: 0) {
                    ZStack {
                        Circle()
                            .strokeBorder(ctx.accent, lineWidth: 2)
                            .background(Circle().fill(idx == 0 ? ctx.accent : TP.bg))
                    }
                    .frame(width: 11, height: 11)
                    .padding(.top, 2)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.dateLabel)
                            .font(TP.mono(9.5, weight: .medium))
                            .kerning(9.5 * 0.12)
                            .foregroundStyle(ctx.accent)
                            .textCase(.uppercase)
                        Text(TPStyle.styled(entry.attributedText, emColor: ctx.accent))
                            .font(TP.body(14.7))
                            .foregroundStyle(TP.ink2)
                            .lineSpacing(14.7 * 0.4)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.leading, 13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .background(alignment: .topLeading) {
            // 1.5pt rail through the node centers (x = 5pt).
            Rectangle()
                .fill(TP.line)
                .frame(width: 1.5)
                .padding(.leading, 5)
                .padding(.vertical, 6)
        }
    }
}

// MARK: - 5.7 SPLIT — compact, square thumb left

struct TPSplitCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                AsyncCachedImage(url: ctx.display.image, contentMode: .fill)
                    .frame(width: 116, height: 116)
                    .clipShape(RoundedRectangle(cornerRadius: TP.splitThumbRadius))

                VStack(alignment: .leading, spacing: 7) {
                    TPKickerRow(category: ctx.display.category, accent: ctx.accent,
                                ageLabel: ctx.article.tpAgeLabel)
                    Text(TPStyle.styled(ctx.display.titleAttributed, emColor: ctx.accent,
                                        strongColor: TP.ink, boldStrong: false))
                        .font(TP.headline(18))
                        .foregroundStyle(TP.ink)
                        .lineSpacing(18 * 0.2)
                        .fixedSize(horizontal: false, vertical: true)
                    if let first = ctx.display.bulletsAttributed.first {
                        // Exactly ONE bullet rendered as a plain paragraph.
                        Text(TPStyle.styled(first, emColor: ctx.accent))
                            .font(TP.body(14))
                            .foregroundStyle(TP.ink2)
                            .lineSpacing(14 * 0.4)
                            .lineLimit(3)
                    }
                }
            }

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 12)
        }
    }
}

// MARK: - 5.8 CHART — animated trend bars

struct TPChartCard: View {
    let ctx: TPCardContext
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var grown = false
    /// Whether THIS appearance owns the one-shot grow animation. Scroll-backs
    /// (registry already fired) grow instantly with no animation.
    @State private var animateGrowth = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPKickerRow(category: ctx.display.category, accent: ctx.accent, ageLabel: ctx.article.tpAgeLabel)

            TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 24)
                .padding(.top, 10)

            if let trend = ctx.display.trend {
                chart(trend)
                    .padding(.top, 20)

                if let caption = trend.caption, !caption.isEmpty {
                    Text(caption)
                        .font(TP.body(14))
                        .foregroundStyle(TP.ink2)
                        .lineSpacing(14 * 0.4)
                        .padding(.top, 14)
                }
            }

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }

    private func chart(_ trend: DisplayTrend) -> some View {
        let points = trend.points
        let maxVal = max(points.map(\.value).max() ?? 1, 0.0001)
        let lastIdx = points.count - 1
        return VStack(spacing: 6) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(Array(points.enumerated()), id: \.offset) { idx, point in
                    VStack(spacing: 4) {
                        Text(TPNumberFormat.string(for: point.value))
                            .font(TP.mono(9, weight: idx == lastIdx ? .medium : .regular))
                            .foregroundStyle(idx == lastIdx ? ctx.accent : TP.ink3)
                        UnevenRoundedRectangle(
                            topLeadingRadius: 6, bottomLeadingRadius: 2,
                            bottomTrailingRadius: 2, topTrailingRadius: 6
                        )
                        .fill(idx == lastIdx ? ctx.accent : ctx.accent.mix(with: .white, by: 0.78))
                        .frame(height: max(6, 120 * point.value / maxVal))
                        .scaleEffect(y: grown || reduceMotion ? 1 : 0.001, anchor: .bottom)
                        .animation(
                            (reduceMotion || !animateGrowth)
                                ? nil
                                : .easeOut(duration: 0.8).delay(Double(idx) * 0.08),
                            value: grown
                        )
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 8) {
                ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                    Text(point.label)
                        .font(TP.mono(9))
                        .foregroundStyle(TP.ink3)
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .tpOnVisible(threshold: 0.5) {
            if !reduceMotion && ctx.state.shouldAnimate("\(ctx.key).chart") {
                animateGrowth = true
            }
            grown = true
        }
        .onAppear {
            if ctx.state.hasAnimated("\(ctx.key).chart") { grown = true }
        }
    }
}
