import SwiftUI

// MARK: - TodayPlus Feed Redesign — the feed shell (spec §7)
// Sticky blurred header (wordmark + read counter), 2pt reading-progress bar,
// breaking marquee ticker, then the assembled block list (cards + modules)
// with entrance animations, count-up triggers and infinite scroll.

struct TPFeedView<Center: View>: View {
    @Binding var currentPageIndex: Int
    let viewModel: FeedViewModel
    var onTopicTap: (String, String?) -> Void
    @ViewBuilder var centerControl: () -> Center

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scrollProgress: CGFloat = 0
    @State private var headerHeight: CGFloat = 120
    @State private var infoURL: TPSafariURL? = nil

    private var state: TPFeedState { viewModel.tpFeedState }

    var body: some View {
        ZStack(alignment: .top) {
            TP.bg.ignoresSafeArea()

            blockList

            header
        }
        .environment(\.colorScheme, .light)   // the redesign is a light surface by design
        .sheet(item: $infoURL) { wrapper in
            SafariView(url: wrapper.url)
                .ignoresSafeArea()
        }
        .task {
            await viewModel.loadFeedModulesIfNeeded()
        }
    }

    // MARK: Header (§7.1)

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                wordmark
                    .frame(maxWidth: .infinity, alignment: .leading)
                centerControl()
                readCounter
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.horizontal, TP.hPadding)
            .padding(.top, deviceTopSafeAreaInset)
            .padding(.bottom, 10)

            // 2pt reading progress bar — gold, scroll progress of the page.
            GeometryReader { geo in
                Rectangle()
                    .fill(TP.gold)
                    .frame(width: geo.size.width * scrollProgress)
            }
            .frame(height: 2)

            if !viewModel.breakingTickerItems.isEmpty {
                TPBreakingTicker(items: viewModel.breakingTickerItems)
            }
        }
        .background(TP.bg.opacity(0.8))
        .background(.ultraThinMaterial)
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.height
        } action: { newValue in
            headerHeight = newValue
        }
    }

    private var wordmark: some View {
        (Text("today").foregroundStyle(TP.ink) + Text("plus").foregroundStyle(TP.gold))
            .font(TP.headline(17.5))
            .kerning(-0.5)
            .lineLimit(1)
    }

    private var readCounter: some View {
        TPReadCounter(state: state)
    }

    // MARK: Block list

    private var blockList: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: TP.blockGap) {
                ForEach(viewModel.feedBlocks) { block in
                    blockView(block)
                        .padding(.horizontal, TP.hPadding)
                        .frame(maxWidth: TP.columnMaxWidth)
                }

                if viewModel.isLoading && !viewModel.feedBlocks.isEmpty {
                    TPLoadingDots()
                        .padding(.vertical, 24)
                }

                Spacer().frame(height: 90)
            }
            .padding(.top, headerHeight + 18)
        }
        .ignoresSafeArea()
        .onScrollGeometryChange(for: CGFloat.self) { geo in
            let scrollable = max(1, geo.contentSize.height - geo.containerSize.height)
            return min(1, max(0, geo.contentOffset.y / scrollable))
        } action: { _, newValue in
            scrollProgress = newValue
        }
        .refreshable {
            await viewModel.refresh()
            viewModel.currentIndex = 0
            viewModel.recordViewStart(at: 0)
        }
    }

    @ViewBuilder
    private func blockView(_ block: TPBlock) -> some View {
        switch block {
        case .story(let index, let article, let template):
            storyCard(index: index, article: article, template: template)
                .tpEntrance(key: block.id, state: state)
                .tpOnVisible(threshold: 0.55) {
                    // Read counter: once per story card; modules don't count.
                    state.countRead(cardId: block.id)
                }
                .onAppear {
                    viewModel.recordViewStart(at: index)
                    currentPageIndex = index
                    viewModel.trackArticleView(at: index)
                    if index >= viewModel.articles.count - 5 {
                        Task { await viewModel.loadMoreIfNeeded() }
                    }
                }
                .onDisappear {
                    viewModel.recordSwipeAway(fromIndex: index)
                }
        case .module(let key, let item):
            TPModuleView(item: item, moduleKey: key, state: state)
                .tpEntrance(key: key, state: state)
        }
    }

    @ViewBuilder
    private func storyCard(index: Int, article: Article, template: CardTemplate) -> some View {
        if template != .legacy, let display = article.display {
            let ctx = TPCardContext(
                article: article,
                display: display,
                state: state,
                onTagTap: { tag in onTopicTap(tag, article.id.stringValue) },
                onInfoTap: {
                    if let urlString = article.url, let url = URL(string: urlString) {
                        infoURL = TPSafariURL(url: url)
                    }
                }
            )
            switch template {
            case .cover: TPCoverCard(ctx: ctx)
            case .classic: TPClassicCard(ctx: ctx)
            case .stat: TPStatHeroCard(ctx: ctx)
            case .quote: TPQuoteCard(ctx: ctx)
            case .versus: TPVersusCard(ctx: ctx)
            case .line: TPTimelineCard(ctx: ctx)
            case .split: TPSplitCard(ctx: ctx)
            case .chart: TPChartCard(ctx: ctx)
            case .map: TPMapCard(ctx: ctx)
            case .legacy: EmptyView()
            }
        } else {
            // display == nil → the current/legacy card, untouched.
            ArticleCardContinuousView(
                article: article,
                accentColor: viewModel.accentColor(for: article),
                onTopicTap: onTopicTap
            )
        }
    }

    private var deviceTopSafeAreaInset: CGFloat {
        UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .safeAreaInsets.top
        ?? 47
    }
}

private struct TPSafariURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

// MARK: - Read counter (§7.1): bolt + count + READ; pops on increment

private struct TPReadCounter: View {
    let state: TPFeedState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var popped = false

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11))
                .foregroundStyle(TP.gold)
            Text("\(state.readCount)")
                .font(TP.headline(14))
                .monospacedDigit()
                .foregroundStyle(TP.ink)
            Text("READ")
                .font(TP.mono(9, weight: .medium))
                .kerning(9 * 0.12)
                .foregroundStyle(TP.ink3)
        }
        .scaleEffect(popped ? 1.14 : 1.0)
        .onChange(of: state.readCount) { _, _ in
            guard !reduceMotion else { return }
            withAnimation(.spring(response: 0.2, dampingFraction: 0.5)) { popped = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) { popped = false }
            }
        }
    }
}

// MARK: - Breaking ticker (§7.1): marquee, 38s loop, seamless

private struct TPBreakingTicker: View {
    let items: [String]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var contentWidth: CGFloat = 0
    @State private var scrolling = false

    var body: some View {
        Group {
            if reduceMotion {
                // §7.5: ticker becomes static text.
                tickerLine
                    .lineLimit(1)
                    .padding(.horizontal, TP.hPadding)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                marquee
            }
        }
        .padding(.vertical, 7)
        .overlay(alignment: .top) { Rectangle().fill(TP.line).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(TP.line).frame(height: 1) }
        .clipped()
    }

    private var marquee: some View {
        HStack(spacing: 0) {
            tickerLine
                .fixedSize()
                .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.size.width
                } action: { newValue in
                    if contentWidth != newValue { contentWidth = newValue }
                }
            tickerLine
                .fixedSize()
        }
        .offset(x: scrolling ? -contentWidth : 0)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: contentWidth) { _, width in
            guard width > 0 else { return }
            scrolling = false
            withAnimation(.linear(duration: 38).repeatForever(autoreverses: false)) {
                scrolling = true
            }
        }
    }

    private var tickerLine: Text {
        items.reduce(Text("")) { acc, item in
            acc
            + Text("BREAKING ").foregroundStyle(TP.red)
            + Text(item).foregroundStyle(TP.ink)
            + Text("   ·   ").foregroundStyle(TP.ink3)
        }
        .font(TP.mono(10.5, weight: .medium))
    }
}

// MARK: - Infinite-scroll loader (§7.4): three dots hopping, gold tint on hop

private struct TPLoadingDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hopping = false

    var body: some View {
        HStack(spacing: 7) {
            ForEach(0..<3, id: \.self) { idx in
                Circle()
                    .fill(hopping ? TP.gold : TP.ink3)
                    .frame(width: 5, height: 5)
                    .offset(y: hopping && !reduceMotion ? -7 : 0)
                    .animation(
                        reduceMotion ? nil :
                            .easeInOut(duration: 0.45)
                            .repeatForever(autoreverses: true)
                            .delay(Double(idx) * 0.15),
                        value: hopping
                    )
            }
        }
        .onAppear { hopping = true }
    }
}
