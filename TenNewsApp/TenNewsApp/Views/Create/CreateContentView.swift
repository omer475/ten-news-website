import SwiftUI
import PhotosUI
import MapKit

struct CreateContentView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppViewModel.self) private var appViewModel

    // Content state
    @State private var title = ""
    @State private var bullets: [String] = [""]
    @State private var tags: [String] = []
    @State private var tagInput = ""
    @State private var selectedCategory = "World"
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var coverImage: UIImage?

    // Details (3 stat boxes)
    @State private var detailLabels: [String] = ["", "", ""]
    @State private var detailValues: [String] = ["", "", ""]
    @State private var detailSubtitles: [String] = ["", "", ""]
    @State private var showDetails = false

    // Map location
    @State private var showMap = false
    @State private var showLocationPicker = false
    @State private var locationName = ""
    @State private var locationDetail = ""
    @State private var locationCoordinate: CLLocationCoordinate2D?

    // Flow state
    @State private var showPreview = false
    @State private var isPublishing = false
    @State private var publishError: String?
    @State private var highlightMode = false
    @FocusState private var focusedBullet: Int?
    @FocusState private var tagFieldFocused: Bool

    private let categories = [
        "World", "Politics", "Business", "Tech", "Science",
        "Health", "Sports", "Entertainment", "Climate",
        "AI", "Gaming", "Food", "Lifestyle", "Finance"
    ]

    private var canProceed: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty &&
        bullets.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })
    }

    private var cleanBullets: [String] {
        bullets.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    var body: some View {
        NavigationStack {
            if showPreview {
                previewStep
            } else {
                composeStep
            }
        }
        .onChange(of: selectedPhoto) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let image = UIImage(data: data) {
                    coverImage = image
                }
            }
        }
    }

    // MARK: - Step 1: Compose

    private var composeStep: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                coverImageSection
                    .padding(.bottom, 20)

                titleSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)

                bulletsSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)

                tagsSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)

                detailsSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)

                mapSection
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
            }
            .padding(.bottom, 100)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Create")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(.secondary)
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                        showPreview = true
                    }
                    HapticManager.medium()
                } label: {
                    HStack(spacing: 4) {
                        Text("Next")
                            .font(.system(size: 15, weight: .semibold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(canProceed ? .white : .white.opacity(0.4))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 7)
                    .background(canProceed ? Color.blue : Color.blue.opacity(0.3), in: Capsule())
                }
                .disabled(!canProceed)
            }
        }
        .background(Theme.Colors.backgroundPrimary)
    }

    // MARK: - Step 2: Preview

    private var previewStep: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 16) {
                // Highlight toggle
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        highlightMode.toggle()
                    }
                    HapticManager.selection()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: highlightMode ? "pencil.line" : "pencil")
                            .font(.system(size: 13, weight: .semibold))
                        Text(highlightMode ? "Done Highlighting" : "Highlight Words")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(highlightMode ? .white : .blue)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(highlightMode ? Color.blue : Color.blue.opacity(0.12), in: Capsule())
                }
                .padding(.top, 8)

                if highlightMode {
                    Text("Tap any word in the title or bullets to highlight it")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                // Preview card
                previewCard
                    .padding(.horizontal, 16)

                // Tags preview
                if !tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(tags, id: \.self) { tag in
                                Text("#\(tag)")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.blue)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }

                Spacer().frame(height: 60)
            }
        }
        .navigationTitle("Preview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) {
                        showPreview = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .bold))
                        Text("Edit")
                            .font(.system(size: 15, weight: .medium))
                    }
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    publish()
                } label: {
                    HStack(spacing: 5) {
                        if isPublishing {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.7)
                        }
                        Text("Publish")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 7)
                    .background(Color.blue, in: Capsule())
                }
                .disabled(isPublishing)
            }
        }
        .background(Theme.Colors.backgroundPrimary)
    }

    // MARK: - Preview Card (mimics feed card)

    @State private var previewDominantColor: Color?
    @State private var highlightedWords: Set<String> = []

    private var previewCard: some View {
        let screenW = UIScreen.main.bounds.width - 32
        let imageH: CGFloat = screenW * 0.65

        return VStack(alignment: .leading, spacing: 0) {
            // Image + gradient
            ZStack(alignment: .bottom) {
                if let image = coverImage {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: screenW, height: imageH)
                        .clipped()
                        .onAppear { extractPreviewColor() }
                } else {
                    Rectangle()
                        .fill(LinearGradient(
                            colors: [.blue.opacity(0.4), .blue.opacity(0.15), Color(white: 0.08)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .frame(width: screenW, height: imageH)
                }

                // Blur gradient
                Rectangle()
                    .fill(LinearGradient(
                        stops: [
                            .init(color: previewBlurColor.opacity(0), location: 0),
                            .init(color: previewBlurColor.opacity(0.3), location: 0.3),
                            .init(color: previewBlurColor.opacity(0.7), location: 0.55),
                            .init(color: previewBlurColor, location: 0.8),
                        ],
                        startPoint: .top, endPoint: .bottom
                    ))
                    .frame(height: imageH * 0.7)
            }
            .frame(height: imageH)

            // Title (tap words to highlight)
            VStack(alignment: .leading, spacing: 4) {
                Text(selectedCategory)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white.opacity(0.5))
                    .tracking(1)

                tappableText(title, fontSize: 26, fontWeight: .bold,
                             baseColor: .white, highlightColor: previewDominantColor ?? .blue)
                    .lineSpacing(2)
            }
            .padding(.horizontal, 16)
            .padding(.top, -50)
            .padding(.bottom, 16)

            // Bullets (tap words to highlight)
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(cleanBullets.enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(previewDominantColor ?? .blue)
                            .frame(width: 5, height: 5)
                            .padding(.top, 8)
                        tappableText(bullet, fontSize: 16, fontWeight: .regular,
                                     baseColor: .white.opacity(0.75), highlightColor: .white.opacity(0.95))
                            .lineSpacing(4)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, hasDetails || locationCoordinate != nil ? 12 : 20)

            // Info box area — exact same design as ArticleCardView
            if hasDetails || locationCoordinate != nil {
                HStack(spacing: 8) {
                    if hasDetails {
                        // Details info box — matches detailsInfoBox exactly
                        GlassEffectContainer {
                            HStack(spacing: 0) {
                                let activeDetails = (0..<3).filter {
                                    !detailLabels[$0].trimmingCharacters(in: .whitespaces).isEmpty
                                }
                                ForEach(Array(activeDetails.enumerated()), id: \.element) { idx, i in
                                    if idx > 0 {
                                        Rectangle().fill(.white.opacity(0.12)).frame(width: 1)
                                            .padding(.vertical, 12)
                                    }
                                    VStack(spacing: 3) {
                                        Text(detailLabels[i].uppercased())
                                            .font(.system(size: 8, weight: .bold))
                                            .foregroundStyle(.white.opacity(0.5))
                                            .lineLimit(1)
                                            .tracking(0.5)
                                        Text(detailValues[i])
                                            .font(.system(size: 22, weight: .heavy, design: .rounded))
                                            .foregroundStyle(previewDominantColor ?? .blue)
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.5)
                                        if !detailSubtitles[i].trimmingCharacters(in: .whitespaces).isEmpty {
                                            Text(detailSubtitles[i])
                                                .font(.system(size: 9, weight: .medium))
                                                .foregroundStyle(.white.opacity(0.4))
                                        }
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }
                            .frame(height: 85)
                            .glassEffect(.regular.tint(.black.opacity(0.15)).interactive(), in: RoundedRectangle(cornerRadius: 22))
                        }
                    }

                    if let coord = locationCoordinate, !hasDetails {
                        // Map info box — matches compactMap exactly
                        previewMapBox(coord: coord)
                    }

                    // Mode switcher column (when both exist)
                    if hasDetails && locationCoordinate != nil {
                        GlassEffectContainer {
                            VStack(spacing: 0) {
                                Image(systemName: "square.grid.2x2")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(previewDominantColor ?? .blue)
                                    .frame(width: 28, height: 28)
                                Image(systemName: "map.fill")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                                    .frame(width: 28, height: 28)
                            }
                            .padding(.vertical, 2)
                            .glassEffect(.regular.tint(.black.opacity(0.15)), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .environment(\.colorScheme, .dark)
            }

            // Map shown below details when both exist
            if hasDetails, let coord = locationCoordinate {
                previewMapBox(coord: coord)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                    .environment(\.colorScheme, .dark)
            }
        }
        .background(previewBlurColor)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func previewMapBox(coord: CLLocationCoordinate2D) -> some View {
        let region = MKCoordinateRegion(
            center: coord,
            span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        )
        let detail = [locationName, locationDetail].filter { !$0.isEmpty }.joined(separator: ", ")

        return Map(initialPosition: .region(region), interactionModes: []) {
            Annotation("", coordinate: coord) {
                VStack(spacing: 2) {
                    Circle()
                        .fill(previewDominantColor ?? .blue)
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
                    if !locationName.isEmpty {
                        Text(locationName)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .frame(height: 85)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay(alignment: .topTrailing) {
            Image(systemName: "arrow.up.left.and.arrow.down.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(.ultraThinMaterial)
                .clipShape(Circle())
                .padding(8)
        }
        .overlay(alignment: .bottomLeading) {
            HStack(spacing: 5) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(previewDominantColor ?? .blue)
                Text(detail)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .padding(8)
        }
    }

    private var previewBlurColor: Color {
        previewDominantColor.map { color in
            // Darken the dominant color for background
            let uiColor = UIColor(color)
            var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            uiColor.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
            return Color(hue: Double(h), saturation: Double(min(s * 0.6, 0.5)), brightness: Double(max(b * 0.15, 0.06)))
        } ?? Color(white: 0.08)
    }

    private func extractPreviewColor() {
        guard let image = coverImage, let cgImage = image.cgImage else { return }
        Task.detached {
            let sampleW = min(cgImage.width, 60)
            let sampleH = min(cgImage.height, 60)
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)
            guard let context = CGContext(
                data: &rawData, width: sampleW, height: sampleH,
                bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ) else { return }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

            var bestR: CGFloat = 0, bestG: CGFloat = 0, bestB: CGFloat = 0, bestScore: CGFloat = -1
            var buckets: [String: (r: Int, g: Int, b: Int, count: Int)] = [:]
            for i in stride(from: 0, to: sampleW * sampleH * 4, by: 8 * 4) {
                let r = Int(rawData[i]), g = Int(rawData[i+1]), b = Int(rawData[i+2])
                if r > 245 && g > 245 && b > 245 { continue }
                if r < 15 && g < 15 && b < 15 { continue }
                let rK = (r/20)*20, gK = (g/20)*20, bK = (b/20)*20
                let key = "\(rK),\(gK),\(bK)"
                let entry = buckets[key] ?? (rK, gK, bK, 0)
                buckets[key] = (entry.r, entry.g, entry.b, entry.count + 1)
            }
            let maxCount = CGFloat(buckets.values.map(\.count).max() ?? 1)
            for (_, bucket) in buckets {
                let hsl = ArticleCardView.rgbToHSL(CGFloat(bucket.r)/255, CGFloat(bucket.g)/255, CGFloat(bucket.b)/255)
                let isBrown = hsl.h >= 20 && hsl.h <= 55 && hsl.s < 50
                var score = (CGFloat(bucket.count) / maxCount) * 0.4 + (hsl.s / 100) * 0.5
                if hsl.s >= 40 && (hsl.h >= 180 && hsl.h <= 300) { score *= 1.3 }
                if isBrown { score *= 0.3 }
                if score > bestScore {
                    bestScore = score
                    bestR = CGFloat(bucket.r)/255; bestG = CGFloat(bucket.g)/255; bestB = CGFloat(bucket.b)/255
                }
            }
            let winHSL = ArticleCardView.rgbToHSL(bestR, bestG, bestB)
            let accent = ArticleCardView.colorFromHSL(h: winHSL.h, s: max(65, min(90, winHSL.s * 1.15)), l: max(55, min(75, winHSL.l)))
            await MainActor.run {
                withAnimation(.easeOut(duration: 0.3)) {
                    previewDominantColor = accent
                }
            }
        }
    }

    // MARK: - Tappable Text (word highlight selection)

    private func tappableText(_ text: String, fontSize: CGFloat, fontWeight: Font.Weight,
                               baseColor: Color, highlightColor: Color) -> some View {
        let words = text.split(separator: " ").map(String.init)
        let rendered = words.reduce(Text("")) { result, word in
            let isHighlighted = highlightedWords.contains(word.lowercased())
            let separator = result == Text("") ? Text("") : Text(" ")
            let highlightWeight: Font.Weight = fontWeight == .bold ? .bold : .semibold
            let wordText = Text(word)
                .font(.system(size: fontSize, weight: isHighlighted ? highlightWeight : fontWeight))
                .foregroundColor(isHighlighted ? highlightColor : baseColor)
            return result + separator + wordText
        }

        return rendered
            .overlay {
                if highlightMode {
                    WordTapOverlay(text: text, fontSize: fontSize, fontWeight: fontWeight, onTap: { word in
                        let key = word.lowercased()
                        withAnimation(.easeOut(duration: 0.15)) {
                            if highlightedWords.contains(key) {
                                highlightedWords.remove(key)
                            } else {
                                highlightedWords.insert(key)
                            }
                        }
                        HapticManager.selection()
                    })
                }
            }
    }

    // MARK: - Cover Image

    private var coverImageSection: some View {
        PhotosPicker(selection: $selectedPhoto, matching: .images) {
            if let image = coverImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(maxWidth: .infinity)
                    .frame(height: 220)
                    .clipped()
                    .overlay(alignment: .bottomTrailing) {
                        HStack(spacing: 6) {
                            Image(systemName: "photo")
                                .font(.system(size: 12, weight: .semibold))
                            Text("Change")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(16)
                    }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 36, weight: .light))
                        .foregroundStyle(.secondary)
                    Text("Add Cover Photo")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 220)
                .background(.fill.tertiary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Title

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("TITLE")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .tracking(1)

            TextField("Write a compelling headline...", text: $title, axis: .vertical)
                .font(.system(size: 24, weight: .bold))
                .lineLimit(1...4)
                .textInputAutocapitalization(.words)
        }
    }

    // MARK: - Category

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("CATEGORY")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .tracking(1)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(categories, id: \.self) { cat in
                        Button {
                            selectedCategory = cat
                            HapticManager.selection()
                        } label: {
                            Text(cat)
                                .font(.system(size: 14, weight: selectedCategory == cat ? .bold : .medium))
                                .foregroundStyle(selectedCategory == cat ? .white : .primary)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(
                                    selectedCategory == cat ? Color.blue : Color(.systemGray5),
                                    in: Capsule()
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Bullets

    private var bulletsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("BULLETS")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .tracking(1)
                Spacer()
                Text("\(cleanBullets.count) bullets")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.tertiary)
            }

            VStack(spacing: 0) {
                ForEach(Array(bullets.enumerated()), id: \.offset) { index, _ in
                    bulletRow(index: index)
                    if index < bullets.count - 1 {
                        Divider().padding(.leading, 44)
                    }
                }
            }
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))

            Button {
                bullets.append("")
                focusedBullet = bullets.count - 1
                HapticManager.light()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.blue)
                    Text("Add Bullet")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.blue)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)
        }
    }

    private func bulletRow(index: Int) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text("\(index + 1)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)
                .frame(width: 24, height: 24)
                .background(.fill.quaternary, in: Circle())

            TextField("Add a bullet...", text: $bullets[index], axis: .vertical)
                .font(.system(size: 16))
                .lineLimit(1...6)
                .focused($focusedBullet, equals: index)
                .onSubmit {
                    if index == bullets.count - 1 {
                        bullets.append("")
                        focusedBullet = bullets.count - 1
                    } else {
                        focusedBullet = index + 1
                    }
                }

            if bullets.count > 1 {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        bullets.remove(at: index)
                    }
                    HapticManager.light()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.quaternary)
                }
                .buttonStyle(.plain)
                .padding(.top, 12)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    // MARK: - Tags

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("TAGS")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .tracking(1)

            // Existing tags
            if !tags.isEmpty {
                TagFlowLayout(spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.blue)
                            Button {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    tags.removeAll { $0 == tag }
                                }
                                HapticManager.light()
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(.blue.opacity(0.1), in: Capsule())
                    }
                }
            }

            // Tag input
            HStack(spacing: 10) {
                Text("#")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.secondary)

                TextField("Add a tag...", text: $tagInput)
                    .font(.system(size: 16))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .focused($tagFieldFocused)
                    .onSubmit { addTag() }

                if !tagInput.isEmpty {
                    Button {
                        addTag()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func addTag() {
        let cleaned = tagInput
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: " ", with: "")
            .lowercased()
        guard !cleaned.isEmpty, !tags.contains(cleaned), tags.count < 10 else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            tags.append(cleaned)
        }
        tagInput = ""
        tagFieldFocused = true
        HapticManager.light()
    }

    // MARK: - Details Section

    private var hasDetails: Bool {
        detailLabels.enumerated().contains { idx, label in
            !label.trimmingCharacters(in: .whitespaces).isEmpty &&
            !detailValues[idx].trimmingCharacters(in: .whitespaces).isEmpty
        }
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.spring(response: 0.3)) {
                    showDetails.toggle()
                }
                HapticManager.light()
            } label: {
                HStack {
                    Text("KEY STATS")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(1)
                    Spacer()
                    HStack(spacing: 4) {
                        Text(showDetails ? "Hide" : "Add")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.blue)
                        Image(systemName: showDetails ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.blue)
                    }
                }
            }
            .buttonStyle(.plain)

            if showDetails {
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { index in
                        detailInputRow(index: index)
                    }
                }
                .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private func detailInputRow(index: Int) -> some View {
        VStack(spacing: 0) {
            if index > 0 {
                Divider().padding(.horizontal, 14)
            }
            VStack(alignment: .leading, spacing: 6) {
                TextField("Label (e.g. GDP Growth)", text: $detailLabels[index])
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .textInputAutocapitalization(.words)

                HStack(spacing: 8) {
                    TextField("Value (e.g. 3.2%)", text: $detailValues[index])
                        .font(.system(size: 20, weight: .heavy, design: .rounded))

                    TextField("Unit", text: $detailSubtitles[index])
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .frame(width: 80)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
    }

    // MARK: - Map Section

    private var mapSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.spring(response: 0.3)) {
                    showMap.toggle()
                }
                HapticManager.light()
            } label: {
                HStack {
                    Text("LOCATION")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .tracking(1)
                    Spacer()
                    HStack(spacing: 4) {
                        Text(showMap ? "Hide" : "Add")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.blue)
                        Image(systemName: showMap ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.blue)
                    }
                }
            }
            .buttonStyle(.plain)

            if showMap {
                VStack(spacing: 0) {
                    // Selected location display or picker button
                    if let coord = locationCoordinate {
                        // Show selected location with mini map
                        Map {
                            Annotation(locationName, coordinate: coord) {
                                Circle()
                                    .fill(.blue)
                                    .frame(width: 12, height: 12)
                                    .overlay(Circle().stroke(.white, lineWidth: 2))
                                    .shadow(radius: 3)
                            }
                        }
                        .frame(height: 140)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .disabled(true)
                        .overlay(alignment: .bottom) {
                            HStack(spacing: 6) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(.blue)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(locationName)
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1)
                                    if !locationDetail.isEmpty {
                                        Text(locationDetail)
                                            .font(.system(size: 11))
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                Spacer()
                                Button {
                                    showLocationPicker = true
                                    HapticManager.light()
                                } label: {
                                    Text("Change")
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(.blue)
                                }
                            }
                            .padding(10)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                            .padding(6)
                        }
                    } else {
                        Button {
                            showLocationPicker = true
                            HapticManager.light()
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "mappin.and.ellipse")
                                    .font(.system(size: 20))
                                    .foregroundStyle(.blue)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Select Location")
                                        .font(.system(size: 15, weight: .medium))
                                    Text("Search for a place on the map")
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.tertiary)
                            }
                            .padding(14)
                            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .sheet(isPresented: $showLocationPicker) {
                    LocationPickerView(
                        locationName: $locationName,
                        locationDetail: $locationDetail,
                        coordinate: $locationCoordinate
                    )
                }
                .alert("Publish Failed", isPresented: Binding(
                    get: { publishError != nil },
                    set: { if !$0 { publishError = nil } }
                )) {
                    Button("OK") { publishError = nil }
                } message: {
                    Text(publishError ?? "Something went wrong. Please try again.")
                }
            }
        }
    }

    // MARK: - Publish

    private func publish() {
        guard canProceed else { return }
        isPublishing = true
        HapticManager.medium()

        Task {
            var imageUrlString: String? = nil
            if let image = coverImage, let imageData = image.jpegData(compressionQuality: 0.8) {
                imageUrlString = await uploadImage(imageData)
            }

            // Build details array
            var detailsArray: [[String: String]] = []
            for i in 0..<3 {
                let label = detailLabels[i].trimmingCharacters(in: .whitespaces)
                let value = detailValues[i].trimmingCharacters(in: .whitespaces)
                if !label.isEmpty && !value.isEmpty {
                    var detail: [String: String] = ["label": label, "value": value]
                    let sub = detailSubtitles[i].trimmingCharacters(in: .whitespaces)
                    if !sub.isEmpty { detail["subtitle"] = sub }
                    detailsArray.append(detail)
                }
            }

            // Build map data
            var mapData: [String: Any]? = nil
            if let coord = locationCoordinate {
                mapData = [
                    "name": locationName,
                    "location": locationDetail,
                    "locations": [["name": locationName, "lat": coord.latitude, "lng": coord.longitude]]
                ]
            }

            // Apply ** markers to highlighted words
            let markedTitle = applyHighlights(to: title.trimmingCharacters(in: .whitespaces))
            let markedBullets = cleanBullets.map { applyHighlights(to: $0) }

            var body: [String: Any] = [
                "title": markedTitle,
                "bullets": markedBullets,
                "category": selectedCategory,
                "tags": tags,
                "image_url": imageUrlString ?? "",
                "user_id": appViewModel.currentUser?.id ?? "",
                "author_name": appViewModel.currentUser?.displayName ?? "Anonymous"
            ]
            if !detailsArray.isEmpty { body["details"] = detailsArray }
            if let mapData { body["map"] = mapData }

            do {
                guard let jsonData = try? JSONSerialization.data(withJSONObject: body),
                      let url = URL(string: APIEndpoints.baseURL + APIEndpoints.contentCreate) else {
                    isPublishing = false
                    return
                }

                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.httpBody = jsonData
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = KeychainManager.shared.accessToken {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }

                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, http.statusCode >= 200 && http.statusCode < 300 {
                    await MainActor.run {
                        isPublishing = false
                        HapticManager.success()
                        dismiss()
                    }
                } else {
                    await MainActor.run {
                        isPublishing = false
                        publishError = "Server returned an error. Please try again."
                        HapticManager.error()
                    }
                }
            } catch {
                await MainActor.run {
                    isPublishing = false
                    publishError = "Network error. Check your connection and try again."
                    HapticManager.error()
                }
            }
        }
    }

    private func applyHighlights(to text: String) -> String {
        text.split(separator: " ").map { word in
            let w = String(word)
            if highlightedWords.contains(w.lowercased()) {
                return "**\(w)**"
            }
            return w
        }.joined(separator: " ")
    }

    private func uploadImage(_ data: Data) async -> String? {
        guard let url = URL(string: APIEndpoints.baseURL + APIEndpoints.contentUploadImage) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = KeychainManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"cover.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        guard let (responseData, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
              let imageUrl = json["url"] as? String else {
            return nil
        }
        return imageUrl
    }
}

// MARK: - Flow Layout (for tags)

// MARK: - Word Tap Overlay

private struct WordTapOverlay: UIViewRepresentable {
    let text: String
    let fontSize: CGFloat
    let fontWeight: Font.Weight
    let onTap: (String) -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        // Remove old subviews
        uiView.subviews.forEach { $0.removeFromSuperview() }

        let words = text.split(separator: " ").map(String.init)
        let font = UIFont.systemFont(ofSize: fontSize, weight: .regular)
        let spaceWidth = " ".size(withAttributes: [.font: font]).width

        var x: CGFloat = 0
        var y: CGFloat = 0
        let maxWidth = uiView.bounds.width > 0 ? uiView.bounds.width : UIScreen.main.bounds.width - 64

        for word in words {
            let wordSize = word.size(withAttributes: [.font: font])
            if x + wordSize.width > maxWidth && x > 0 {
                x = 0
                y += wordSize.height + 4
            }

            let button = UIButton(type: .system)
            button.frame = CGRect(x: x, y: y, width: wordSize.width + 2, height: wordSize.height + 4)
            button.setTitle(word, for: .normal)
            button.setTitleColor(.clear, for: .normal)
            button.titleLabel?.font = font
            button.addAction(UIAction { _ in onTap(word) }, for: .touchUpInside)
            uiView.addSubview(button)

            x += wordSize.width + spaceWidth
        }
    }
}

private struct TagFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (positions, CGSize(width: maxWidth, height: y + rowHeight))
    }
}
