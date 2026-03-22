import SwiftUI

/// Settings page with grouped sections — TikTok/Instagram style
struct SettingsView: View {
    @State private var viewModel = SettingsViewModel()
    @Environment(\.dismiss) private var dismiss
    @Environment(AppViewModel.self) private var appViewModel

    var preferences: UserPreferences
    var onSave: ((UserPreferences) -> Void)?
    var onSignOut: (() -> Void)?

    @State private var showSignOutConfirm = false
    @State private var showClearHistoryConfirm = false
    @State private var showClearBookmarksConfirm = false
    @State private var safariURL: URL?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Theme.Spacing.lg) {
                    profileHeader
                    contentPreferencesSection
                    notificationsSection
                    displaySection
                    dataStorageSection
                    supportSection
                    aboutSection
                    accountSection
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.md)
            }
            .background(Theme.Colors.backgroundPrimary)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        let prefs = viewModel.save()
                        onSave?(prefs)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .confirmationDialog("Sign Out", isPresented: $showSignOutConfirm) {
                Button("Sign Out", role: .destructive) {
                    onSignOut?()
                    dismiss()
                }
            } message: {
                Text("Are you sure you want to sign out?")
            }
            .confirmationDialog("Clear Reading History", isPresented: $showClearHistoryConfirm) {
                Button("Clear All", role: .destructive) {
                    viewModel.clearReadingHistory()
                }
            } message: {
                Text("This will permanently delete your reading history.")
            }
            .confirmationDialog("Clear Saved Articles", isPresented: $showClearBookmarksConfirm) {
                Button("Clear All", role: .destructive) {
                    viewModel.clearBookmarks()
                }
            } message: {
                Text("This will remove all your saved articles.")
            }
            .sheet(item: $safariURL) { url in
                SafariView(url: url)
            }
        }
        .onAppear {
            viewModel.loadFromPreferences(preferences)
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 12) {
            if let avatarUrl = appViewModel.currentUser?.displayAvatar {
                AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                    .frame(width: 64, height: 64)
                    .clipShape(Circle())
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.tertiary)
            }

            VStack(spacing: 4) {
                Text(appViewModel.currentUser?.displayName ?? "News Reader")
                    .font(.system(size: 18, weight: .bold))

                if let email = appViewModel.currentUser?.email {
                    Text(email)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.sm)
    }

    // MARK: - Content Preferences

    private var contentPreferencesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("CONTENT PREFERENCES")

            VStack(spacing: 0) {
                // Home Country
                expandableRow(
                    icon: "house.fill",
                    iconColor: .orange,
                    label: "Home Country",
                    value: viewModel.homeCountryName,
                    isExpanded: viewModel.homeCountryExpanded
                ) {
                    viewModel.homeCountryExpanded.toggle()
                    HapticManager.light()
                }

                if viewModel.homeCountryExpanded {
                    Divider().padding(.leading, 52)
                    homeCountryPicker
                }

                Divider().padding(.leading, 52)

                // Followed Countries
                expandableRow(
                    icon: "globe",
                    iconColor: .green,
                    label: "Followed Countries",
                    value: "\(viewModel.followedCountries.count) selected",
                    isExpanded: viewModel.followedCountriesExpanded
                ) {
                    viewModel.followedCountriesExpanded.toggle()
                    HapticManager.light()
                }

                if viewModel.followedCountriesExpanded {
                    Divider().padding(.leading, 52)
                    followedCountriesPicker
                }

                Divider().padding(.leading, 52)

                // Followed Topics
                expandableRow(
                    icon: "number",
                    iconColor: .blue,
                    label: "Followed Topics",
                    value: "\(viewModel.followedTopics.count) selected",
                    isExpanded: viewModel.followedTopicsExpanded
                ) {
                    viewModel.followedTopicsExpanded.toggle()
                    HapticManager.light()
                }

                if viewModel.followedTopicsExpanded {
                    Divider().padding(.leading, 52)
                    followedTopicsPicker
                }
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("NOTIFICATIONS")

            VStack(spacing: 0) {
                toggleRow(
                    icon: "bolt.fill",
                    iconColor: .red,
                    label: "Breaking News",
                    isOn: Binding(
                        get: { viewModel.breakingNewsAlerts },
                        set: { viewModel.breakingNewsAlerts = $0; HapticManager.light() }
                    )
                )

                Divider().padding(.leading, 52)

                toggleRow(
                    icon: "bell.badge.fill",
                    iconColor: .purple,
                    label: "Event Updates",
                    isOn: Binding(
                        get: { viewModel.eventUpdateAlerts },
                        set: { viewModel.eventUpdateAlerts = $0; HapticManager.light() }
                    )
                )

                Divider().padding(.leading, 52)

                toggleRow(
                    icon: "sun.max.fill",
                    iconColor: .orange,
                    label: "Daily Briefing",
                    isOn: Binding(
                        get: { viewModel.dailyBriefingEnabled },
                        set: { viewModel.dailyBriefingEnabled = $0; HapticManager.light() }
                    )
                )
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Display

    private var displaySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("DISPLAY")

            VStack(spacing: 0) {
                // Appearance Mode
                HStack(spacing: 14) {
                    Image(systemName: "circle.lefthalf.filled")
                        .font(.system(size: 17))
                        .foregroundStyle(.purple)
                        .frame(width: 28)
                    Text("Appearance")
                        .font(.system(size: 16))
                    Spacer()
                    Picker("", selection: Binding(
                        get: { viewModel.appearanceMode },
                        set: { viewModel.appearanceMode = $0; HapticManager.selection() }
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

                Divider().padding(.leading, 52)

                // Text Size
                HStack(spacing: 14) {
                    Image(systemName: "textformat.size")
                        .font(.system(size: 17))
                        .foregroundStyle(.indigo)
                        .frame(width: 28)
                    Text("Text Size")
                        .font(.system(size: 16))
                    Spacer()
                    Picker("", selection: Binding(
                        get: { viewModel.textSizePreference },
                        set: { viewModel.textSizePreference = $0; HapticManager.selection() }
                    )) {
                        Text("S").tag("small")
                        Text("M").tag("medium")
                        Text("L").tag("large")
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 130)
                }
                .padding(.horizontal, 16)
                .frame(height: 48)

                Divider().padding(.leading, 52)

                toggleRow(
                    icon: "hand.tap.fill",
                    iconColor: .cyan,
                    label: "Haptic Feedback",
                    isOn: Binding(
                        get: { viewModel.hapticFeedbackEnabled },
                        set: { viewModel.hapticFeedbackEnabled = $0; HapticManager.light() }
                    )
                )
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Data & Storage

    private var dataStorageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("DATA & STORAGE")

            VStack(spacing: 0) {
                infoActionRow(
                    icon: "clock.fill",
                    iconColor: .purple,
                    label: "Reading History",
                    detail: "\(viewModel.readingHistoryCount) articles"
                ) {
                    showClearHistoryConfirm = true
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                infoActionRow(
                    icon: "bookmark.fill",
                    iconColor: .orange,
                    label: "Saved Articles",
                    detail: "\(viewModel.bookmarkCount) saved"
                ) {
                    showClearBookmarksConfirm = true
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                infoActionRow(
                    icon: "internaldrive.fill",
                    iconColor: .gray,
                    label: "Cache",
                    detail: viewModel.cacheSize
                ) {
                    viewModel.clearCache()
                }
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Support

    private var supportSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("SUPPORT")

            VStack(spacing: 0) {
                navigationRow(
                    icon: "envelope.fill",
                    iconColor: .blue,
                    label: "Send Feedback"
                ) {
                    if let url = URL(string: "mailto:support@tennews.ai") {
                        UIApplication.shared.open(url)
                    }
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                navigationRow(
                    icon: "hand.raised.fill",
                    iconColor: .green,
                    label: "Privacy Policy"
                ) {
                    safariURL = URL(string: "https://tennews.ai/privacy")
                    HapticManager.light()
                }

                Divider().padding(.leading, 52)

                navigationRow(
                    icon: "doc.text.fill",
                    iconColor: .teal,
                    label: "Terms of Service"
                ) {
                    safariURL = URL(string: "https://tennews.ai/terms")
                    HapticManager.light()
                }
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
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
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("ACCOUNT")

            Button {
                showSignOutConfirm = true
                HapticManager.light()
            } label: {
                HStack {
                    Spacer()
                    Text("Sign Out")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Theme.Colors.destructive)
                    Spacer()
                }
                .frame(height: 48)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(SettingsRowButtonStyle())
        }
        .padding(.bottom, Theme.Spacing.md)
    }

    // MARK: - Inline Pickers

    private var homeCountryPicker: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.availableCountries) { country in
                Button {
                    viewModel.setHomeCountry(country.id)
                } label: {
                    HStack(spacing: 12) {
                        Text(country.flag)
                            .font(.title3)
                        Text(country.name)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.Colors.primaryText)
                        Spacer()
                        if viewModel.homeCountry == country.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.Colors.accent)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(SettingsRowButtonStyle())
            }
        }
        .padding(.vertical, 4)
    }

    private var followedCountriesPicker: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.availableCountries) { country in
                Button {
                    viewModel.toggleCountry(country.id)
                } label: {
                    HStack(spacing: 12) {
                        Text(country.flag)
                            .font(.title3)
                        Text(country.name)
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.Colors.primaryText)
                        Spacer()
                        if viewModel.followedCountries.contains(country.id) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Theme.Colors.accent)
                        } else {
                            Image(systemName: "circle")
                                .foregroundStyle(Theme.Colors.tertiaryText)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(SettingsRowButtonStyle())
            }
        }
        .padding(.vertical, 4)
    }

    private var followedTopicsPicker: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: 8) {
            ForEach(viewModel.availableTopics) { topic in
                let selected = viewModel.followedTopics.contains(topic.id)
                Button {
                    viewModel.toggleTopic(topic.id)
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
                                .foregroundStyle(Theme.Colors.accent)
                        }
                    }
                    .foregroundStyle(selected ? Theme.Colors.accent : Theme.Colors.primaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        selected ? Theme.Colors.accent.opacity(0.08) : Color.clear,
                        in: RoundedRectangle(cornerRadius: Theme.CornerRadius.small)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.small))
                }
                .buttonStyle(SettingsRowButtonStyle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    // MARK: - Reusable Row Components

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(Theme.Fonts.sectionLabel())
            .foregroundStyle(Theme.Colors.secondaryText)
            .tracking(1)
    }

    private func expandableRow(
        icon: String,
        iconColor: Color,
        label: String,
        value: String,
        isExpanded: Bool,
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
        .buttonStyle(SettingsRowButtonStyle())
    }

    private func toggleRow(
        icon: String,
        iconColor: Color,
        label: String,
        isOn: Binding<Bool>
    ) -> some View {
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
        icon: String,
        iconColor: Color,
        label: String,
        detail: String,
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
        .buttonStyle(SettingsRowButtonStyle())
    }

    private func navigationRow(
        icon: String,
        iconColor: Color,
        label: String,
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
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.quaternary)
            }
            .padding(.horizontal, 16)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(SettingsRowButtonStyle())
    }
}

// MARK: - URL Identifiable for sheet

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

// MARK: - Button Style

private struct SettingsRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.6 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    SettingsView(preferences: PreviewData.samplePreferences)
        .environment(AppViewModel())
}
