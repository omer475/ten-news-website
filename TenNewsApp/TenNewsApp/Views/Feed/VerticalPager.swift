import SwiftUI

/// Custom vertical pager using DragGesture for TikTok-style swiping.
/// Implements snap-to-page with smooth spring animation.
struct VerticalPager<Item: Identifiable, Content: View>: View {
    @Binding var currentIndex: Int
    let pages: [Item]
    @ViewBuilder let content: (Item) -> Content

    @State private var dragOffset: CGFloat = 0

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
            }
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onChanged { value in
                        // Rubber-band effect at boundaries
                        let translation = value.translation.height
                        if (currentIndex == 0 && translation > 0) ||
                           (currentIndex == pages.count - 1 && translation < 0) {
                            dragOffset = translation * 0.3
                        } else {
                            dragOffset = translation
                        }
                    }
                    .onEnded { value in
                        let threshold = height * 0.2
                        let predicted = value.predictedEndTranslation.height

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
