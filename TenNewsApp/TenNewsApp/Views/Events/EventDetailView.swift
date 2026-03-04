import SwiftUI

/// Event deep-dive page — clean editorial design matching HTML mockup.
struct EventDetailView: View {
    let event: WorldEvent

    @State private var viewModel = EventDetailViewModel()
    @State private var accentColor: Color = Color(hex: "#0A84FF")
    @State private var backgroundExpanded = false
    @State private var showHistoryTimeline = false
    @State private var isFollowed = false
    @Environment(\.dismiss) private var dismiss
    @Environment(TabBarState.self) private var tabBarState

    private let followKey = "followed_event_slugs"

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                heroSection

                if let detail = viewModel.eventDetail {
                    contentSections(detail)
                } else if viewModel.isLoading {
                    loadingContent
                } else if let error = viewModel.errorMessage {
                    errorContent(error)
                }
            }
        }
        .background(Color(hex: "#F2F2F7").ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .navigationBarHidden(true)
        .overlay(alignment: .top) { navigationOverlay }
        .onAppear { tabBarState.hideBottomBar = true }
        .onDisappear { tabBarState.hideBottomBar = false }
        .task {
            loadFollowState()
            if let hex = event.blurColor {
                accentColor = Color(hex: hex)
            }
            await viewModel.loadEvent(slug: event.slug)
        }
    }

    // MARK: - Navigation Overlay

    private var navigationOverlay: some View {
        HStack {
            Button {
                HapticManager.light()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(.black.opacity(0.25))
                    .clipShape(Circle())
            }
            Spacer()

            Button {
                HapticManager.light()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                    toggleFollow()
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: isFollowed ? "checkmark" : "plus")
                        .font(.system(size: 11, weight: .bold))
                        .contentTransition(.symbolEffect(.replace))
                    Text(isFollowed ? "Following" : "Follow")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isFollowed ? Color.white.opacity(0.3) : Color.black.opacity(0.25))
                .background(.ultraThinMaterial.opacity(0.6))
                .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }

    private func loadFollowState() {
        let saved = UserDefaults.standard.stringArray(forKey: followKey) ?? []
        isFollowed = saved.contains(event.slug)
    }

    private func toggleFollow() {
        var saved = Set(UserDefaults.standard.stringArray(forKey: followKey) ?? [])
        if isFollowed {
            saved.remove(event.slug)
        } else {
            saved.insert(event.slug)
        }
        UserDefaults.standard.set(Array(saved), forKey: followKey)
        isFollowed = !isFollowed
    }

    // MARK: - Hero Image URL

    private var heroImageURL: URL? {
        // Always prefer event image (already cached from card) to avoid flash on load
        if let url = event.displayImage {
            return url
        }
        // Fall back to detail images only if event has none
        if let detail = viewModel.eventDetail {
            return detail.displayImage
        }
        return nil
    }

    // MARK: - Hero Section

    private let pageBg = Color(hex: "#F2F2F7")

    /// Whether this event has history data (timeline or historical comparison)
    private var hasHistoryData: Bool {
        viewModel.eventDetail?.components?.historicalComparison != nil ||
        !(viewModel.eventDetail?.timeline?.isEmpty ?? true)
    }

    private var heroSection: some View {
        VStack(spacing: 0) {
            // Fixed-height image area — NEVER changes height
            GeometryReader { geo in
                let width = geo.size.width

                ZStack(alignment: .bottom) {
                    // Background image — always 440px
                    if let imageUrl = heroImageURL {
                        AsyncCachedImage(url: imageUrl, contentMode: .fill)
                            .frame(width: width, height: 440)
                            .clipped()
                    } else {
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [accentColor, accentColor.opacity(0.6), Color(hex: "#1d1d1f")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: width, height: 440)
                    }

                    // White gradient — fades image to page background (instant, no animation)
                    LinearGradient(
                        stops: [
                            .init(color: pageBg.opacity(0), location: 0.0),
                            .init(color: pageBg.opacity(0.05), location: 0.15),
                            .init(color: pageBg.opacity(0.25), location: 0.35),
                            .init(color: pageBg.opacity(0.55), location: 0.55),
                            .init(color: pageBg.opacity(0.85), location: 0.72),
                            .init(color: pageBg, location: 0.85),
                            .init(color: pageBg, location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(width: width, height: 440)

                    // Content overlay (metadata, title, day counter, description)
                    VStack(alignment: .leading, spacing: 0) {
                        Spacer()

                        if let detail = viewModel.eventDetail {
                            // Metadata row: left = DEVELOPING + articles + countries, right = History button
                            HStack(spacing: 10) {
                                Text("DEVELOPING")
                                    .font(.system(size: 9, weight: .heavy))
                                    .tracking(1.5)
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(accentColor)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))

                                if let total = detail.totalArticles {
                                    HStack(spacing: 4) {
                                        Image(systemName: "doc.text")
                                            .font(.system(size: 11))
                                        Text("\(total) articles")
                                    }
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(.primary.opacity(0.35))
                                }

                                if let countries = detail.countries, !countries.isEmpty {
                                    HStack(spacing: 4) {
                                        Image(systemName: "globe")
                                            .font(.system(size: 11))
                                        Text("\(countries.count) countries")
                                    }
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(.primary.opacity(0.35))
                                }

                                Spacer()

                                // History button — low opacity glass matching save/share buttons
                                if hasHistoryData {
                                    Button {
                                        withAnimation(.easeInOut(duration: 0.3)) {
                                            showHistoryTimeline.toggle()
                                        }
                                        HapticManager.light()
                                    } label: {
                                        Image(systemName: "clock.arrow.circlepath")
                                            .font(.system(size: 14))
                                            .foregroundStyle(.primary.opacity(0.4))
                                            .frame(width: 34, height: 34)
                                            .glassEffect(.regular.tint(accentColor.opacity(0.03)).interactive(), in: RoundedRectangle(cornerRadius: 12))
                                    }
                                }
                            }
                            .padding(.bottom, 10)

                            // Title + Day counter row
                            HStack(alignment: .bottom, spacing: 12) {
                                Text(event.name)
                                    .font(.system(size: 30, weight: .black))
                                    .foregroundStyle(.primary)
                                    .tracking(-0.8)
                                    .lineSpacing(2)

                                Spacer()

                                if let dayCounter = detail.dayCounter,
                                   let days = dayCounter.days {
                                    VStack(spacing: 2) {
                                        Text("\(days)")
                                            .font(.system(size: 22, weight: .black, design: .rounded))
                                            .foregroundStyle(.white)
                                        Text("DAYS")
                                            .font(.system(size: 8, weight: .heavy))
                                            .tracking(1.0)
                                            .foregroundStyle(.white.opacity(0.6))
                                    }
                                    .frame(width: 60, height: 52)
                                    .glassEffect(.regular.tint(accentColor.opacity(0.3)).interactive(), in: RoundedRectangle(cornerRadius: 12))
                                }
                            }

                            // Description under the title
                            if let background = detail.background, !background.isEmpty {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text(background)
                                        .font(.system(size: 13))
                                        .foregroundStyle(.primary.opacity(0.65))
                                        .lineSpacing(4)
                                        .lineLimit(backgroundExpanded ? nil : 2)

                                    Button {
                                        withAnimation(.easeInOut(duration: 0.25)) {
                                            backgroundExpanded.toggle()
                                            HapticManager.light()
                                        }
                                    } label: {
                                        HStack(spacing: 4) {
                                            Text(backgroundExpanded ? "Show less" : "Continue reading")
                                                .font(.system(size: 12, weight: .bold))
                                            Image(systemName: "chevron.down")
                                                .font(.system(size: 9, weight: .bold))
                                                .rotationEffect(backgroundExpanded ? .degrees(180) : .zero)
                                        }
                                        .foregroundStyle(accentColor)
                                    }
                                    .buttonStyle(.plain)
                                    .padding(.top, 6)
                                }
                                .padding(backgroundExpanded ? 12 : 0)
                                .background(
                                    backgroundExpanded
                                        ? AnyShapeStyle(pageBg.opacity(0.85))
                                        : AnyShapeStyle(.clear)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .padding(.top, 8)
                            }
                        } else {
                            // Show title even before detail loads
                            Text(event.name)
                                .font(.system(size: 30, weight: .black))
                                .foregroundStyle(.primary)
                                .tracking(-0.8)
                                .lineSpacing(2)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
            }
            .frame(height: 440) // FIXED — photo never moves

            // Expandable history timeline — glass box that opens inline
            if showHistoryTimeline, let entries = viewModel.eventDetail?.timeline, !entries.isEmpty {
                historyTimelineBox(entries: entries)
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Inline History Timeline (glass box)

    private func historyTimelineBox(entries: [EventTimelineEntry]) -> some View {
        // Filter out last 7 days (those are in "This Week"), sort oldest → newest
        let formatter = DateFormatter()
        let _ = formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        let sevenDaysAgo = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -7, to: Date()) ?? Date())
        let historical = entries.filter { entry in
            guard let dateStr = entry.date,
                  let date = formatter.date(from: dateStr) else { return true }
            return date < sevenDaysAgo
        }
        let sorted = historical.sorted { ($0.date ?? "") < ($1.date ?? "") }

        return Group {
            if sorted.isEmpty {
                EmptyView()
            } else {
                timelineGlassContent(sorted: sorted)
            }
        }
    }

    private func timelineGlassContent(sorted: [EventTimelineEntry]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("HISTORICAL TIMELINE")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1.0)
                    .foregroundStyle(.primary.opacity(0.35))

                Spacer()

                Button {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showHistoryTimeline = false
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.primary.opacity(0.3))
                        .frame(width: 22, height: 22)
                        .background(.black.opacity(0.06))
                        .clipShape(Circle())
                }
            }
            .padding(.bottom, 14)

            // Timeline entries: oldest → newest
            ForEach(Array(sorted.enumerated()), id: \.offset) { idx, entry in
                let isLast = idx == sorted.count - 1

                HStack(alignment: .top, spacing: 12) {
                    // Timeline rail
                    VStack(spacing: 0) {
                        Circle()
                            .fill(Color.primary.opacity(0.25))
                            .frame(width: 5, height: 5)
                            .frame(width: 16, height: 16)

                        if !isLast {
                            Rectangle()
                                .fill(Color.primary.opacity(0.06))
                                .frame(width: 1)
                                .frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 16)

                    VStack(alignment: .leading, spacing: 3) {
                        if let date = entry.date {
                            Text(formatTimelineDate(date))
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.primary.opacity(0.25))
                        }

                        Text(stripMarkdownBold(entry.headline ?? entry.summary ?? ""))
                            .font(.system(size: 12))
                            .foregroundStyle(.primary)
                            .lineSpacing(3)
                    }
                    .padding(.bottom, 10)
                }
            }
        }
        .padding(16)
        .glassEffect(.regular.tint(accentColor.opacity(0.03)).interactive(), in: RoundedRectangle(cornerRadius: 16))
    }

    private func stripMarkdownBold(_ text: String) -> String {
        text.replacingOccurrences(of: "**", with: "")
    }

    private func formatTimelineDate(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateStr) else { return dateStr }
        let display = DateFormatter()
        display.dateFormat = "MMM d"
        return display.string(from: date)
    }

    @State private var liveUpdatesExpanded = false

    // MARK: - Content Sections

    @ViewBuilder
    private func contentSections(_ detail: WorldEventFull) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Live Updates
            if let updates = detail.liveUpdates, !updates.isEmpty {
                sectionHeader(
                    icon: "antenna.radiowaves.left.and.right", iconColor: Color(hex: "#FF3B30"),
                    bgColor: Color(hex: "#FF3B30").opacity(0.1), label: "LIVE UPDATES"
                )
                .padding(.top, 28)
                .scrollReveal()

                liveUpdatesSection(updates)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .scrollReveal()
            }

            // Latest Development
            if let development = detail.latestDevelopment {
                sectionHeader(
                    icon: "bolt.fill", iconColor: Color(hex: "#FF3B30"),
                    bgColor: Color(hex: "#FF3B30").opacity(0.1), label: "LATEST DEVELOPMENT"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventLatestDevelopmentView(
                    development: development,
                    accentColor: accentColor
                )
                .padding(.horizontal, 20)
                .padding(.top, 14)
                .scrollReveal()
            }

            // What to Watch
            if let items = detail.components?.whatToWatch, !items.isEmpty {
                sectionHeader(
                    icon: "eye.fill", iconColor: Color(hex: "#FF9500"),
                    bgColor: Color(hex: "#FF9500").opacity(0.1), label: "WHAT TO WATCH"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventWhatToWatchView(items: items, accentColor: accentColor)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .scrollReveal()
            }

            // Perspectives
            if let perspectives = detail.components?.perspectives, !perspectives.isEmpty {
                sectionHeader(
                    icon: "brain.head.profile.fill", iconColor: Color(hex: "#5AC8FA"),
                    bgColor: Color(hex: "#5AC8FA").opacity(0.1), label: "PERSPECTIVES"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventPerspectivesView(perspectives: perspectives, accentColor: accentColor)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .scrollReveal()
            }

            // Geographic Impact
            if let geoData = detail.components?.geographicImpact {
                sectionHeader(
                    icon: "map.fill", iconColor: Color(hex: "#34C759"),
                    bgColor: Color(hex: "#34C759").opacity(0.1), label: "GEOGRAPHIC IMPACT"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventGlobalImpactView(
                    geoData: geoData,
                    perspectives: [],
                    accentColor: accentColor
                )
                .padding(.horizontal, 20)
                .padding(.top, 14)
                .scrollReveal()
            }

            // Data Analytics
            if let analytics = detail.components?.dataAnalytics,
               let charts = analytics.charts, !charts.isEmpty {
                sectionHeader(
                    icon: "chart.bar.fill", iconColor: Color(hex: "#AF52DE"),
                    bgColor: Color(hex: "#AF52DE").opacity(0.1), label: "DATA & ANALYTICS"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventDataAnalyticsView(data: analytics, accentColor: accentColor)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .scrollReveal()
            }

            // This Week Timeline
            if let timeline = detail.timeline, !timeline.isEmpty {
                sectionHeader(
                    icon: "clock.fill", iconColor: Color(hex: "#007AFF"),
                    bgColor: Color(hex: "#007AFF").opacity(0.1), label: "THIS WEEK"
                )
                .padding(.top, 28)
                .scrollReveal()

                EventTimelineView(entries: timeline, accentColor: accentColor)
                    .padding(.horizontal, 20)
                    .padding(.top, 14)
                    .scrollReveal()
            }
        }
        .padding(.bottom, 80)
    }

    // MARK: - Live Updates

    private func liveUpdatesSection(_ updates: [LiveUpdate]) -> some View {
        let visibleUpdates = liveUpdatesExpanded ? updates : Array(updates.prefix(5))

        return VStack(alignment: .leading, spacing: 0) {
            // Red accent bar at left
            ForEach(Array(visibleUpdates.enumerated()), id: \.offset) { index, update in
                HStack(alignment: .top, spacing: 12) {
                    // Left red bar
                    Rectangle()
                        .fill(Color(hex: "#FF3B30").gradient)
                        .frame(width: 3)
                        .clipShape(RoundedRectangle(cornerRadius: 2))

                    VStack(alignment: .leading, spacing: 4) {
                        if let timestamp = update.timestamp, !timestamp.isEmpty {
                            Text(timestamp)
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.primary.opacity(0.3))
                        }

                        if let content = update.content, !content.isEmpty {
                            Text(content)
                                .font(.system(size: 14))
                                .foregroundStyle(.primary.opacity(0.8))
                                .lineSpacing(4)
                        }

                        if let source = update.source, !source.isEmpty {
                            Text(source)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.primary.opacity(0.25))
                        }
                    }
                }
                .padding(.vertical, 12)

                if index < visibleUpdates.count - 1 {
                    Divider()
                        .padding(.leading, 15)
                }
            }

            // Show all / Show less
            if updates.count > 5 {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        liveUpdatesExpanded.toggle()
                    }
                    HapticManager.light()
                } label: {
                    HStack(spacing: 4) {
                        Text(liveUpdatesExpanded ? "Show less" : "Show all \(updates.count) updates")
                            .font(.system(size: 12, weight: .bold))
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .bold))
                            .rotationEffect(liveUpdatesExpanded ? .degrees(180) : .zero)
                    }
                    .foregroundStyle(accentColor)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 12)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.black.opacity(0.06), lineWidth: 0.5))
    }

    // MARK: - Section Header (icon in tinted box + uppercase label)

    private func sectionHeader(icon: String, iconColor: Color, bgColor: Color, label: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(iconColor)
                .frame(width: 26, height: 26)
                .background(bgColor)
                .clipShape(RoundedRectangle(cornerRadius: 7))

            Text(label)
                .font(.system(size: 11, weight: .heavy))
                .tracking(1.0)
                .foregroundStyle(.primary.opacity(0.55))
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Loading & Error

    private var loadingContent: some View {
        VStack(spacing: 16) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 16)
                    .fill(.white)
                    .frame(height: 100)
                    .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
                    .shimmer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }

    private func errorContent(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(.orange)
            Text("Something went wrong")
                .font(.system(size: 17, weight: .semibold))
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.loadEvent(slug: event.slug) }
            } label: {
                Text("Try Again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(accentColor)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}

// MARK: - History Bottom Sheet

struct EventHistorySheetView: View {
    let historicalData: HistoricalComparisonData?
    let timelineEntries: [EventTimelineEntry]?
    var accentColor: Color = Color(hex: "#0A84FF")

    @State private var expandedIndex: Int? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Timeline entries
                    if let entries = timelineEntries, !entries.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("EVENT TIMELINE")
                                .font(.system(size: 10, weight: .heavy))
                                .tracking(1.0)
                                .foregroundStyle(.primary.opacity(0.3))
                                .padding(.bottom, 14)

                            ForEach(Array(entries.reversed().enumerated()), id: \.offset) { idx, entry in
                                let isFirst = idx == 0
                                let isLast = idx == entries.count - 1

                                HStack(alignment: .top, spacing: 14) {
                                    // Timeline rail
                                    VStack(spacing: 0) {
                                        Circle()
                                            .fill(isFirst ? accentColor : Color.primary.opacity(0.18))
                                            .frame(width: isFirst ? 10 : 6, height: isFirst ? 10 : 6)
                                            .frame(width: 22, height: 22)

                                        if !isLast {
                                            Rectangle()
                                                .fill(.primary.opacity(0.08))
                                                .frame(width: 1.5)
                                                .frame(maxHeight: .infinity)
                                        }
                                    }
                                    .frame(width: 22)

                                    VStack(alignment: .leading, spacing: 4) {
                                        if let date = entry.date {
                                            Text(date)
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(.primary.opacity(0.3))
                                        }
                                        if let headline = entry.headline {
                                            Text(headline)
                                                .font(.system(size: 14, weight: isFirst ? .semibold : .regular))
                                                .foregroundStyle(.primary.opacity(isFirst ? 0.85 : 0.55))
                                                .lineSpacing(4)
                                        }
                                        if let summary = entry.summary, entry.headline == nil {
                                            Text(summary)
                                                .font(.system(size: 14))
                                                .foregroundStyle(.primary.opacity(0.55))
                                                .lineSpacing(4)
                                        }
                                    }
                                    .padding(.bottom, 14)
                                }
                            }
                        }
                        .padding(16)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
                    }

                    // Historical comparisons
                    if let data = historicalData {
                        if let comparisons = data.comparisons, !comparisons.isEmpty {
                            Text("HISTORICAL PARALLELS")
                                .font(.system(size: 10, weight: .heavy))
                                .tracking(1.0)
                                .foregroundStyle(.primary.opacity(0.3))
                                .padding(.top, 4)

                            ForEach(Array(comparisons.enumerated()), id: \.offset) { index, comp in
                                comparisonCard(comp, index: index)
                            }
                        }

                        if let insight = data.timelineInsight, !insight.isEmpty {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "lightbulb.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(hex: "#FFCC00"))
                                    .padding(.top, 2)
                                Text(insight)
                                    .font(.system(size: 12))
                                    .foregroundStyle(.primary.opacity(0.55))
                                    .lineSpacing(4)
                                    .italic()
                            }
                            .padding(14)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(Color(hex: "#F2F2F7"))
            .navigationTitle("Historical Timeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.primary.opacity(0.3))
                            .frame(width: 28, height: 28)
                            .background(.black.opacity(0.06))
                            .clipShape(Circle())
                    }
                }
            }
        }
    }

    private func comparisonCard(_ comp: HistoricalComparison, index: Int) -> some View {
        let isExpanded = expandedIndex == index

        return Button {
            withAnimation(.easeInOut(duration: 0.25)) {
                expandedIndex = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let years = comp.years {
                            Text(years)
                                .font(.system(size: 22, weight: .black, design: .rounded))
                                .foregroundStyle(accentColor)
                        }
                        if let name = comp.eventName {
                            Text(name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.primary)
                                .lineSpacing(2)
                        }
                    }
                    Spacer()

                    if let months = comp.durationMonths {
                        let monthsInt = Int(months.value)
                        VStack(spacing: 1) {
                            Text("\(monthsInt)")
                                .font(.system(size: 17, weight: .black, design: .rounded))
                                .foregroundStyle(accentColor)
                            Text(monthsInt == 1 ? "month" : "months")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(.primary.opacity(0.3))
                                .tracking(0.3)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(accentColor.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }

                if let summary = comp.summary {
                    Text(summary)
                        .font(.system(size: 13))
                        .foregroundStyle(.primary.opacity(0.55))
                        .lineSpacing(4)
                        .lineLimit(isExpanded ? nil : 2)
                        .padding(.top, 10)
                }

                if isExpanded {
                    VStack(alignment: .leading, spacing: 10) {
                        if let resolution = comp.resolution, !resolution.isEmpty {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(hex: "#34C759"))
                                    .padding(.top, 1)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Resolution")
                                        .font(.system(size: 10, weight: .heavy))
                                        .foregroundStyle(Color(hex: "#34C759"))
                                    Text(resolution)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.primary.opacity(0.55))
                                        .lineSpacing(4)
                                }
                            }
                        }

                        if let lessons = comp.keyLessons, !lessons.isEmpty {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(hex: "#FFCC00"))
                                    .padding(.top, 1)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Key Lesson")
                                        .font(.system(size: 10, weight: .heavy))
                                        .foregroundStyle(Color(hex: "#FFCC00"))
                                    Text(lessons)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.primary.opacity(0.55))
                                        .lineSpacing(4)
                                }
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
                        .foregroundStyle(.primary.opacity(0.18))
                        .rotationEffect(isExpanded ? .degrees(180) : .zero)
                }
                .padding(.top, 6)
            }
            .padding(16)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        EventDetailView(event: PreviewData.sampleEvent)
    }
}
