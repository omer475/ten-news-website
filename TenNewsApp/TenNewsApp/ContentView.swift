import SwiftUI
import UIKit

/// Shared state to let child views collapse the tab bar on scroll
@MainActor @Observable
final class TabBarState {
    var isVisible = true
    var collapseRequested = false
    var lastRevealedAt: Date = .distantPast
    var searchText = ""
    var hideBottomBar = false
    var forceExpandedBar = false
    var feedRefreshRequested = false
    var exploreRefreshRequested = false
    /// Cross-tab navigation request. When a child view (e.g. FlashBriefSheet's
    /// trending-topic chip) wants to jump to search pre-filled with a query,
    /// it sets this to the topic string. ContentView's onChange handler
    /// switches selectedTab to 1 (Explore), sets searchText, and flips
    /// `openSearchOnExplore` so ExploreView pops its search overlay.
    var pendingSearch: String?

    /// Read by ExploreView — when set true, the search overlay opens
    /// immediately (search field focused, pre-filled from `searchText` if
    /// set). ExploreView clears the flag after acting on it. Replaces the
    /// old "switch to a dedicated Search tab" pattern after merging
    /// Search into Explore (IG / TikTok pattern, 2026-05-14).
    var openSearchOnExplore = false
}

struct ContentView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab = 0
    @State private var currentPageIndex: Int = 0
    @State private var tabBarState = TabBarState()
    @State private var feedViewModel = FeedViewModel()
    @State private var tabBarExpanded = true
    @Namespace private var tabNS

    @Environment(\.colorScheme) private var colorScheme

    private var isDark: Bool { colorScheme == .dark }

    private var onFeedTab: Bool { selectedTab == 0 }

    /// Tab bar icon colors. Pre-2026-05-07 these were forced to white on the
    /// feed tab because the feed had a dark photo background. The continuous
    /// feed is now light (cream / white card surface), so we drop the
    /// `onFeedTab` override and key purely off the system color scheme:
    /// dark UI → white icons, light UI → near-black icons.
    private var iconActiveColor: Color {
        isDark ? Color.white.opacity(0.9) : Color(white: 0.12)
    }

    private var iconInactiveColor: Color {
        isDark ? Color.white.opacity(0.55) : Color(white: 0.40)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Tab content
            Group {
                switch selectedTab {
                case 0:
                    NavigationStack {
                        MainFeedView(currentPageIndex: $currentPageIndex)
                            .ignoresSafeArea()
                            .toolbar(.hidden, for: .navigationBar)
                            .navigationDestination(for: WorldEvent.self) { event in
                                EventDetailView(event: event)
                            }
                    }
                case 1:
                    ExploreView()
                case 2:
                    ChatListView()
                case 3:
                    AccountTabView()
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .environment(tabBarState)
            .environment(feedViewModel)

            // Custom bottom bar
            if !tabBarState.hideBottomBar {
                bottomBar
                    .padding(.bottom, -11)
                    .padding(.horizontal, 12)
            }
        }
        .ignoresSafeArea(.keyboard)
        // Scroll-collapse used to fire only on the Search tab; user asked
        // for the bar to stay open there too, so the only consumer is gone.
        // Drain any pending request so callers don't see stuck state.
        .onChange(of: tabBarState.collapseRequested) { _, requested in
            if requested { tabBarState.collapseRequested = false }
        }
        .onChange(of: tabBarState.pendingSearch) { _, newVal in
            // Cross-tab navigation requested with a pre-filled query.
            // Switch to Explore (which now owns search) and flip the
            // overlay flag so ExploreView opens its search sheet with
            // the query pre-loaded.
            guard let topic = newVal, !topic.isEmpty else { return }
            selectedTab = 1
            DispatchQueue.main.async {
                tabBarState.searchText = topic
                tabBarState.openSearchOnExplore = true
                tabBarState.pendingSearch = nil
            }
        }
        .onChange(of: selectedTab) { _, _ in
            // Switching tabs clears the live search query so a fresh visit
            // to Explore starts empty. Cross-tab pendingSearch handlers
            // re-set this AFTER selectedTab changes, so they're unaffected.
            tabBarState.searchText = ""
            // Feed tab: preserve state when switching tabs — no auto-refresh.
            // User's scroll position and loaded articles stay intact.
            // Refresh only happens on pull-to-refresh or app foreground after 5+ min.
        }
        // Auto-refresh when app returns to foreground after being backgrounded.
        // Audit fix B11 (2026-05-06): also pause/resume the feed dwell timer
        // so backgrounded-phone time doesn't pollute taste vector. Without
        // this a 30-min phone lock recorded as 1800s "absorbed" engagement.
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                feedViewModel.resumeDwellTracking()
                if selectedTab == 0 {
                    Task {
                        await feedViewModel.refreshIfStale(
                            preferences: appViewModel.preferences,
                            userId: appViewModel.currentUser?.id
                        )
                    }
                }
            case .inactive, .background:
                feedViewModel.pauseDwellTracking()
            @unknown default:
                break
            }
        }
        .animation(.smooth(duration: 0.45), value: tabBarExpanded)
    }

    // MARK: - Bottom Bar
    //
    // Bar is now always expanded. The collapsed-bar variant was a leftover
    // from when scroll-collapse hid the nav on the Search tab — user
    // couldn't find the bar when they needed to switch tabs, and nothing
    // else in the app sets tabBarExpanded to false anymore. Single
    // rendering path = no way the bar gets stuck collapsed.

    private var bottomBar: some View {
        expandedBar
            .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    // MARK: - Expanded: glass tab bar pill + glass explore circle

    private var expandedBar: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                // Tab bar pill
                HStack(spacing: 0) {
                    ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                        Button {
                            if selectedTab == index && index == 0 {
                                tabBarState.feedRefreshRequested = true
                            }
                            if selectedTab == index && index == 1 {
                                tabBarState.exploreRefreshRequested = true
                            }
                            withAnimation(.bouncy) {
                                selectedTab = index
                            }
                            HapticManager.selection()
                        } label: {
                            Image(systemName: selectedTab == index ? tab.selectedIcon : tab.icon)
                                .font(.system(size: 23, weight: selectedTab == index ? .semibold : .regular))
                                .foregroundStyle(selectedTab == index ? iconActiveColor : iconInactiveColor)
                                .frame(width: 84, height: 42)
                                // Non-selected tabs use `.identity` glassEffect, which renders
                                // no material — so the hit area collapses to the SF symbol's
                                // non-transparent pixels and the user's taps on the surrounding
                                // capsule miss. Pinning contentShape to the full 72x40 capsule
                                // restores hit-testing for inactive tabs (Chat/Profile bug).
                                .contentShape(Capsule())
                                .glassEffect(
                                    selectedTab == index
                                        ? .regular.interactive()
                                        : .identity,
                                    in: .capsule
                                )
                                .glassEffectID(tab.label, in: tabNS)
                                // Unread badge on Chat tab (index 2)
                                .overlay(alignment: .topTrailing) {
                                    if index == 2 && ChatService.shared.unreadCount > 0 {
                                        let count = ChatService.shared.unreadCount
                                        Text(count > 9 ? "9+" : "\(count)")
                                            .font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(.white)
                                            .padding(.horizontal, count > 9 ? 4 : 5)
                                            .padding(.vertical, 2)
                                            .background(.red, in: Capsule())
                                            .offset(x: 8, y: -4)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .glassEffect(.regular.tint(Color.black.opacity(0.2)), in: .capsule)

                // Magnifying-glass circle removed 2026-05-14: search lives
                // inside the Explore tab now (IG / TikTok pattern). The user
                // taps the search bar at the top of Explore to open search.
            }
        }
    }

    // MARK: - Helpers

    private let tabs: [(icon: String, selectedIcon: String, label: String)] = [
        ("newspaper", "newspaper.fill", "Feed"),
        ("safari", "safari.fill", "Explore"),
        ("text.bubble", "text.bubble.fill", "Chat"),
        ("person.crop.circle", "person.crop.circle.fill", "Profile"),
    ]
}

#Preview {
    ContentView()
        .environment(AppViewModel())
}
