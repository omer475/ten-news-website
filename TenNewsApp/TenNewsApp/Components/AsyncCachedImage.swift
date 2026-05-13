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
    @Environment(\.colorScheme) private var colorScheme

    /// Background tone of the placeholder shimmer + failure tile. Adapts to
    /// the parent color scheme so a light page doesn't show a black rectangle
    /// (and vice versa).
    private var placeholderBase: Color {
        colorScheme == .dark ? Color(white: 0.15) : Color(white: 0.92)
    }
    private var shimmerHighlight: Color {
        colorScheme == .dark ? Color.white.opacity(0.10) : Color.black.opacity(0.05)
    }
    private var failureIconColor: Color {
        colorScheme == .dark ? Color(white: 0.3) : Color(white: 0.65)
    }

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
                    .fill(placeholderBase)
                    .overlay {
                        GeometryReader { geo in
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            .clear,
                                            shimmerHighlight,
                                            shimmerHighlight,
                                            shimmerHighlight,
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
                    .fill(placeholderBase)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundStyle(failureIconColor)
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

        // Try up to 3 times with exponential backoff (250ms, 750ms). Some
        // CDN edges return 503 briefly during cache misses; a third attempt
        // catches those without making the user stare at a shimmer for too
        // long. URLSession timeoutIntervalForRequest=15s caps each attempt.
        let backoffMs: [UInt64] = [0, 250, 750]
        for attempt in 0..<3 {
            if backoffMs[attempt] > 0 {
                try? await Task.sleep(for: .milliseconds(Int(backoffMs[attempt])))
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
                // Non-2xx OR couldn't decode — retry with backoff.
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
