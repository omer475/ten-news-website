import SwiftUI

/// Canonical example of Apple-native "Liquid Glass" patterns in SwiftUI.
///
/// Demonstrates:
/// - `NavigationStack` with large title
/// - `.toolbarBackground(.barMaterial)` for a glass navigation bar
/// - `.thinMaterial` card backgrounds
/// - `.regularMaterial` floating panel
/// - Content scrolling naturally under the translucent nav bar
/// - System spacing, typography, and SF Symbols
/// - No UIKit, no custom blur, no fake glass
struct GlassExampleView: View {
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Featured card with thin material
                    featuredCard

                    // Section header
                    sectionHeader("Recent Items")

                    // Material cards list
                    ForEach(SampleItem.examples) { item in
                        itemCard(item)
                    }

                    // Floating info panel with regular material
                    infoPanel
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .navigationTitle("Glass Example")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(.regularMaterial, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .searchable(text: $searchText, prompt: "Search items")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        // Action
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                    }
                }
            }
        }
    }

    // MARK: - Featured Card

    /// A hero card using `.thinMaterial` over an image background.
    private var featuredCard: some View {
        ZStack(alignment: .bottomLeading) {
            // Background image placeholder
            RoundedRectangle(cornerRadius: 20)
                .fill(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(height: 200)

            // Glass overlay at the bottom
            VStack(alignment: .leading, spacing: 4) {
                Text("Featured")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text("Getting Started with Glass")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)

                Text("Learn how to use SwiftUI Materials for native glass effects.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.thinMaterial, in: UnevenRoundedRectangle(
                topLeadingRadius: 0,
                bottomLeadingRadius: 20,
                bottomTrailingRadius: 20,
                topTrailingRadius: 0
            ))
        }
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
            Spacer()
            Button("See All") { }
                .font(.subheadline)
        }
        .padding(.top, 8)
    }

    // MARK: - Item Card

    /// A list-style card using `.thinMaterial` as background.
    private func itemCard(_ item: SampleItem) -> some View {
        HStack(spacing: 14) {
            // Icon
            Image(systemName: item.icon)
                .font(.title2)
                .foregroundStyle(item.color)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))

            // Text
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)

                Text(item.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Chevron
            Image(systemName: "chevron.right")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Info Panel

    /// A floating informational panel using `.regularMaterial`.
    private var infoPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Design Tip", systemImage: "lightbulb.fill")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.yellow)

            Text("SwiftUI Materials adapt automatically to the content behind them. Place material backgrounds over colorful content for the best visual effect.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.top, 8)
    }
}

// MARK: - Sample Data

private struct SampleItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    static let examples: [SampleItem] = [
        SampleItem(icon: "doc.text.fill", title: "Documents", subtitle: "12 files updated today", color: .blue),
        SampleItem(icon: "photo.fill", title: "Photos", subtitle: "Camera Roll synced", color: .green),
        SampleItem(icon: "music.note", title: "Music", subtitle: "3 new recommendations", color: .pink),
        SampleItem(icon: "map.fill", title: "Maps", subtitle: "Recent searches", color: .orange),
        SampleItem(icon: "gear", title: "Settings", subtitle: "2 updates available", color: .gray)
    ]
}

#Preview {
    GlassExampleView()
}
