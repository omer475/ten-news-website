import SwiftUI

/// Vertical pager using ScrollView with paging behavior.
/// Uses native scroll so system features (tab bar minimize) work automatically.
struct VerticalPager<Item: Identifiable, Content: View>: View {
    @Binding var currentIndex: Int
    let pages: [Item]
    @ViewBuilder let content: (Item) -> Content

    @State private var scrolledID: Item.ID?
    @State private var lastHapticIndex: Int = 0

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(pages) { page in
                        content(page)
                            .frame(width: geo.size.width, height: geo.size.height)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $scrolledID)
            .onChange(of: scrolledID) { _, newID in
                guard let newID,
                      let index = pages.firstIndex(where: { $0.id == newID }) else { return }
                if index != lastHapticIndex {
                    HapticManager.light()
                    lastHapticIndex = index
                }
                currentIndex = index
            }
            .onChange(of: currentIndex) { _, newIndex in
                if newIndex < pages.count {
                    let targetID = pages[newIndex].id
                    if scrolledID != targetID {
                        scrolledID = targetID
                    }
                }
            }
            .onAppear {
                if currentIndex < pages.count {
                    scrolledID = pages[currentIndex].id
                    lastHapticIndex = currentIndex
                }
            }
        }
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
