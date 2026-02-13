import SwiftUI

/// Alias for convenience — referenced as AppAnimations throughout the app
typealias AppAnimations = Animations

enum Animations {
    /// Standard spring for card interactions (tap, expand/collapse)
    static let cardSpring = Animation.spring(
        response: 0.4,
        dampingFraction: 0.8,
        blendDuration: 0
    )

    /// Quick spring for small UI feedback (button presses, toggles)
    static let quickSpring = Animation.spring(
        response: 0.25,
        dampingFraction: 0.75,
        blendDuration: 0
    )

    /// Page-level transition animation (tab switches, navigation)
    static let pageTransition = Animation.spring(
        response: 0.35,
        dampingFraction: 0.85,
        blendDuration: 0
    )

    /// Swipe gesture transition (card swiping, dismissal)
    static let swipeTransition = Animation.spring(
        response: 0.3,
        dampingFraction: 0.7,
        blendDuration: 0
    )

    /// Subtle fade for content appearance
    static let fade = Animation.easeInOut(duration: 0.2)

    /// Staggered delay for list items
    static func staggered(index: Int, baseDelay: Double = 0.05) -> Animation {
        cardSpring.delay(Double(index) * baseDelay)
    }
}
