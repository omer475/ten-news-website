import SwiftUI

struct ExploreCategoryCard: View {
    let spotlight: ExploreViewModel.CategorySpotlight

    var body: some View {
        VStack(spacing: 0) {
            // Image top half
            ZStack {
                if let imageUrl = spotlight.articles.first?.displayImage {
                    AsyncCachedImage(url: imageUrl, contentMode: .fill)
                        .frame(width: 160, height: 115)
                        .clipped()
                } else {
                    Rectangle()
                        .fill(spotlight.color.opacity(0.2).gradient)
                        .frame(width: 160, height: 115)
                }

                // Color tint overlay for consistency
                LinearGradient(
                    colors: [spotlight.color.opacity(0.15), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 30)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                // Icon overlay when no image
                if spotlight.articles.first?.displayImage == nil {
                    let topic = BrowseTopic.allTopics.first { $0.name == spotlight.name }
                    Image(systemName: topic?.icon ?? "newspaper")
                        .font(.system(size: 28))
                        .foregroundStyle(spotlight.color.opacity(0.5))
                }
            }
            .frame(width: 160, height: 115)

            // Bottom info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(spotlight.color)
                        .frame(width: 7, height: 7)

                    Text(spotlight.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                }

                Text("\(spotlight.articles.count) stories")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 8)
            .background(Color(white: 0.10))
        }
        .frame(width: 160, height: 200)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.white.opacity(0.05), lineWidth: 0.5)
        )
    }
}
