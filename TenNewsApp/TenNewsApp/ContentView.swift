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
}

struct ContentView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var selectedTab = 0
    @State private var currentPageIndex: Int = 0
    @State private var tabBarState = TabBarState()
    @State private var tabBarExpanded = true
    @Namespace private var tabNS

    private var isDarkPage: Bool { selectedTab == 0 || selectedTab == 1 || selectedTab == 2 }

    private var iconActiveColor: Color {
        isDarkPage ? Color.white.opacity(0.9) : Color(white: 0.15)
    }

    private var iconInactiveColor: Color {
        isDarkPage ? Color.white.opacity(0.4) : Color(white: 0.5)
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
                    EventsTabView()
                case 3:
                    AccountTabView()
                case 99:
                    SearchTabView()
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .environment(tabBarState)

            // Custom bottom bar
            if !tabBarState.hideBottomBar {
                bottomBar
                    .padding(.bottom, -11)
                    .padding(.horizontal, 12)
            }
        }
        .ignoresSafeArea(.keyboard)
        // Only collapse on scroll for non-news pages
        .onChange(of: tabBarState.collapseRequested) { _, requested in
            if requested {
                // Only allow scroll-collapse on search tab
                if tabBarExpanded && selectedTab == 99 {
                    guard Date().timeIntervalSince(tabBarState.lastRevealedAt) > 0.8 else {
                        tabBarState.collapseRequested = false
                        return
                    }
                    collapseBar()
                }
                tabBarState.collapseRequested = false
            }
        }
        .onChange(of: selectedTab) { _, newTab in
            tabBarState.searchText = ""
            // Always show expanded bar on main tabs
            if newTab != 99 && !tabBarExpanded {
                withAnimation(.smooth(duration: 0.45)) {
                    tabBarExpanded = true
                    tabBarState.isVisible = true
                    tabBarState.lastRevealedAt = Date()
                }
            }
        }
        .animation(.smooth(duration: 0.45), value: tabBarExpanded)
    }

    // MARK: - Bottom Bar

    @ViewBuilder
    private var bottomBar: some View {
        if tabBarExpanded {
            expandedBar
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else {
            collapsedBar
                .transition(.scale(scale: 0.7).combined(with: .opacity))
        }
    }

    // MARK: - Expanded: glass tab bar pill + glass explore circle

    private var expandedBar: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                // Tab bar pill
                HStack(spacing: 0) {
                    ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                        Button {
                            withAnimation(.bouncy) {
                                selectedTab = index
                            }
                            HapticManager.selection()
                        } label: {
                            Image(systemName: selectedTab == index ? tab.selectedIcon : tab.icon)
                                .font(.system(size: 23, weight: selectedTab == index ? .semibold : .regular))
                                .foregroundStyle(selectedTab == index ? iconActiveColor : iconInactiveColor)
                                .frame(width: 72, height: 40)
                                .glassEffect(
                                    selectedTab == index
                                        ? .regular.interactive()
                                        : .identity,
                                    in: .capsule
                                )
                                .glassEffectID(tab.label, in: tabNS)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .glassEffect(.regular, in: .capsule)

                // Explore circle
                Button {
                    withAnimation(.bouncy) {
                        selectedTab = 99
                        collapseBar()
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(iconActiveColor)
                        .frame(width: 52, height: 52)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
            }
        }
    }

    // MARK: - Collapsed: glass tab icon + search field for Search tab

    private var collapsedIcon: String {
        if selectedTab == 99 { return "newspaper.fill" }
        if selectedTab < tabs.count { return tabs[selectedTab].selectedIcon }
        return "newspaper.fill"
    }

    private var collapsedBar: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                // Tab icon — left
                Button {
                    if selectedTab == 99 {
                        withAnimation(.smooth(duration: 0.45)) {
                            selectedTab = 0
                            tabBarExpanded = true
                            tabBarState.isVisible = true
                            tabBarState.lastRevealedAt = Date()
                        }
                    } else {
                        withAnimation(.smooth(duration: 0.45)) {
                            tabBarExpanded = true
                            tabBarState.isVisible = true
                            tabBarState.lastRevealedAt = Date()
                        }
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: collapsedIcon)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(iconActiveColor)
                        .frame(width: 52, height: 52)
                        .glassEffect(.regular.tint(Color.black.opacity(0.15)), in: Circle())
                }

                // Search field — only on Search tab
                if selectedTab == 99 {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color(white: 0.5))

                        TextField(
                            "Search...",
                            text: Binding(
                                get: { tabBarState.searchText },
                                set: { tabBarState.searchText = $0 }
                            )
                        )
                        .font(.system(size: 15))

                        if !tabBarState.searchText.isEmpty {
                            Button {
                                tabBarState.searchText = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(white: 0.5))
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 52)
                    .fixedSize(horizontal: false, vertical: true)
                    .glassEffect(.regular.tint(Color.black.opacity(0.15)), in: Capsule())
                } else {
                    Spacer()
                }
            }
            .padding(.horizontal, 8)
        }
    }

    // MARK: - Helpers

    private func collapseBar() {
        withAnimation(.smooth(duration: 0.45)) {
            tabBarExpanded = false
            tabBarState.isVisible = false
        }
    }

    private let tabs: [(icon: String, selectedIcon: String, label: String)] = [
        ("newspaper", "newspaper.fill", "Feed"),
        ("safari", "safari.fill", "Explore"),
        ("globe.americas", "globe.americas.fill", "Events"),
        ("person.crop.circle", "person.crop.circle.fill", "Profile"),
    ]
}

// MARK: - Scroll Collapse Modifier

struct ScrollCollapseModifier: ViewModifier {
    @Environment(TabBarState.self) private var tabBarState

    func body(content: Content) -> some View {
        content
            .onScrollGeometryChange(for: CGFloat.self) { geo in
                geo.contentOffset.y
            } action: { oldValue, newValue in
                guard tabBarState.isVisible else { return }
                guard Date().timeIntervalSince(tabBarState.lastRevealedAt) > 0.8 else { return }
                let delta = abs(newValue - oldValue)
                guard delta > 3 else { return }
                tabBarState.collapseRequested = true
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 10, coordinateSpace: .local)
                    .onChanged { value in
                        guard tabBarState.isVisible else { return }
                        guard Date().timeIntervalSince(tabBarState.lastRevealedAt) > 0.8 else { return }
                        let vertical = abs(value.translation.height)
                        if vertical > 15 {
                            tabBarState.collapseRequested = true
                        }
                    }
            )
    }
}

extension View {
    func collapsesTabBarOnScroll() -> some View {
        modifier(ScrollCollapseModifier())
    }
}

#Preview {
    ContentView()
        .environment(AppViewModel())
}
