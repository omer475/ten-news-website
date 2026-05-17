import SwiftUI

// Edge-swipe-back gesture for views presented via fullScreenCover / sheet.
//
// Native NavigationStack pushes get a free interactive-pop gesture from
// the system. Anything presented modally — and that's most of our
// "secondary" screens (CreatorProfileView, Signup/Login, TopicFeedView,
// ExploreArticleSheet, the user lists) — does not. That mismatch
// surprised users coming from Instagram / TikTok / X, where every
// secondary screen can be dismissed with a right-swipe from the left
// edge. This modifier closes the gap.
//
// Trigger conditions:
//   • Gesture starts in the leftmost edge of the screen (so list
//     swipes / horizontal carousel drags elsewhere in the view don't
//     fire it).
//   • Translation reaches the activation threshold horizontally,
//     within a forgiving vertical band (don't accidentally trigger on
//     diagonal-ish scrolls).
//   • Fires `action()` on release, mirroring the system back gesture.

struct SwipeToDismissModifier: ViewModifier {
    let action: () -> Void

    /// Width of the activation zone at the leading edge, in points.
    /// Matches roughly what UIKit's interactivePopGestureRecognizer
    /// listens to before it claims the touch.
    private let edgeZoneWidth: CGFloat = 32
    /// Horizontal distance the user has to drag past before we dismiss.
    private let activationDistance: CGFloat = 80
    /// Vertical slack — if the drag deviates too far up/down, treat it
    /// as scroll intent and ignore.
    private let verticalSlack: CGFloat = 60

    func body(content: Content) -> some View {
        // `simultaneousGesture` instead of `.gesture` is critical here:
        // `.gesture` competes with the child ScrollView's pan recognizer
        // and stalls vertical scrolling near the leading edge while we
        // wait to disambiguate. `simultaneousGesture` lets both fire,
        // so the scroll is never blocked — and our onEnded guard only
        // dismisses when the user actually performs an edge-right
        // swipe (start ≤ 32pt, Δx ≥ 80, |Δy| ≤ 60).
        content.simultaneousGesture(
            DragGesture(minimumDistance: 12, coordinateSpace: .local)
                .onEnded { value in
                    guard value.startLocation.x <= edgeZoneWidth else { return }
                    guard value.translation.width >= activationDistance else { return }
                    guard abs(value.translation.height) <= verticalSlack else { return }
                    action()
                }
        )
    }
}

extension View {
    /// Adds an iOS-native-feeling edge-swipe-back gesture: a right-swipe
    /// that starts at the left edge of the view triggers `action()`.
    /// Apply at the root of any view presented via fullScreenCover or
    /// sheet so the user gets the same swipe-back behavior they expect
    /// from NavigationStack pushes.
    func swipeToDismiss(_ action: @escaping () -> Void) -> some View {
        modifier(SwipeToDismissModifier(action: action))
    }
}
