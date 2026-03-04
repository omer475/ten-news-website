import SwiftUI

struct SearchTabView: View {
    @State private var searchText = ""

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    GlassEffectContainer {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Color(hex: "#8e8e93"))

                            TextField("What do you want to read?", text: $searchText)
                                .font(.system(size: 16))
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 44)
                        .glassEffect(.regular.interactive(), in: Capsule())
                    }
                    .padding(.horizontal, 16)

                    // Browse all
                    Text("Browse all")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 16)

                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(BrowseTopic.allTopics) { topic in
                            topicCard(topic)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
                }
                .padding(.top, 8)
            }
            .collapsesTabBarOnScroll()
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private func topicCard(_ topic: BrowseTopic) -> some View {
        RoundedRectangle(cornerRadius: 14)
            .fill(
                LinearGradient(
                    colors: [topic.color, topic.color.opacity(0.7)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .frame(height: 100)
            .overlay(alignment: .topLeading) {
                Text(topic.name)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.leading, 14)
                    .padding(.top, 14)
            }
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: topic.icon)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundStyle(.white.opacity(0.3))
                    .rotationEffect(.degrees(15))
                    .offset(x: -10, y: -10)
            }
    }
}

// BrowseTopic model is defined in Models/BrowseTopic.swift

#Preview {
    SearchTabView()
}
