import SwiftUI

struct SavedArticlesView: View {
    @Environment(TabBarState.self) private var tabBarState
    @Environment(FeedViewModel.self) private var feedViewModel
    private var bookmarks: BookmarkManager { BookmarkManager.shared }
    private var history: ReadingHistoryManager { ReadingHistoryManager.shared }

    @State private var selectedTab: SavedTab = .saved
    @State private var selectedArticle: Article?
    @Namespace private var toggleNS

    enum SavedTab: String, CaseIterable {
        case saved = "Saved"
        case history = "History"
    }

    // MARK: - Filtered Data

    private var filteredArticles: [Article] {
        bookmarks.savedArticles
    }

    private var filteredHistory: [ReadingHistoryManager.HistoryEntry] {
        history.entries
    }

    private var groupedHistory: [DateGroup] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        var groups: [String: [ReadingHistoryManager.HistoryEntry]] = [:]
        var order: [String] = []

        for entry in filteredHistory {
            let key: String
            if calendar.isDateInToday(entry.viewedAt) {
                key = "Today"
            } else if calendar.isDateInYesterday(entry.viewedAt) {
                key = "Yesterday"
            } else {
                formatter.dateFormat = "EEEE, MMM d"
                key = formatter.string(from: entry.viewedAt)
            }
            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(entry)
        }

        return order.compactMap { key in
            guard let entries = groups[key] else { return nil }
            return DateGroup(date: key, entries: entries)
        }
    }

    private struct DateGroup {
        let date: String
        let entries: [ReadingHistoryManager.HistoryEntry]
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            NavigationStack {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Glass toggle
                        glassToggle
                            .padding(.horizontal, 16)
                            .padding(.top, 8)
                            .padding(.bottom, 12)

                        // Content
                        switch selectedTab {
                        case .saved:
                            if filteredArticles.isEmpty {
                                savedEmptyState
                            } else {
                                savedList
                            }
                        case .history:
                            if filteredHistory.isEmpty {
                                historyEmptyState
                            } else {
                                historyList
                            }
                        }
                    }
                    .padding(.bottom, 100)
                }
                .navigationTitle(selectedTab == .saved ? "Saved" : "History")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    if selectedTab == .history && !history.entries.isEmpty {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Clear") {
                                withAnimation {
                                    history.clearHistory()
                                }
                                HapticManager.light()
                            }
                            .foregroundStyle(.red)
                        }
                    }
                }
                .background(Theme.Colors.backgroundPrimary)
            }

            // Article sheet overlay — opens tapped article then continues with feed
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    allArticles: feedContinuationArticles,
                    onDismiss: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                            selectedArticle = nil
                        }
                    },
                    preserveOrder: true
                )
                .transition(.move(edge: .bottom))
                .ignoresSafeArea()
                .zIndex(1)
            }
        }
    }

    // MARK: - Glass Toggle

    private var glassToggle: some View {
        GlassEffectContainer {
            HStack(spacing: 0) {
                ForEach(SavedTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.smooth(duration: 0.3)) {
                            selectedTab = tab
                        }
                        HapticManager.selection()
                    } label: {
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: selectedTab == tab ? .bold : .medium))
                            .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 36)
                            .background {
                                if selectedTab == tab {
                                    Capsule()
                                        .fill(.fill.tertiary)
                                        .matchedGeometryEffect(id: "toggle", in: toggleNS)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(4)
            .glassEffect(.regular, in: Capsule())
        }
    }

    // MARK: - Saved Articles List

    private var savedList: some View {
        LazyVStack(spacing: 0) {
            ForEach(filteredArticles) { article in
                Button {
                    openArticle(article)
                } label: {
                    articleRow(article)
                }
                .buttonStyle(.plain)
                if article.id != filteredArticles.last?.id {
                    Divider().padding(.leading, 88)
                }
            }
        }
    }

    private func articleRow(_ article: Article) -> some View {
        HStack(spacing: 14) {
            if let imageUrl = article.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 70, height: 70)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                RoundedRectangle(cornerRadius: 10)
                    .fill(.fill.tertiary)
                    .frame(width: 70, height: 70)
                    .overlay {
                        Image(systemName: "newspaper")
                            .font(.system(size: 20))
                            .foregroundStyle(.quaternary)
                    }
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(article.plainTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(2)

                HStack(spacing: 6) {
                    if let source = article.source {
                        Text(source)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    if let category = article.category {
                        Text(category)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }

            Spacer(minLength: 0)

            Button {
                withAnimation {
                    bookmarks.toggle(article)
                }
                HapticManager.light()
            } label: {
                Image(systemName: "bookmark.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(.orange)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - History List

    private var historyList: some View {
        LazyVStack(spacing: 0) {
            ForEach(groupedHistory, id: \.date) { group in
                Section {
                    ForEach(group.entries) { entry in
                        Button {
                            openHistoryEntry(entry)
                        } label: {
                            historyRow(entry)
                        }
                        .buttonStyle(.plain)
                        if entry.id != group.entries.last?.id {
                            Divider().padding(.leading, 88)
                        }
                    }
                } header: {
                    HStack {
                        Text(group.date)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 8)
                }
            }
        }
    }

    private func historyRow(_ entry: ReadingHistoryManager.HistoryEntry) -> some View {
        HStack(spacing: 14) {
            if let imageUrl = entry.imageUrl, let url = URL(string: imageUrl) {
                AsyncCachedImage(url: url, contentMode: .fill)
                    .frame(width: 70, height: 70)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                RoundedRectangle(cornerRadius: 10)
                    .fill(.fill.tertiary)
                    .frame(width: 70, height: 70)
                    .overlay {
                        Image(systemName: "newspaper")
                            .font(.system(size: 20))
                            .foregroundStyle(.quaternary)
                    }
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(entry.title)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(2)

                HStack(spacing: 6) {
                    if let source = entry.source {
                        Text(source)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    Text(timeAgoString(from: entry.viewedAt))
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Empty States

    private var savedEmptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bookmark")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("No Saved Articles")
                .font(.system(size: 18, weight: .semibold))
            Text("Tap the bookmark icon on any article to save it for later.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    private var historyEmptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("No Reading History")
                .font(.system(size: 18, weight: .semibold))
            Text("Articles you read will appear here.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    // MARK: - Feed Continuation

    /// Feed articles from the current scroll position onward
    private var feedContinuationArticles: [Article] {
        let feed = feedViewModel.articles
        let idx = min(feedViewModel.currentIndex, feed.count)
        return Array(feed.suffix(from: idx))
    }

    /// Resolve the full article: try feed first, then fetch from API, fallback to what we have
    private func resolveFullArticle(_ article: Article) async -> Article {
        // 1. Try the feed (has full content with bullets/details)
        if let feedArticle = feedViewModel.allArticles.first(where: { $0.id == article.id }),
           !feedArticle.displayBullets.isEmpty {
            return feedArticle
        }
        // 2. Fetch from the correct endpoint (/api/article/{id}), returns Article directly
        if let full: Article = try? await APIClient.shared.get("/api/article/\(article.id.stringValue)") {
            return full
        }
        // 3. Fallback
        return article
    }

    private func openArticle(_ article: Article) {
        HapticManager.selection()
        // Show immediately for smooth slide-up animation
        let feedArticle = feedViewModel.allArticles.first { $0.id == article.id }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
            selectedArticle = feedArticle ?? article
        }
        // Fetch full content in background if needed
        if (feedArticle ?? article).displayBullets.isEmpty {
            Task {
                if let full: Article = try? await APIClient.shared.get("/api/article/\(article.id.stringValue)") {
                    selectedArticle = full
                }
            }
        }
    }

    private func openHistoryEntry(_ entry: ReadingHistoryManager.HistoryEntry) {
        HapticManager.selection()
        let entryId = FlexibleID(entry.articleId)
        // Show immediately for smooth slide-up animation
        if let feedArticle = feedViewModel.allArticles.first(where: { $0.id == entryId }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                selectedArticle = feedArticle
            }
            // Fetch full content in background if bullets missing
            if feedArticle.displayBullets.isEmpty {
                Task {
                    if let full: Article = try? await APIClient.shared.get("/api/article/\(entry.articleId)") {
                        selectedArticle = full
                    }
                }
            }
        } else {
            // Not in feed — show minimal immediately, fetch full in background
            let minArticle = articleFromHistoryEntry(entry)
            withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                selectedArticle = minArticle
            }
            Task {
                if let full: Article = try? await APIClient.shared.get("/api/article/\(entry.articleId)") {
                    selectedArticle = full
                }
            }
        }
    }

    // MARK: - History → Article Conversion

    private var historyArticles: [Article] {
        history.entries.compactMap { articleFromHistoryEntry($0) }
    }

    private func articleFromHistoryEntry(_ entry: ReadingHistoryManager.HistoryEntry) -> Article? {
        var dict: [String: Any] = [
            "id": entry.articleId,
            "title": entry.title
        ]
        if let source = entry.source { dict["source"] = source }
        if let category = entry.category { dict["category"] = category }
        if let topics = entry.topics { dict["topics"] = topics }
        if let countries = entry.countries { dict["countries"] = countries }
        if let imageUrl = entry.imageUrl { dict["image_url"] = imageUrl }

        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(Article.self, from: data)
    }

    // MARK: - Helpers

    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "Just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

#Preview {
    SavedArticlesView()
}
