import SwiftUI

struct AccountTabView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var settingsVM = SettingsViewModel()
    @State private var appeared = false
    @State private var showSignOutConfirm = false
    @State private var showSignUp = false
    @State private var showClearHistoryConfirm = false
    @State private var showClearBookmarksConfirm = false

    private var user: AuthUser? { appViewModel.currentUser }
    private var prefs: UserPreferences { appViewModel.preferences }

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 20) {
                    profileHeader
                        .padding(.top, 20)

                    actionButtons
                        .padding(.horizontal, 20)

                    // Quick links
                    quickLinksSection
                        .padding(.horizontal, 20)

                    // Content Preferences
                    contentPreferencesSection
                        .padding(.horizontal, 20)

                    // Notifications
                    notificationsSection
                        .padding(.horizontal, 20)

                    // Display
                    displaySection
                        .padding(.horizontal, 20)

                    // Data & Storage
                    dataStorageSection
                        .padding(.horizontal, 20)

                    // Support
                    supportSection
                        .padding(.horizontal, 20)

                    // About
                    aboutSection
                        .padding(.horizontal, 20)

                    // Account actions
                    accountSection
                        .padding(.horizontal, 20)

                    Spacer().frame(height: 100)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
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
        .confirmationDialog("Sign Out", isPresented: $showSignOutConfirm) {
            Button("Sign Out", role: .destructive) {
                appViewModel.logout()
            }
        } message: {
            Text("Are you sure you want to sign out? You'll need to set up your preferences again.")
        }
        .confirmationDialog("Clear Reading History", isPresented: $showClearHistoryConfirm) {
            Button("Clear All", role: .destructive) {
                settingsVM.clearReadingHistory()
            }
        } message: {
            Text("This will permanently delete your reading history.")
        }
        .confirmationDialog("Clear Saved Articles", isPresented: $showClearBookmarksConfirm) {
            Button("Clear All", role: .destructive) {
                settingsVM.clearBookmarks()
            }
        } message: {
            Text("This will remove all your saved articles.")
        }
        .onAppear {
            settingsVM.loadFromPreferences(prefs)
            withAnimation(.smooth(duration: 0.5)) {
                appeared = true
            }
        }
        .onChange(of: settingsVM.homeCountry) { _, _ in autoSave() }
        .onChange(of: settingsVM.followedCountries) { _, _ in autoSave() }
        .onChange(of: settingsVM.followedTopics) { _, _ in autoSave() }
    }

    private func autoSave() {
        let saved = settingsVM.save()
        appViewModel.updatePreferences(saved)
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 16) {
            if let avatarUrl = user?.displayAvatar {
                AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                    .frame(width: 80, height: 80)
                    .clipShape(Circle())
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.tertiary)
            }

            VStack(spacing: 5) {
                Text(user?.displayName ?? "News Reader")
                    .font(.system(size: 20, weight: .bold))

                if appViewModel.isGuest {
                    Text("Browsing as Guest")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                } else if let email = user?.email {
                    Text(email)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 5) {
                    Image(systemName: appViewModel.isGuest ? "person.fill" : "checkmark.seal.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(appViewModel.isGuest ? Color.gray : Color.blue)
                    Text(appViewModel.isGuest ? "Guest Reader" : "Ten News Reader")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        ShareLink(
            item: URL(string: "https://tennews.ai")!,
            subject: Text("Today+ News"),
            message: Text("Check out Today+ — AI-powered news briefing")
        ) {
            Text("Share Profile")
                .font(.system(size: 14, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 36)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))
                .contentShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(AccountButtonStyle())
    }

    // MARK: - Quick Links

    private var quickLinksSection: some View {
        VStack(spacing: 0) {
            NavigationLink {
                SavedArticlesView()
            } label: {
                menuRowLabel(icon: "bookmark.fill", label: "Saved Articles", color: .orange)
            }

            Divider().padding(.leading, 52)

            NavigationLink {
                ReadingHistoryView()
            } label: {
                menuRowLabel(icon: "clock.fill", label: "Reading History", color: .purple)
            }
        }
        .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Content Preferences

    private var contentPreferencesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("CONTENT PREFERENCES")

            VStack(spacing: 0) {
                expandableRow(
                    icon: "house.fill",
                    iconColor: .orange,
                    label: "Home Country",
                    value: settingsVM.homeCountryName,
                    isExpanded: settingsVM.homeCountryExpanded
                ) {
                    withAnimation(.spring(response: 0.3)) {
                        settingsVM.homeCountryExpanded.toggle()
                    }
                    HapticManager.light()
                }

                if settingsVM.homeCountryExpanded {
                    Divider().padding(.leading, 52)
                    homeCountryPicker
                }

                Divider().padding(.leading, 52)

                expandableRow(
                    icon: "globe",
                    iconColor: .green,
                    label: "Followed Countries",
                    value: "\(settingsVM.followedCountries.count) selected",
                    isExpanded: settingsVM.followedCountriesExpanded
                ) {
                    withAnimation(.spring(response: 0.3)) {
                        settingsVM.followedCountriesExpanded.toggle()
                    }
                    HapticManager.light()
                }

                if settingsVM.followedCountriesExpanded {
                    Divider().padding(.leading, 52)
                    followedCountriesPicker
                }

                Divider().padding(.leading, 52)

                expandableRow(
                    icon: "number",
                    iconColor: .blue,
                    label: "Followed Topics",
                    value: "\(settingsVM.followedTopics.count) selected",
                    isExpanded: settingsVM.followedTopicsExpanded
                ) {
                    withAnimation(.spring(response: 0.3)) {
                        settingsVM.followedTopicsExpanded.toggle()
                    }
                    HapticManager.light()
                }

                if settingsVM.followedTopicsExpanded {
                    Divider().padding(.leading, 52)
                    followedTopicsPicker
                }
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("NOTIFICATIONS")

            VStack(spacing: 0) {
                toggleRow(icon: "bolt.fill", iconColor: .red, label: "Breaking News",
                    isOn: Binding(
                        get: { settingsVM.breakingNewsAlerts },
                        set: { settingsVM.breakingNewsAlerts = $0; HapticManager.light() }
                    ))

                Divider().padding(.leading, 52)

                toggleRow(icon: "bell.badge.fill", iconColor: .blue, label: "Feed Updates",
                    isOn: Binding(
                        get: { settingsVM.eventUpdateAlerts },
                        set: { settingsVM.eventUpdateAlerts = $0; HapticManager.light() }
                    ))
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Display

    private var displaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("DISPLAY")

            HStack(spacing: 14) {
                Image(systemName: "circle.lefthalf.filled")
                    .font(.system(size: 17))
                    .foregroundStyle(.purple)
                    .frame(width: 28)
                Text("Appearance")
                    .font(.system(size: 16))
                Spacer()
                Picker("", selection: Binding(
                    get: { settingsVM.appearanceMode },
                    set: { settingsVM.appearanceMode = $0; HapticManager.selection() }
                )) {
                    Image(systemName: "moon.fill").tag("dark")
                    Image(systemName: "sun.max.fill").tag("light")
                    Image(systemName: "gearshape").tag("system")
                }
                .pickerStyle(.segmented)
                .frame(width: 150)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Data & Storage

    private var dataStorageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("DATA & STORAGE")

            VStack(spacing: 0) {
                infoActionRow(icon: "clock.fill", iconColor: .purple, label: "Reading History",
                    detail: "\(settingsVM.readingHistoryCount) articles") {
                    showClearHistoryConfirm = true
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                infoActionRow(icon: "bookmark.fill", iconColor: .orange, label: "Saved Articles",
                    detail: "\(settingsVM.bookmarkCount) saved") {
                    showClearBookmarksConfirm = true
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                infoActionRow(icon: "internaldrive.fill", iconColor: .gray, label: "Cache",
                    detail: settingsVM.cacheSize) {
                    settingsVM.clearCache()
                }
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Support

    private var supportSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("SUPPORT")

            VStack(spacing: 0) {
                NavigationLink {
                    FeedbackView()
                } label: {
                    menuRowLabel(icon: "envelope.fill", label: "Send Feedback", color: .blue)
                }

                Divider().padding(.leading, 52)

                NavigationLink {
                    PrivacyPolicyView()
                } label: {
                    menuRowLabel(icon: "hand.raised.fill", label: "Privacy Policy", color: .green)
                }

                Divider().padding(.leading, 52)

                NavigationLink {
                    TermsOfServiceView()
                } label: {
                    menuRowLabel(icon: "doc.text.fill", label: "Terms of Service", color: .teal)
                }
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("ABOUT")

            HStack(spacing: 14) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 17))
                    .foregroundStyle(.secondary)
                    .frame(width: 28)
                Text("Version")
                    .font(.system(size: 16))
                Spacer()
                Text("Today+ v1.0")
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(spacing: 16) {
            if appViewModel.isGuest {
                Button {
                    showSignUp = true
                    HapticManager.light()
                } label: {
                    HStack {
                        Spacer()
                        Text("Create Account")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.blue)
                        Spacer()
                    }
                    .frame(height: 48)
                    .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                    .contentShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(AccountButtonStyle())
            }

            Button {
                showSignOutConfirm = true
                HapticManager.light()
            } label: {
                HStack {
                    Spacer()
                    Text(appViewModel.isGuest ? "Reset & Start Over" : "Sign Out")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.red)
                    Spacer()
                }
                .frame(height: 48)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(AccountButtonStyle())

            Text("Today+ v1.0")
                .font(.system(size: 12))
                .foregroundStyle(.quaternary)
        }
    }

    // MARK: - Inline Pickers

    private var homeCountryPicker: some View {
        VStack(spacing: 0) {
            ForEach(settingsVM.availableCountries) { country in
                Button {
                    settingsVM.setHomeCountry(country.id)
                } label: {
                    HStack(spacing: 12) {
                        Text(country.flag)
                            .font(.title3)
                        Text(country.name)
                            .font(.system(size: 15))
                            .foregroundStyle(.primary)
                        Spacer()
                        if settingsVM.homeCountry == country.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.blue)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(AccountButtonStyle())
            }
        }
        .padding(.vertical, 4)
    }

    private var followedCountriesPicker: some View {
        VStack(spacing: 0) {
            ForEach(settingsVM.availableCountries) { country in
                Button {
                    settingsVM.toggleCountry(country.id)
                } label: {
                    HStack(spacing: 12) {
                        Text(country.flag)
                            .font(.title3)
                        Text(country.name)
                            .font(.system(size: 15))
                            .foregroundStyle(.primary)
                        Spacer()
                        if settingsVM.followedCountries.contains(country.id) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.blue)
                        } else {
                            Image(systemName: "circle")
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(AccountButtonStyle())
            }
        }
        .padding(.vertical, 4)
    }

    private var followedTopicsPicker: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: 8) {
            ForEach(settingsVM.availableTopics) { topic in
                let selected = settingsVM.followedTopics.contains(topic.id)
                Button {
                    settingsVM.toggleTopic(topic.id)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: topic.icon)
                            .font(.system(size: 14))
                            .frame(width: 20)
                        Text(topic.name)
                            .font(.system(size: 13, weight: .medium))
                            .lineLimit(1)
                        Spacer()
                        if selected {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.blue)
                        }
                    }
                    .foregroundStyle(selected ? .blue : .primary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        selected ? Color.blue.opacity(0.08) : Color.clear,
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(AccountButtonStyle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Reusable Components

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.secondary)
            .tracking(1)
    }

    private func menuRowLabel(icon: String, label: String, color: Color) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17))
                .foregroundStyle(color)
                .frame(width: 28)
            Text(label)
                .font(.system(size: 16))
                .foregroundStyle(.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.quaternary)
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
        .contentShape(Rectangle())
    }

    private func expandableRow(
        icon: String, iconColor: Color, label: String, value: String,
        isExpanded: Bool, action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17))
                    .foregroundStyle(iconColor)
                    .frame(width: 28)
                Text(label)
                    .font(.system(size: 16))
                    .foregroundStyle(.primary)
                Spacer()
                Text(value)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.quaternary)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(AccountButtonStyle())
    }

    private func toggleRow(icon: String, iconColor: Color, label: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17))
                .foregroundStyle(iconColor)
                .frame(width: 28)
            Text(label)
                .font(.system(size: 16))
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
        }
        .padding(.horizontal, 16)
        .frame(height: 48)
    }

    private func infoActionRow(
        icon: String, iconColor: Color, label: String, detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17))
                    .foregroundStyle(iconColor)
                    .frame(width: 28)
                Text(label)
                    .font(.system(size: 16))
                    .foregroundStyle(.primary)
                Spacer()
                Text(detail)
                    .font(.system(size: 15))
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.quaternary)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(AccountButtonStyle())
    }

    private func navigationRow(icon: String, iconColor: Color, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 17))
                    .foregroundStyle(iconColor)
                    .frame(width: 28)
                Text(label)
                    .font(.system(size: 16))
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.quaternary)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(AccountButtonStyle())
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
}
