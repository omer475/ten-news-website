import SwiftUI

/// Settings page with country, topic, and account management
struct SettingsView: View {
    @State private var viewModel = SettingsViewModel()
    @Environment(\.dismiss) private var dismiss

    var preferences: UserPreferences
    var onSave: ((UserPreferences) -> Void)?
    var onSignOut: (() -> Void)?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                    // Home Country
                    homeCountrySection

                    // Followed Countries
                    countriesSection

                    // Topics
                    topicsSection

                    // Account
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
        }
        .onAppear {
            viewModel.loadFromPreferences(preferences)
        }
    }

    // MARK: - Home Country Section

    private var homeCountrySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HOME COUNTRY")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(spacing: 1) {
                ForEach(viewModel.availableCountries) { country in
                    Button {
                        viewModel.setHomeCountry(country.id)
                    } label: {
                        HStack(spacing: 12) {
                            Text(country.flag)
                                .font(.title3)
                            Text(country.name)
                                .font(Theme.Fonts.body())
                                .foregroundStyle(Theme.Colors.primaryText)
                            Spacer()
                            if viewModel.homeCountry == country.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Theme.Colors.accent)
                            }
                        }
                        .padding(.horizontal, Theme.Spacing.md)
                        .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }

    // MARK: - Countries Section

    private var countriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("FOLLOWED COUNTRIES")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(spacing: 1) {
                ForEach(viewModel.availableCountries) { country in
                    Button {
                        viewModel.toggleCountry(country.id)
                    } label: {
                        HStack(spacing: 12) {
                            Text(country.flag)
                                .font(.title3)
                            Text(country.name)
                                .font(Theme.Fonts.body())
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
                        .padding(.horizontal, Theme.Spacing.md)
                        .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                }
            }
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }

    // MARK: - Topics Section

    private var topicsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TOPICS")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 8) {
                ForEach(viewModel.availableTopics) { topic in
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
                            if viewModel.followedTopics.contains(topic.id) {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Theme.Colors.accent)
                            }
                        }
                        .foregroundStyle(
                            viewModel.followedTopics.contains(topic.id)
                                ? Theme.Colors.accent
                                : Theme.Colors.primaryText
                        )
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.small))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ACCOUNT")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            Button {
                onSignOut?()
                dismiss()
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 14))
                    Text("Sign Out")
                        .font(Theme.Fonts.body())
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.tertiaryText)
                }
                .foregroundStyle(Theme.Colors.destructive)
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, 14)
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
            }
            .buttonStyle(.plain)
        }
    }
}

#Preview {
    SettingsView(preferences: PreviewData.samplePreferences)
}
