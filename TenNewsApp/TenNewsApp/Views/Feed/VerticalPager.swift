import SwiftUI

/// Custom vertical pager using DragGesture for TikTok-style swiping.
/// Implements snap-to-page with smooth spring animation.
struct VerticalPager<Item: Identifiable, Content: View>: View {
    @Binding var currentIndex: Int
    let pages: [Item]
    var onRefresh: (() async -> Void)?
    @ViewBuilder let content: (Item) -> Content

    @State private var dragOffset: CGFloat = 0
    @State private var isRefreshing = false

    var body: some View {
        GeometryReader { geo in
            let height = geo.size.height

            ZStack {
                ForEach(Array(visibleRange.enumerated()), id: \.element) { _, index in
                    if index >= 0 && index < pages.count {
                        content(pages[index])
                            .frame(width: geo.size.width, height: height)
                            .offset(y: CGFloat(index - currentIndex) * height + dragOffset)
                    }
                }

                // Pull-to-refresh indicator
                if currentIndex == 0 && dragOffset > 40 && onRefresh != nil {
                    VStack {
                        if isRefreshing {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "arrow.down")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.7))
                                .rotationEffect(.degrees(dragOffset > 80 ? 180 : 0))
                                .animation(.easeInOut(duration: 0.2), value: dragOffset > 80)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .offset(y: -height / 2 + dragOffset / 2)
                }
            }
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onChanged { value in
                        let translation = value.translation.height
                        if (currentIndex == 0 && translation > 0) ||
                           (currentIndex == pages.count - 1 && translation < 0) {
                            // Rubber-band at boundaries (allows pull-to-refresh feel)
                            dragOffset = translation * 0.3
                        } else {
                            dragOffset = translation
                        }
                    }
                    .onEnded { value in
                        let threshold = height * 0.2
                        let predicted = value.predictedEndTranslation.height

                        // Pull-to-refresh: at top, pulled down past threshold
                        if currentIndex == 0 && value.translation.height > 80 && onRefresh != nil {
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                                dragOffset = 0
                            }
                            isRefreshing = true
                            Task {
                                await onRefresh?()
                                isRefreshing = false
                            }
                            return
                        }

                        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                            if predicted < -threshold && currentIndex < pages.count - 1 {
                                currentIndex += 1
                                HapticManager.light()
                            } else if predicted > threshold && currentIndex > 0 {
                                currentIndex -= 1
                                HapticManager.light()
                            }
                            dragOffset = 0
                        }
                    }
            )
        }
    }

    /// Only render nearby items for performance (current +/- 1)
    private var visibleRange: Range<Int> {
        let start = max(0, currentIndex - 1)
        let end = min(pages.count, currentIndex + 2)
        return start..<end
    }
}

#Preview {
    VerticalPager(
        currentIndex: .constant(0),
        pages: [
            PreviewData.sampleArticle
        ]
    ) { article in
        ArticleCardView(
            article: article,
            accentColor: .blue
        )
    }
    .ignoresSafeArea()
}
