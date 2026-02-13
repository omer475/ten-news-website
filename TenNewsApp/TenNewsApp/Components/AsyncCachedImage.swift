import SwiftUI

/// AsyncImage wrapper with NSCache-based caching
struct AsyncCachedImage: View {
    let url: URL?
    var aspectRatio: CGFloat?

    @State private var image: UIImage?
    @State private var isLoading = true

    private static let cache = NSCache<NSURL, UIImage>()

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .if(aspectRatio != nil) { view in
                        view.aspectRatio(aspectRatio, contentMode: .fill)
                    }
                    .if(aspectRatio == nil) { view in
                        view.scaledToFill()
                    }
            } else if isLoading {
                Rectangle()
                    .fill(Color(hex: "#e5e5ea").opacity(0.3))
                    .overlay {
                        ProgressView()
                            .tint(Theme.Colors.secondaryText)
                    }
            } else {
                Rectangle()
                    .fill(Color(hex: "#e5e5ea").opacity(0.3))
                    .overlay {
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundStyle(Theme.Colors.tertiaryText)
                    }
            }
        }
        .task(id: url) {
            await loadImage()
        }
    }

    private func loadImage() async {
        guard let url else {
            isLoading = false
            return
        }

        // Check cache first
        if let cached = Self.cache.object(forKey: url as NSURL) {
            image = cached
            isLoading = false
            return
        }

        isLoading = true

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let uiImage = UIImage(data: data) {
                Self.cache.setObject(uiImage, forKey: url as NSURL)
                image = uiImage
            }
        } catch {
            // Silently fail - show placeholder
        }

        isLoading = false
    }
}

#Preview("AsyncCachedImage") {
    AsyncCachedImage(
        url: URL(string: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=400"),
        aspectRatio: 16 / 9
    )
    .frame(height: 200)
    .clipShape(RoundedRectangle(cornerRadius: 12))
    .padding()
}
