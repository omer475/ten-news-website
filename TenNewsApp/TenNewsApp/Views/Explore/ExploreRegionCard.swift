import SwiftUI

struct ExploreRegionCard: View {
    let cluster: ExploreViewModel.RegionCluster

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background — use first article image if available
            if let imageUrl = cluster.articles.first?.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill)
                    .frame(width: 160, height: 200)
                    .clipped()
            } else {
                Rectangle()
                    .fill(Color(hex: "#007AFF").opacity(0.2).gradient)
                    .frame(width: 160, height: 200)
            }

            // Glass gradient overlay
            VStack(spacing: 0) {
                Spacer()
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: .black.opacity(0.4), location: 0.2),
                                .init(color: .black, location: 0.6),
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: 120)
            }

            // Flag overlay top-left
            VStack {
                HStack {
                    Text(cluster.flag)
                        .font(.system(size: 30))
                        .shadow(color: .black.opacity(0.5), radius: 4, y: 2)
                    Spacer()
                }
                .padding(10)
                Spacer()
            }

            // Bottom info
            VStack(alignment: .leading, spacing: 5) {
                Text(cluster.name)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)

                Text("\(cluster.articles.count) stories")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.45))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
        .frame(width: 160, height: 200)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color.white.opacity(0.05), lineWidth: 0.5)
        )
    }
}
