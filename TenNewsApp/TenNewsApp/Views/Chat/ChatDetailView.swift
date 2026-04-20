import SwiftUI

struct ChatDetailView: View {
    @Environment(AppViewModel.self) private var appViewModel

    let conversation: ChatConversation
    var onDismiss: (() -> Void)?

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = true
    @State private var chatService = ChatService.shared
    @FocusState private var inputFocused: Bool

    private var userId: String? { appViewModel.currentUser?.id }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Messages
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVStack(spacing: 2) {
                            if isLoading {
                                ProgressView()
                                    .padding(.top, 40)
                            }

                            ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                                let isMe = message.senderId == userId
                                let showAvatar = shouldShowAvatar(at: index)

                                messageBubble(message, isMe: isMe, showAvatar: showAvatar)
                                    .id(message.id)
                            }

                            // Invisible anchor at the very bottom
                            Color.clear
                                .frame(height: 1)
                                .id("bottom")
                        }
                        .padding(.horizontal, 8)
                        .padding(.top, 12)
                        .padding(.bottom, 8)
                    }
                    .defaultScrollAnchor(.bottom)
                    .onChange(of: messages.count) { _, _ in
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo("bottom")
                        }
                    }
                    .onChange(of: inputFocused) { _, focused in
                        if focused {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    proxy.scrollTo("bottom")
                                }
                            }
                        }
                    }
                }

                // Input bar
                inputBar
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        onDismiss?()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                    }
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        if let avatarUrl = conversation.displayAvatar {
                            AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                                .frame(width: 28, height: 28)
                                .clipShape(Circle())
                        }
                        Text(conversation.displayName)
                            .font(.system(size: 16, weight: .semibold))
                    }
                }
            }
            .background(Theme.Colors.backgroundPrimary)
        }
        .onAppear {
            Task {
                messages = await chatService.loadMessages(conversationId: conversation.id)
                isLoading = false
            }
            chatService.startPolling(conversationId: conversation.id) { newMessages in
                // Always update — server may enrich messages with article data
                // or other fields after initial fetch (e.g. article_id populated
                // on first fetch, but article object populated only after the
                // backend attaches it). Count+lastID equality is insufficient.
                messages = newMessages
            }
        }
        .onDisappear {
            chatService.stopPolling()
            if let uid = userId {
                Task { await chatService.loadConversations(userId: uid) }
            }
        }
    }

    // MARK: - Helpers

    /// Show the other user's avatar only on the last message in a consecutive group
    private func shouldShowAvatar(at index: Int) -> Bool {
        let msg = messages[index]
        if msg.senderId == userId { return false }
        if index == messages.count - 1 { return true }
        return messages[index + 1].senderId != msg.senderId
    }

    // MARK: - Message Bubble

    private func messageBubble(_ message: ChatMessage, isMe: Bool, showAvatar: Bool) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isMe {
                Spacer(minLength: 48)
            } else {
                if showAvatar {
                    if let avatarUrl = conversation.displayAvatar {
                        AsyncCachedImage(url: avatarUrl, contentMode: .fill)
                            .frame(width: 28, height: 28)
                            .clipShape(Circle())
                    } else {
                        Circle()
                            .fill(.fill.tertiary)
                            .frame(width: 28, height: 28)
                            .overlay {
                                Text(String(conversation.displayName.prefix(1)).uppercased())
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.secondary)
                            }
                    }
                } else {
                    Color.clear.frame(width: 28, height: 28)
                }
            }

            VStack(alignment: isMe ? .trailing : .leading, spacing: 4) {
                // Article share card
                if message.isArticleShare, let article = message.article {
                    ChatSharedArticleCard(article: article)
                }

                // Text content
                if let content = message.content, !content.isEmpty {
                    GlassEffectContainer {
                        Text(content)
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 11)
                            .glassEffect(
                                isMe
                                    ? .regular.tint(Color(hex: "#0A84FF").opacity(0.5)).interactive()
                                    : .regular.tint(Color.white.opacity(0.08)),
                                in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                            )
                    }
                }

                // Timestamp
                if showAvatar || isMe {
                    Text(message.timeString)
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 4)
                }
            }

            if !isMe {
                Spacer(minLength: 48)
            }
        }
        .padding(.vertical, 1)
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                TextField("Message...", text: $inputText, axis: .vertical)
                    .font(.system(size: 16))
                    .lineLimit(1...5)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .glassEffect(
                        .regular.tint(Color.white.opacity(0.05)),
                        in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                    )
                    .focused($inputFocused)

                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(
                            inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? Color.white.opacity(0.15)
                                : Color(hex: "#0A84FF")
                        )
                }
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let uid = userId else { return }

        inputText = ""
        HapticManager.light()

        Task {
            if let sent = await chatService.sendMessage(
                conversationId: conversation.id,
                senderId: uid,
                content: text
            ) {
                messages.append(sent)
            }
        }
    }
}

// MARK: - Shared Article Card (uses dominant color from image, same as explore page)

struct ChatSharedArticleCard: View {
    let article: SharedArticle

    @State private var dominantColor: Color?

    private var highlightColor: Color {
        (dominantColor ?? Color(white: 0.7)).vivid()
    }

    private var glassColor: Color {
        dominantColor ?? Color(white: 0.15)
    }

    private var cardWidth: CGFloat {
        UIScreen.main.bounds.width - 80
    }

    private var cardHeight: CGFloat {
        cardWidth * 0.75
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Image fills the card
            if let imageUrl = article.displayImage {
                AsyncCachedImage(url: imageUrl, contentMode: .fill, onLoaded: nil)
                    .frame(width: cardWidth, height: cardHeight)
                    .clipped()
                    .onAppear { extractColor(from: imageUrl) }
            } else {
                Rectangle()
                    .fill(highlightColor.opacity(0.3))
                    .frame(width: cardWidth, height: cardHeight)
            }

            // Dark gradient overlay (same as explore cards)
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.0),
                    .init(color: .clear, location: 0.3),
                    .init(color: .black.opacity(0.4), location: 0.45),
                    .init(color: .black.opacity(0.7), location: 0.6),
                    .init(color: .black.opacity(0.85), location: 0.75),
                    .init(color: .black.opacity(0.95), location: 1.0),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(width: cardWidth, height: cardHeight)
            .allowsHitTesting(false)

            // Liquid glass tinted with dominant color (same as explore cards)
            Color.clear
                .frame(width: cardWidth, height: cardHeight)
                .glassEffect(
                    .regular.tint(glassColor.opacity(0.45)),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.0),
                            .init(color: .clear, location: 0.3),
                            .init(color: .white.opacity(0.15), location: 0.42),
                            .init(color: .white.opacity(0.35), location: 0.54),
                            .init(color: .white.opacity(0.55), location: 0.66),
                            .init(color: .white.opacity(0.70), location: 0.78),
                            .init(color: .white.opacity(0.70), location: 1.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .allowsHitTesting(false)

            // Category + highlighted title
            VStack(alignment: .leading, spacing: 6) {
                if let category = article.category {
                    Text(category)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.5))
                        .textCase(.uppercase)
                        .tracking(0.8)
                }
                if let title = article.title {
                    highlightedTitle(title)
                        .lineLimit(3)
                        .lineSpacing(3)
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 14)
        }
        .frame(width: cardWidth, height: cardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func highlightedTitle(_ text: String) -> Text {
        let parts = text.components(separatedBy: "**")
        var result = Text("")
        for (i, part) in parts.enumerated() {
            if part.isEmpty { continue }
            if i % 2 == 1 {
                result = result + Text(part)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(highlightColor)
            } else {
                result = result + Text(part)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        }
        return result
    }

    // MARK: - Dominant Color Extraction (same algorithm as explore page)

    private func extractColor(from url: URL) {
        if let cached = ArticleCardView.colorCache.object(forKey: url as NSURL) {
            dominantColor = Color(cached)
            return
        }

        Task.detached(priority: .background) {
            var uiImage: UIImage?
            for _ in 0..<15 {
                if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
                    uiImage = cached
                    break
                }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            if uiImage == nil {
                guard let (data, _) = try? await URLSession.shared.data(from: url),
                      let downloaded = UIImage(data: data) else { return }
                uiImage = downloaded
            }
            guard let uiImage, let cgImage = uiImage.cgImage else { return }

            let sampleW = min(cgImage.width, 80)
            let sampleH = min(cgImage.height, 80)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)

            guard let context = CGContext(
                data: &rawData, width: sampleW, height: sampleH,
                bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

            struct ColorBucket {
                var count: Int = 0
                var positions: Set<String> = []
                var rKey: Int
                var gKey: Int
                var bKey: Int
            }

            var buckets: [String: ColorBucket] = [:]
            let totalPixels = sampleW * sampleH

            for i in stride(from: 0, to: totalPixels * 4, by: 10 * 4) {
                let r = Int(rawData[i])
                let g = Int(rawData[i + 1])
                let b = Int(rawData[i + 2])
                let a = Int(rawData[i + 3])

                if a < 125 { continue }
                if r > 250 && g > 250 && b > 250 { continue }
                if r < 10 && g < 10 && b < 10 { continue }

                let rK = (r / 15) * 15
                let gK = (g / 15) * 15
                let bK = (b / 15) * 15
                let key = "\(rK),\(gK),\(bK)"

                let pixelIdx = i / 4
                let px = (pixelIdx % sampleW) / 10
                let py = (pixelIdx / sampleW) / 10

                if buckets[key] == nil {
                    buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK)
                }
                buckets[key]!.count += 1
                buckets[key]!.positions.insert("\(px),\(py)")
            }

            guard !buckets.isEmpty else { return }

            struct ScoredColor {
                let h: CGFloat, s: CGFloat, l: CGFloat
                let count: Int, coverage: Int
                var score: CGFloat = 0
            }

            let maxCount = CGFloat(buckets.values.map { $0.count }.max() ?? 1)
            let maxCoverage = CGFloat(buckets.values.map { $0.positions.count }.max() ?? 1)

            var candidates: [ScoredColor] = buckets.values.compactMap { bucket in
                let r = CGFloat(bucket.rKey) / 255.0
                let g = CGFloat(bucket.gKey) / 255.0
                let b = CGFloat(bucket.bKey) / 255.0
                let hsl = ArticleCardView.rgbToHSL(r, g, b)
                guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }
                return ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: bucket.count, coverage: bucket.positions.count)
            }

            if candidates.isEmpty {
                let fallback = buckets.values.max(by: {
                    ArticleCardView.rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255).s <
                    ArticleCardView.rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255).s
                })
                if let fb = fallback {
                    let hsl = ArticleCardView.rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                    candidates = [ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: fb.count, coverage: fb.positions.count)]
                }
            }

            guard !candidates.isEmpty else { return }

            for i in candidates.indices {
                let normFreq = CGFloat(candidates[i].count) / maxCount
                let normSat = candidates[i].s / 100.0
                let normCov = CGFloat(candidates[i].coverage) / maxCoverage
                var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20
                if candidates[i].h >= 200 && candidates[i].h <= 220 && candidates[i].s < 60 { score *= 0.85 }
                if candidates[i].h >= 15 && candidates[i].h <= 50 && candidates[i].s < 65 { score *= 0.7 }
                candidates[i].score = score
            }

            candidates.sort { $0.score > $1.score }
            let winner = candidates[0]

            let accentS = min(90.0, winner.s * 1.15)
            let accentL: CGFloat = winner.l <= 40
                ? 55.0 + (winner.l / 40.0) * 10.0
                : 65.0 + ((winner.l - 40.0) / 40.0) * 10.0
            let accentCol = ArticleCardView.colorFromHSL(
                h: winner.h,
                s: max(65.0, accentS),
                l: max(55.0, min(75.0, accentL))
            )

            ArticleCardView.colorCache.setObject(UIColor(accentCol), forKey: url as NSURL)

            await MainActor.run {
                withAnimation(.easeOut(duration: 0.3)) {
                    dominantColor = accentCol
                }
            }
        }
    }
}
