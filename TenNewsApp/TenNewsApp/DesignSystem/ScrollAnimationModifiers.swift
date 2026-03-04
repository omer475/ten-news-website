import SwiftUI

// MARK: - Scroll Progress Modifier

/// Drives a binding from 0→1 based on the view's vertical scroll position.
/// Progress is 0 when the view's midY is at the bottom of the screen,
/// and 1 when midY reaches 40% from the top.
private struct ScrollProgressModifier: ViewModifier {
    @Binding var progress: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
                .onAppear { progress = 1 }
        } else {
            content
                .onGeometryChange(for: CGFloat.self) { proxy in
                    let midY = proxy.frame(in: .scrollView).midY
                    let containerHeight = proxy.bounds(of: .scrollView)?.height ?? 900
                    // Normalized: 0 = top of visible area, 1 = bottom
                    return midY / containerHeight
                } action: { normalized in
                    // When center is at bottom of viewport (≈1) → progress 0
                    // When center is at 40% from top (≈0.4) → progress 1
                    let raw = 1 - (normalized - 0.4) / (1.0 - 0.4)
                    let clamped = min(max(raw, 0), 1)
                    if abs(clamped - progress) > 0.005 {
                        progress = clamped
                    }
                }
        }
    }
}

extension View {
    /// Binds a 0→1 progress value driven by this view's scroll position.
    func scrollProgress(_ progress: Binding<CGFloat>) -> some View {
        modifier(ScrollProgressModifier(progress: progress))
    }
}

// MARK: - Scroll Reveal Modifier

/// One-shot fade + slide + scale reveal triggered when the view scrolls into the viewport.
private struct ScrollRevealModifier: ViewModifier {
    let offset: CGFloat
    let scale: CGFloat

    @State private var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            content
                .opacity(hasAppeared ? 1 : 0)
                .offset(y: hasAppeared ? 0 : offset)
                .scaleEffect(hasAppeared ? 1 : scale)
                .onScrollVisibilityChange(threshold: 0.1) { visible in
                    guard visible, !hasAppeared else { return }
                    withAnimation(AppAnimations.scrollRevealSpring) {
                        hasAppeared = true
                    }
                }
        }
    }
}

extension View {
    /// One-shot scroll-driven reveal: fades in, slides up, and scales to full size.
    func scrollReveal(offset: CGFloat = 16, scale: CGFloat = 0.97) -> some View {
        modifier(ScrollRevealModifier(offset: offset, scale: scale))
    }
}
