import SwiftUI
import UIKit

/// Instagram/TikTok-style circular photo crop screen.
struct ProfilePhotoCropView: View {
    let image: UIImage
    let onSave: (UIImage) -> Void
    let onCancel: () -> Void

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var showGrid = false

    var body: some View {
        GeometryReader { geo in
            let screenW = geo.size.width
            let screenH = geo.size.height
            let circleSize = screenW - 48

            ZStack {
                Color(white: 0.08).ignoresSafeArea()

                // Photo layer
                photoLayer(screenW: screenW, circleSize: circleSize)

                // Dimmed mask with circle cutout
                CropMask(circleSize: circleSize)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                // Grid lines (show while dragging)
                if showGrid {
                    GridOverlay(circleSize: circleSize)
                        .allowsHitTesting(false)
                        .transition(.opacity)
                }

                // Circle border
                Circle()
                    .stroke(.white.opacity(0.5), lineWidth: 1.5)
                    .frame(width: circleSize, height: circleSize)
                    .allowsHitTesting(false)

                // Top bar
                VStack(spacing: 0) {
                    topBar(circleSize: circleSize, screenW: screenW, screenH: screenH)
                    Spacer()
                    bottomControls(circleSize: circleSize, screenW: screenW, screenH: screenH)
                }
            }
        }
        .ignoresSafeArea()
        .statusBarHidden()
    }

    // MARK: - Photo Layer

    private func photoLayer(screenW: CGFloat, circleSize: CGFloat) -> some View {
        let imgAspect = image.size.height / image.size.width
        let baseH = screenW * imgAspect

        return Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: screenW * scale, height: max(baseH, screenW) * scale)
            .offset(offset)
            .gesture(
                DragGesture()
                    .onChanged { v in
                        withAnimation(.interactiveSpring) { showGrid = true }
                        offset = CGSize(
                            width: lastOffset.width + v.translation.width,
                            height: lastOffset.height + v.translation.height
                        )
                    }
                    .onEnded { _ in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            showGrid = false
                            clampOffset(circleSize: circleSize, imageBaseSize: max(baseH, screenW))
                        }
                    }
            )
            .simultaneousGesture(
                MagnificationGesture()
                    .onChanged { v in
                        withAnimation(.interactiveSpring) { showGrid = true }
                        scale = min(max(lastScale * v, 1.0), 5.0)
                    }
                    .onEnded { _ in
                        if scale < 1.0 { scale = 1.0 }
                        lastScale = scale
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            showGrid = false
                            clampOffset(circleSize: circleSize, imageBaseSize: max(baseH, screenW))
                        }
                    }
            )
    }

    // MARK: - Top Bar

    private func topBar(circleSize: CGFloat, screenW: CGFloat, screenH: CGFloat) -> some View {
        HStack {
            Button { onCancel() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(.white.opacity(0.1), in: Circle())
            }

            Spacer()

            Text("Crop Photo")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)

            Spacer()

            Button {
                saveCroppedImage(circleSize: circleSize, screenW: screenW, screenH: screenH)
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor, in: Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 60)
    }

    // MARK: - Bottom Controls

    private func bottomControls(circleSize: CGFloat, screenW: CGFloat, screenH: CGFloat) -> some View {
        VStack(spacing: 16) {
            // Zoom indicator
            HStack(spacing: 8) {
                Image(systemName: "minus.magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))

                // Zoom slider track
                GeometryReader { sliderGeo in
                    let progress = (scale - 1.0) / 4.0 // 1x-5x mapped to 0-1
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.white.opacity(0.15))
                            .frame(height: 3)

                        Capsule()
                            .fill(.white.opacity(0.6))
                            .frame(width: sliderGeo.size.width * progress, height: 3)

                        Circle()
                            .fill(.white)
                            .frame(width: 14, height: 14)
                            .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
                            .offset(x: sliderGeo.size.width * progress - 7)
                    }
                }
                .frame(height: 14)

                Image(systemName: "plus.magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(.horizontal, 60)

            // Zoom percentage
            Text("\(Int(scale * 100))%")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.35))

            // Reset button
            if scale > 1.01 || abs(offset.width) > 1 || abs(offset.height) > 1 {
                Button {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        scale = 1.0
                        lastScale = 1.0
                        offset = .zero
                        lastOffset = .zero
                    }
                } label: {
                    Text("Reset")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.08), in: Capsule())
                }
            }
        }
        .padding(.bottom, 50)
    }

    // MARK: - Clamp

    private func clampOffset(circleSize: CGFloat, imageBaseSize: CGFloat) {
        let scaledSize = imageBaseSize * scale
        let maxX = max((scaledSize - circleSize) / 2, 0)
        let maxY = max((scaledSize - circleSize) / 2, 0)
        offset.width = min(max(offset.width, -maxX), maxX)
        offset.height = min(max(offset.height, -maxY), maxY)
        lastOffset = offset
    }

    // MARK: - Crop & Save

    private func saveCroppedImage(circleSize: CGFloat, screenW: CGFloat, screenH: CGFloat) {
        let outputPx: CGFloat = 512

        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: outputPx, height: outputPx)
        )

        let result = renderer.image { _ in
            let imgW = image.size.width
            let imgH = image.size.height

            let fillScale: CGFloat
            if imgW / imgH > 1 {
                fillScale = screenW / imgH
            } else {
                fillScale = screenW / imgW
            }

            let ratio = outputPx / circleSize
            let drawW = imgW * fillScale * scale * ratio
            let drawH = imgH * fillScale * scale * ratio
            let drawX = (outputPx - drawW) / 2 + offset.width * ratio
            let drawY = (outputPx - drawH) / 2 + offset.height * ratio

            image.draw(in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
        }

        onSave(result)
    }
}

// MARK: - Crop mask (dimmed overlay with circle cutout)

private struct CropMask: View {
    let circleSize: CGFloat

    var body: some View {
        GeometryReader { geo in
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let circleRect = CGRect(
                x: center.x - circleSize / 2,
                y: center.y - circleSize / 2,
                width: circleSize,
                height: circleSize
            )

            Path { p in
                p.addRect(CGRect(origin: .zero, size: geo.size))
                p.addEllipse(in: circleRect)
            }
            .fill(style: FillStyle(eoFill: true))
            .foregroundStyle(.black.opacity(0.55))
        }
    }
}

// MARK: - Grid overlay (visible while adjusting)

private struct GridOverlay: View {
    let circleSize: CGFloat

    var body: some View {
        let third = circleSize / 3

        ZStack {
            // Vertical lines
            ForEach(1..<3, id: \.self) { i in
                Rectangle()
                    .fill(.white.opacity(0.2))
                    .frame(width: 0.5, height: circleSize)
                    .offset(x: CGFloat(i) * third - circleSize / 2)
            }

            // Horizontal lines
            ForEach(1..<3, id: \.self) { i in
                Rectangle()
                    .fill(.white.opacity(0.2))
                    .frame(width: circleSize, height: 0.5)
                    .offset(y: CGFloat(i) * third - circleSize / 2)
            }
        }
        .clipShape(Circle())
        .frame(width: circleSize, height: circleSize)
    }
}
