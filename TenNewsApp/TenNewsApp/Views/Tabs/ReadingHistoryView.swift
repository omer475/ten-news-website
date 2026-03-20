import SwiftUI

struct ReadingHistoryView: View {
    private var history: ReadingHistoryManager { ReadingHistoryManager.shared }
    @Environment(FeedViewModel.self) private var feedViewModel
    @State private var selectedArticle: Article?

    var body: some View {
        ZStack {
            Group {
                if history.entries.isEmpty {
                    emptyState
                } else {
                    historyList
                }
            }
            .navigationTitle("Reading History")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if !history.entries.isEmpty {
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

    private var historyList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(groupedEntries, id: \.date) { group in
                    Section {
                        ForEach(group.entries) { entry in
                            Button {
                                openHistoryEntry(entry)
                            } label: {
                                entryRow(entry)
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
            .padding(.bottom, 100)
        }
    }

    private struct DateGroup {
        let date: String
        let entries: [ReadingHistoryManager.HistoryEntry]
    }

    private var groupedEntries: [DateGroup] {
        let calendar = Calendar.current
        let formatter = DateFormatter()

        var groups: [String: [ReadingHistoryManager.HistoryEntry]] = [:]
        var order: [String] = []

        for entry in history.entries {
            if calendar.isDateInToday(entry.viewedAt) {
                let key = "Today"
                if groups[key] == nil { order.append(key) }
                groups[key, default: []].append(entry)
            } else if calendar.isDateInYesterday(entry.viewedAt) {
                let key = "Yesterday"
                if groups[key] == nil { order.append(key) }
                groups[key, default: []].append(entry)
            } else {
                formatter.dateFormat = "EEEE, MMM d"
                let key = formatter.string(from: entry.viewedAt)
                if groups[key] == nil { order.append(key) }
                groups[key, default: []].append(entry)
            }
        }

        return order.compactMap { key in
            guard let entries = groups[key] else { return nil }
            return DateGroup(date: key, entries: entries)
        }
    }

    private func entryRow(_ entry: ReadingHistoryManager.HistoryEntry) -> some View {
        HStack(spacing: 14) {
            // Thumbnail
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

    // MARK: - Feed Continuation

    private var feedContinuationArticles: [Article] {
        let feed = feedViewModel.articles
        let idx = min(feedViewModel.currentIndex, feed.count)
        return Array(feed.suffix(from: idx))
    }

    private func resolveFullArticle(_ article: Article) async -> Article {
        if let feedArticle = feedViewModel.allArticles.first(where: { $0.id == article.id }),
           !feedArticle.displayBullets.isEmpty {
            return feedArticle
        }
        if let full: Article = try? await APIClient.shared.get("/api/article/\(article.id.stringValue)") {
            return full
        }
        return article
    }

    private func openArticle(_ article: Article) {
        HapticManager.selection()
        let feedArticle = feedViewModel.allArticles.first { $0.id == article.id }
        withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
            selectedArticle = feedArticle ?? article
        }
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
        if let feedArticle = feedViewModel.allArticles.first(where: { $0.id == entryId }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                selectedArticle = feedArticle
            }
            if feedArticle.displayBullets.isEmpty {
                Task {
                    if let full: Article = try? await APIClient.shared.get("/api/article/\(entry.articleId)") {
                        selectedArticle = full
                    }
                }
            }
        } else {
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

    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "Just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }

    private var emptyState: some View {
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    NavigationStack {
        ReadingHistoryView()
    }
}
