import SwiftUI
import UIKit

// Native-feeling interactive edge-swipe-back gesture.
//
// Replaces the older fire-on-release modifier with the iOS-native
// experience: the view slides with the user's finger, snaps back if
// released too early, and completes the dismiss if past the threshold
// OR moving fast enough at release. Matches UIKit's
// interactivePopGestureRecognizer for views presented modally (where
// SwiftUI doesn't give you that gesture for free).
//
// Behavior:
//   • Gesture starts in the leftmost 60pt — wider than the previous
//     32pt zone so quick swipes from inside an article register.
//   • Vertical motion above 60pt cancels (treat it as a scroll).
//   • View `.offset(x:)` tracks the drag in real time.
//   • On release:
//       - `translation.width ≥ 120pt`  OR
//       - velocity (predictedEnd − actual) > 250pt
//     → slide out + call action()
//     - Otherwise: spring back to 0.
//   • Snap-back uses a tight spring (response 0.28, damping 0.85)
//     so it feels responsive, not floppy.

struct InteractiveSwipeDismissModifier: ViewModifier {
    let action: () -> Void

    @State private var offset: CGFloat = 0
    @State private var isDragging = false
    /// Latches once `action()` fires so a second gesture during the
    /// parent's dismiss-transition can't fire action() a second time.
    /// Without this the parent saw two `.move(.trailing)` runs in a
    /// row and the screen looked like it dismissed twice.
    @State private var didDismiss = false

    private let edgeZoneWidth: CGFloat = 60
    private let activationDistance: CGFloat = 120
    private let verticalSlack: CGFloat = 60
    private let velocityCutoff: CGFloat = 250

    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            .simultaneousGesture(
                DragGesture(minimumDistance: 8, coordinateSpace: .local)
                    .onChanged { value in
                        guard !didDismiss else { return }
                        // Only engage when the gesture started near the
                        // leading edge — anywhere else, leave child
                        // scrolls alone.
                        guard value.startLocation.x <= edgeZoneWidth else { return }
                        // Cancel if the drag is mostly vertical.
                        guard abs(value.translation.height) <= verticalSlack else {
                            if isDragging {
                                // Snap back if the user converts to a vertical scroll mid-drag.
                                withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
                                    offset = 0
                                }
                                isDragging = false
                            }
                            return
                        }
                        // Only track rightward motion.
                        let dx = max(0, value.translation.width)
                        isDragging = true
                        offset = dx
                    }
                    .onEnded { value in
                        guard isDragging, !didDismiss else { return }
                        isDragging = false

                        let actual = value.translation.width
                        let predicted = value.predictedEndTranslation.width
                        let velocity = predicted - actual

                        if actual >= activationDistance || velocity >= velocityCutoff {
                            // Latch BEFORE firing so a follow-up drag
                            // during the parent's transition doesn't
                            // re-trigger action().
                            didDismiss = true
                            // Let the PARENT animate the slide-out via
                            // `.transition(.move(.trailing))` on its
                            // overlay — fire action() right away. Our
                            // own offset animation was racing the
                            // parent's transition and the user saw the
                            // view dismiss twice.
                            action()
                            offset = 0
                        } else {
                            // Spring back to home position.
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.85)) {
                                offset = 0
                            }
                        }
                    }
            )
    }
}

extension View {
    /// iOS-native interactive edge-swipe-back. The view slides with
    /// the finger and either completes (past threshold or fast flick)
    /// or springs back. Wraps modifier(InteractiveSwipeDismissModifier).
    func swipeToDismiss(_ action: @escaping () -> Void) -> some View {
        modifier(InteractiveSwipeDismissModifier(action: action))
    }
}
