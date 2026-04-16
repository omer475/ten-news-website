import SwiftUI

/// AsyncImage wrapper with NSCache-based caching and shimmer loading
struct AsyncCachedImage: View {
    let url: URL?
    var aspectRatio: CGFloat?
    var contentMode: ContentMode = .fill
    var onLoaded: ((UIImage) -> Void)?

    @State private var image: UIImage?
    @State private var isLoading = true
    @State private var shimmerPhase: CGFloat = -1

    nonisolated(unsafe) static let cache: NSCache<NSURL, UIImage> = {
        let c = NSCache<NSURL, UIImage>()
        c.countLimit = 50
        c.totalCostLimit = 100 * 1024 * 1024 // 100 MB
        return c
    }()

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .if(aspectRatio != nil) { view in
                        view.aspectRatio(aspectRatio, contentMode: contentMode)
                    }
                    .if(aspectRatio == nil) { view in
                        view.aspectRatio(contentMode: contentMode)
                    }
                    .transition(.opacity.animation(.easeOut(duration: 0.25)))
            } else if isLoading {
                Rectangle()
                    .fill(Color(white: 0.15))
                    .overlay {
                        GeometryReader { geo in
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            .clear,
                                            Color.white.opacity(0.06),
                                            Color.white.opacity(0.1),
                                            Color.white.opacity(0.06),
                                            .clear
                                        ],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geo.size.width * 0.6)
                                .offset(x: shimmerPhase * (geo.size.width * 1.6) - geo.size.width * 0.3)
                        }
                        .clipped()
                    }
                    .onAppear {
                        withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                            shimmerPhase = 1
                        }
                    }
            } else {
                Rectangle()
                    .fill(Color(white: 0.12))
                    .overlay {
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundStyle(Color(white: 0.3))
                    }
            }
        }
        .task(id: url) {
            await loadImage()
        }
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.urlCache = nil // Don't cache HTTP responses (we cache UIImages ourselves)
        return URLSession(configuration: config)
    }()

    private func loadImage() async {
        guard let url else {
            isLoading = false
            return
        }

        // Check cache first
        if let cached = Self.cache.object(forKey: url as NSURL) {
            image = cached
            isLoading = false
            onLoaded?(cached)
            return
        }

        isLoading = true

        // Try up to 2 times (initial + 1 retry)
        for attempt in 0..<2 {
            if attempt > 0 {
                try? await Task.sleep(for: .milliseconds(500))
            }
            do {
                var request = URLRequest(url: url)
                request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", forHTTPHeaderField: "User-Agent")
                request.setValue("image/*,*/*;q=0.8", forHTTPHeaderField: "Accept")
                request.setValue(url.host.map { "https://\($0)/" } ?? "", forHTTPHeaderField: "Referer")
                let (data, response) = try await Self.session.data(for: request)
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 200
                if statusCode < 400, let uiImage = UIImage(data: data) {
                    let cost = data.count
                    Self.cache.setObject(uiImage, forKey: url as NSURL, cost: cost)
                    image = uiImage
                    onLoaded?(uiImage)
                    isLoading = false
                    return
                }
            } catch {
                continue
            }
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
