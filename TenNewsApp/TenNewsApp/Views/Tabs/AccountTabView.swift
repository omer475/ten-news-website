import SwiftUI

struct AccountTabView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var showSettings = false
    @State private var appeared = false
    @State private var showSignOutConfirm = false

    private var user: AuthUser? { appViewModel.currentUser }
    private var prefs: UserPreferences { appViewModel.preferences }

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    profileHeader
                        .padding(.top, 30)

                    // MARK: - Action Buttons
                    actionButtons
                        .padding(.top, 20)
                        .padding(.horizontal, 20)

                    // MARK: - Followed Topics
                    if !prefs.followedTopics.isEmpty {
                        tagSection(
                            title: "Followed Topics",
                            icon: "number",
                            items: prefs.followedTopics,
                            tint: .blue
                        )
                        .padding(.top, 28)
                    }

                    // MARK: - Followed Countries
                    if !prefs.followedCountries.isEmpty || prefs.homeCountry != nil {
                        countrySection
                            .padding(.top, 24)
                    }

                    // MARK: - Menu
                    menuSection
                        .padding(.top, 32)
                        .padding(.horizontal, 20)

                    Spacer().frame(height: 120)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                        HapticManager.light()
                    } label: {
                        Image(systemName: "gearshape")
                            .font(.system(size: 16, weight: .medium))
                    }
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(
                preferences: appViewModel.preferences,
                onSave: { prefs in
                    appViewModel.updatePreferences(prefs)
                },
                onSignOut: {
                    appViewModel.logout()
                }
            )
        }
        .confirmationDialog("Sign Out", isPresented: $showSignOutConfirm) {
            Button("Sign Out", role: .destructive) {
                appViewModel.logout()
            }
        } message: {
            Text("Are you sure you want to sign out? You'll need to set up your preferences again.")
        }
        .onAppear {
            withAnimation(.smooth(duration: 0.5)) {
                appeared = true
            }
        }
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

                if let email = user?.email {
                    Text(email)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 5) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.blue)
                    Text("Ten News Reader")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
        }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button {
                showSettings = true
                HapticManager.light()
            } label: {
                Text("Edit Preferences")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 36)
                    .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))
                    .contentShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(AccountButtonStyle())

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
    }

    // MARK: - Tag Section (Topics)

    private func tagSection(title: String, icon: String, items: [String], tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(tint)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
            }
            .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(items, id: \.self) { item in
                        Text(item)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(.fill.tertiary, in: Capsule())
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Countries Section

    private var countrySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.green)
                Text("Followed Countries")
                    .font(.system(size: 15, weight: .semibold))
            }
            .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if let home = prefs.homeCountry {
                        HStack(spacing: 5) {
                            Image(systemName: "house.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.orange)
                            Text(home)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.orange.opacity(0.12), in: Capsule())
                    }

                    ForEach(prefs.followedCountries, id: \.self) { country in
                        Text(country)
                            .font(.system(size: 13, weight: .medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(.fill.tertiary, in: Capsule())
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Menu Section

    private var menuSection: some View {
        VStack(spacing: 0) {
            // First card
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

            // Second card
            VStack(spacing: 0) {
                Button {
                    showSettings = true
                    HapticManager.light()
                } label: {
                    menuRowLabel(icon: "slider.horizontal.3", label: "Preferences", color: .blue)
                        .contentShape(Rectangle())
                }
                .buttonStyle(AccountButtonStyle())
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
            .padding(.top, 16)

            // Sign out
            Button {
                showSignOutConfirm = true
                HapticManager.light()
            } label: {
                HStack {
                    Spacer()
                    Text("Sign Out")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.red)
                    Spacer()
                }
                .frame(height: 48)
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(AccountButtonStyle())
            .padding(.top, 16)

            // Version
            Text("Ten News v1.0")
                .font(.system(size: 12))
                .foregroundStyle(.quaternary)
                .padding(.top, 20)
        }
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
