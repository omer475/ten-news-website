import SwiftUI

struct AccountTabView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(FeedViewModel.self) private var feedViewModel
    @State private var appeared = false
    @State private var showSignUp = false
    @State private var showSignIn = false
    @State private var showForgotPassword = false
    @State private var showCreateContent = false
    @State private var selectedTab: ProfileTab = .liked
    @State private var selectedArticle: Article?
    @Namespace private var toggleNS

    @State private var publishedArticles: [Article] = []
    @State private var isLoadingPublished = false
    @State private var profileImage: UIImage? = ProfilePhotoManager.shared.load()
    @State private var selectedDefaultAvatar: Int? = ProfilePhotoManager.shared.selectedDefaultAvatar()
    @State private var showAvatarPicker = false

    private var user: AuthUser? { appViewModel.currentUser }
    private var bookmarks: BookmarkManager { BookmarkManager.shared }
    private var likes: LikeManager { LikeManager.shared }
    private var history: ReadingHistoryManager { ReadingHistoryManager.shared }

    enum ProfileTab: String, CaseIterable {
        case liked = "Liked"
        case saved = "Saved"
        case history = "History"
        case published = "Published"
    }

    var body: some View {
        ZStack {
            NavigationStack {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        profileHeader
                            .padding(.top, 12)

                        statsRow
                            .padding(.top, 16)

                        actionButtonsRow
                            .padding(.top, 16)
                            .padding(.horizontal, 20)

                        // Toggle bar
                        glassToggle
                            .padding(.horizontal, 20)
                            .padding(.top, 20)
                            .padding(.bottom, 12)

                        // Content
                        tabContent

                        Spacer().frame(height: 100)
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)
                }
                .navigationTitle(user?.displayName ?? "Guest")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink {
                            SettingsView(
                                preferences: appViewModel.preferences,
                                onSave: { appViewModel.updatePreferences($0) },
                                onSignOut: { appViewModel.logout() }
                            )
                        } label: {
                            Image(systemName: "line.3.horizontal")
                                .font(.system(size: 20, weight: .medium))
                        }
                    }
                }
                .background(Theme.Colors.backgroundPrimary)
            }
            .sheet(isPresented: $showSignUp) {
                NavigationStack {
                    SignupView(
                        onSignup: { user, session in
                            appViewModel.login(user: user, session: session)
                            appViewModel.completeOnboarding(with: appViewModel.preferences)
                            showSignUp = false
                        },
                        onShowLogin: {
                            showSignUp = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                showSignIn = true
                            }
                        }
                    )
                    .navigationTitle("Create Account")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showSignUp = false }
                        }
                    }
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(28)
            }
            .sheet(isPresented: $showSignIn) {
                NavigationStack {
                    LoginView(
                        onLogin: { user, session in
                            appViewModel.login(user: user, session: session)
                            showSignIn = false
                        },
                        onShowSignup: {
                            showSignIn = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                showSignUp = true
                            }
                        },
                        onShowForgotPassword: {
                            showSignIn = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                showForgotPassword = true
                            }
                        }
                    )
                    .navigationTitle("Sign In")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showSignIn = false }
                        }
                    }
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(28)
            }
            .sheet(isPresented: $showForgotPassword) {
                NavigationStack {
                    ForgotPasswordView(onPasswordReset: { user, session in
                            appViewModel.login(user: user, session: session)
                            showForgotPassword = false
                        })
                        .navigationTitle("Reset Password")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Cancel") { showForgotPassword = false }
                            }
                        }
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(28)
            }

            // Article sheet overlay
            if let article = selectedArticle {
                ExploreArticleSheet(
                    selectedArticle: article,
                    contentKey: article.contentKey,
                    allArticles: feedContinuationArticles,
                    onDismiss: {
                        selectedArticle = nil
                    },
                    preserveOrder: true
                )
                .ignoresSafeArea()
                .zIndex(1)
            }

        }
        .onAppear {
            withAnimation(.smooth(duration: 0.5)) {
                appeared = true
            }
        }
        .onChange(of: selectedTab) { _, newTab in
            if newTab == .published && publishedArticles.isEmpty {
                loadPublished()
            }
        }
        .fullScreenCover(isPresented: $showCreateContent) {
            CreateContentView()
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 10) {
            Button {
                showAvatarPicker = true
                HapticManager.light()
            } label: {
                ZStack(alignment: .bottomTrailing) {
                    if let profileImage {
                        Image(uiImage: profileImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 86, height: 86)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.separator, lineWidth: 0.5))
                    } else if let avatarIndex = selectedDefaultAvatar {
                        Image("avatar_\(avatarIndex)")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 86, height: 86)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.separator, lineWidth: 0.5))
                    } else if let avatarUrl = user?.displayAvatar {
                        AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                            .frame(width: 86, height: 86)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.separator, lineWidth: 0.5))
                    } else {
                        profileInitialAvatar(size: 86)
                    }

                    // Camera badge
                    Image(systemName: "camera.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Color.accentColor, in: Circle())
                        .overlay(Circle().stroke(Color(.systemBackground), lineWidth: 2))
                }
            }
            .buttonStyle(.plain)
            .sheet(isPresented: $showAvatarPicker) {
                ProfileAvatarPickerView(
                    userName: user?.displayName ?? "U",
                    onSelectDefault: { index in
                        ProfilePhotoManager.shared.saveDefaultAvatar(index)
                        selectedDefaultAvatar = index
                        profileImage = nil
                        showAvatarPicker = false
                    },
                    onSelectPhoto: { image in
                        ProfilePhotoManager.shared.save(image)
                        profileImage = image
                        selectedDefaultAvatar = nil
                        showAvatarPicker = false
                    },
                    onResetToInitial: {
                        ProfilePhotoManager.shared.resetToDefault()
                        profileImage = nil
                        selectedDefaultAvatar = nil
                        showAvatarPicker = false
                    },
                    onDismiss: {
                        showAvatarPicker = false
                    }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(28)
            }

            VStack(spacing: 4) {
                Text(user?.displayName ?? "Guest")
                    .font(.system(size: 16, weight: .semibold))

                if appViewModel.isGuest {
                    Text("Browsing as Guest")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func profileInitialAvatar(size: CGFloat) -> some View {
        let name = user?.displayName ?? "U"
        let initial = String(name.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
        let colors: [Color] = [.blue, .purple, .pink, .orange, .teal, .indigo, .mint, .cyan]
        let colorIndex = abs(name.hashValue) % colors.count
        return ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [colors[colorIndex], colors[colorIndex].opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(initial.isEmpty ? "?" : initial)
                .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(value: "0", label: "Followers")
            statItem(value: "0", label: "Following")
            statItem(value: "\(history.readCount)", label: "Read")
        }
        .padding(.horizontal, 20)
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Action Buttons

    private var actionButtonsRow: some View {
        HStack(spacing: 8) {
            if appViewModel.isGuest {
                Button {
                    showSignUp = true
                    HapticManager.light()
                } label: {
                    Text("Create Account")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(AccountButtonStyle())
            } else {
                ShareLink(
                    item: URL(string: "https://tennews.ai")!,
                    subject: Text("Today+ News"),
                    message: Text("Check out Today+ — AI-powered news briefing")
                ) {
                    Text("Share Profile")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 34)
                        .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(AccountButtonStyle())
            }

            Button {
                showCreateContent = true
                HapticManager.light()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold))
                    Text("Create")
                        .font(.system(size: 14, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(AccountButtonStyle())
        }
    }

    // MARK: - Glass Toggle

    private var glassToggle: some View {
        GlassEffectContainer {
            HStack(spacing: 0) {
                ForEach(ProfileTab.allCases, id: \.self) { tab in
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
                                        .matchedGeometryEffect(id: "profileToggle", in: toggleNS)
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

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .liked:
            if likes.likedArticles.isEmpty {
                emptyState(icon: "heart", title: "No Liked Articles",
                           subtitle: "Double-tap or tap the heart on any article to like it.")
            } else {
                articleCardGrid(likes.likedArticles)
            }
        case .saved:
            if bookmarks.savedArticles.isEmpty {
                emptyState(icon: "bookmark", title: "No Saved Articles",
                           subtitle: "Tap the bookmark icon on any article to save it for later.")
            } else {
                articleCardGrid(bookmarks.savedArticles)
            }
        case .history:
            if history.entries.isEmpty {
                emptyState(icon: "clock", title: "No Reading History",
                           subtitle: "Articles you read will appear here.")
            } else {
                historyList
            }
        case .published:
            if isLoadingPublished {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
            } else if publishedArticles.isEmpty {
                emptyState(icon: "square.and.pencil", title: "No Published Content",
                           subtitle: "Tap + Create to publish your first article.")
            } else {
                articleCardGrid(publishedArticles)
            }
        }
    }

    // MARK: - Article Card Grid (search-style)

    private func articleCardGrid(_ articles: [Article]) -> some View {
        let screenW = UIScreen.main.bounds.width
        let hPad: CGFloat = 16
        let fullW = screenW - hPad * 2

        return LazyVStack(spacing: 8) {
            ForEach(articles) { article in
                Button { openArticle(article) } label: {
                    SearchResultCard(
                        article: article.toSearchArticle(),
                        fallbackColor: categoryColor(for: article.category ?? ""),
                        cardWidth: fullW,
                        cardHeight: fullW * 0.65,
                        hideCategory: true
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, hPad)
    }

    private func categoryColor(for category: String) -> Color {
        CategoryColors.color(for: category)
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
                entry.title.coloredTitle(
                    size: 15,
                    weight: .semibold,
                    baseColor: .primary,
                    highlightColor: categoryAccent(for: entry.category)
                )
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

    // MARK: - Empty State

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text(title)
                .font(.system(size: 18, weight: .semibold))
            Text(subtitle)
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    // MARK: - History Grouping

    private struct DateGroup {
        let date: String
        let entries: [ReadingHistoryManager.HistoryEntry]
    }

    private var groupedHistory: [DateGroup] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        var groups: [String: [ReadingHistoryManager.HistoryEntry]] = [:]
        var order: [String] = []

        for entry in history.entries {
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

    // MARK: - Article Opening

    private var feedContinuationArticles: [Article] {
        let feed = feedViewModel.articles
        let idx = min(feedViewModel.currentIndex, feed.count)
        return Array(feed.suffix(from: idx))
    }

    private func loadPublished() {
        guard let uid = appViewModel.currentUser?.id else { return }
        isLoadingPublished = true
        Task {
            do {
                struct PublishedResponse: Codable {
                    let articles: [Article]
                }
                let response: PublishedResponse = try await APIClient.shared.get(
                    "/api/content/published?user_id=\(uid)"
                )
                publishedArticles = response.articles
            } catch {
                print("Load published error: \(error)")
            }
            isLoadingPublished = false
        }
    }

    private func openArticle(_ article: Article) {
        HapticManager.selection()
        let feedArticle = feedViewModel.allArticles.first { $0.id == article.id }
        selectedArticle = feedArticle ?? article
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
            selectedArticle = feedArticle
            if feedArticle.displayBullets.isEmpty {
                Task {
                    if let full: Article = try? await APIClient.shared.get("/api/article/\(entry.articleId)") {
                        selectedArticle = full
                    }
                }
            }
        } else {
            let minArticle = articleFromHistoryEntry(entry)
            selectedArticle = minArticle
            Task {
                if let full: Article = try? await APIClient.shared.get("/api/article/\(entry.articleId)") {
                    selectedArticle = full
                }
            }
        }
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

    private func categoryAccent(for category: String?) -> Color {
        let colors: [String: String] = [
            "World": "#3366CC", "Politics": "#CC3344", "Business": "#22AA66",
            "Tech": "#7744BB", "Science": "#009999", "Health": "#CC6699",
            "Sports": "#DD6622", "Entertainment": "#CC9922", "Finance": "#228866",
            "Climate": "#339966", "Economy": "#228866",
            "Food": "#E07020", "Fashion": "#BB44AA", "Travel": "#2299BB", "Lifestyle": "#66AA44",
            "Crypto": "#F7931A",
        ]
        guard let category, let hex = colors[category] else { return .accentColor }
        return Color(hex: hex)
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
}

/// Account page button style — press feedback without color override
private struct AccountButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.6 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    AccountTabView()
        .environment(AppViewModel())
        .environment(FeedViewModel())
}
