import SwiftUI
import UIKit

/// Namespace for image-derived color extraction shared by SearchTabView and
/// ChatDetailView. Originally lived as `static` members on `ArticleCardView`;
/// the per-article full-page UI was deleted as part of the continuous-feed
/// migration, but the algorithm (and its cache instances) is still load-bearing
/// for the article-preview color tinting on other surfaces. Kept under the
/// `ArticleCardView` name so callers do not need to change.
enum ArticleCardView {
    // MARK: - Dominant Color Extraction (website-matching algorithm)

    /// RGB → HSL conversion (0-360, 0-100, 0-100)
    nonisolated static func rgbToHSL(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> (h: CGFloat, s: CGFloat, l: CGFloat) {
        let maxC = max(r, g, b)
        let minC = min(r, g, b)
        var h: CGFloat = 0
        var s: CGFloat = 0
        let l = (maxC + minC) / 2.0

        if maxC != minC {
            let d = maxC - minC
            s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC)
            if maxC == r {
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6.0
            } else if maxC == g {
                h = ((b - r) / d + 2) / 6.0
            } else {
                h = ((r - g) / d + 4) / 6.0
            }
        }
        return (h * 360, s * 100, l * 100)
    }

    /// HSL → SwiftUI Color (converts HSL to HSB for Color init)
    nonisolated static func colorFromHSL(h: CGFloat, s: CGFloat, l: CGFloat) -> Color {
        let hNorm = h / 360.0
        let sNorm = s / 100.0
        let lNorm = l / 100.0
        // HSL → HSB conversion
        let v = lNorm + sNorm * min(lNorm, 1 - lNorm)
        let sB = v > 0 ? 2.0 * (1.0 - lNorm / v) : 0.0
        return Color(hue: Double(hNorm), saturation: Double(sB), brightness: Double(v))
    }

    /// Cache for extracted colors so we don't recompute on every appear
    nonisolated(unsafe) static let colorCache = NSCache<NSURL, UIColor>()
    nonisolated(unsafe) static let blurColorCache = NSCache<NSURL, UIColor>()
    nonisolated(unsafe) static let lightnessCache = NSCache<NSURL, NSNumber>()

    /// Shared color extraction used by the article page and every card preview
    /// (ExploreArticleCard, SearchResultCard, …). Ensures the blur tint and
    /// highlight color shown on a preview card exactly match what the user will
    /// see when the full article opens — same cache, same algorithm, one source
    /// of truth.
    ///
    /// Returns the accent color, blur color, and a lightness flag used by the
    /// full article view for icon contrast. Results are written to the three
    /// shared NSCaches so the next caller hits cache.
    nonisolated static func extractAndCacheColors(
        url: URL,
        loadedImage: UIImage?
    ) async -> (accent: UIColor, blur: UIColor, isLight: Bool)? {
        // Fast path: everything cached
        if let accent = colorCache.object(forKey: url as NSURL),
           let blur = blurColorCache.object(forKey: url as NSURL),
           let light = lightnessCache.object(forKey: url as NSURL) {
            return (accent, blur, light.boolValue)
        }

        // Acquire a UIImage — provided, from the image cache, or by downloading.
        let uiImage: UIImage
        if let provided = loadedImage {
            uiImage = provided
        } else if let cached = AsyncCachedImage.cache.object(forKey: url as NSURL) {
            uiImage = cached
        } else {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let downloaded = UIImage(data: data) else { return nil }
            AsyncCachedImage.cache.setObject(downloaded, forKey: url as NSURL)
            uiImage = downloaded
        }
        guard let cgImage = uiImage.cgImage else { return nil }

        let sampleW = min(cgImage.width, 80)
        let sampleH = min(cgImage.height, 80)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        var rawData = [UInt8](repeating: 0, count: sampleW * sampleH * 4)

        guard let context = CGContext(
            data: &rawData, width: sampleW, height: sampleH,
            bitsPerComponent: 8, bytesPerRow: sampleW * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: sampleW, height: sampleH))

        struct ColorBucket {
            var count: Int = 0
            var bottomCount: Int = 0
            var positions: Set<String> = []
            var rKey: Int
            var gKey: Int
            var bKey: Int
        }

        var buckets: [String: ColorBucket] = [:]
        let totalPixels = sampleW * sampleH
        let bottomStart = sampleH / 2

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
            let isBottom = (pixelIdx / sampleW) >= bottomStart

            if buckets[key] == nil {
                buckets[key] = ColorBucket(rKey: rK, gKey: gK, bKey: bK)
            }
            buckets[key]!.count += 1
            if isBottom { buckets[key]!.bottomCount += 1 }
            buckets[key]!.positions.insert("\(px),\(py)")
        }

        guard !buckets.isEmpty else { return nil }

        // --- Accent color ---
        struct ScoredColor {
            let h: CGFloat
            let s: CGFloat
            let l: CGFloat
            let count: Int
            let coverage: Int
            var score: CGFloat = 0
        }

        let maxCount = CGFloat(buckets.values.map { $0.count }.max() ?? 1)
        let maxCoverage = CGFloat(buckets.values.map { $0.positions.count }.max() ?? 1)

        // --- Preferred hue family (feed v11) ---
        //
        // The accent picker (whole image) and blur picker (bottom half)
        // can land on different hue families when the image has a small
        // saturated region in the upper portion (e.g. warm bokeh lights
        // above a desk in a dark navy office). 2026-04-26 21:42 Thomson
        // Reuters card hit this — orange highlight on a navy background.
        //
        // Snapshot the dominant SATURATED hue from the bottom half before
        // accent scoring runs, then bias accent candidates toward that
        // family. Same single-color-family principle Apple Music, Spotify,
        // and TikTok use on auto-tinted card backgrounds.
        let preferredHueFamily: CGFloat? = {
            let scored = buckets.values
                .filter { $0.bottomCount > 0 }
                .map { (b: ColorBucket) -> (h: CGFloat, s: CGFloat, score: CGFloat) in
                    let hsl = rgbToHSL(CGFloat(b.rKey) / 255.0,
                                       CGFloat(b.gKey) / 255.0,
                                       CGFloat(b.bKey) / 255.0)
                    return (hsl.h, hsl.s, CGFloat(b.bottomCount) * (hsl.s / 100.0))
                }
                .filter { $0.s >= 25 }
                .sorted { $0.score > $1.score }
            return scored.first?.h
        }()

        var accentCandidates: [ScoredColor] = buckets.values.compactMap { bucket in
            let r = CGFloat(bucket.rKey) / 255.0
            let g = CGFloat(bucket.gKey) / 255.0
            let b = CGFloat(bucket.bKey) / 255.0
            let hsl = rgbToHSL(r, g, b)
            guard hsl.s >= 35 && hsl.l >= 20 && hsl.l <= 80 else { return nil }
            return ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: bucket.count, coverage: bucket.positions.count)
        }

        if accentCandidates.isEmpty {
            let fallback = buckets.values.max(by: {
                rgbToHSL(CGFloat($0.rKey)/255, CGFloat($0.gKey)/255, CGFloat($0.bKey)/255).s <
                rgbToHSL(CGFloat($1.rKey)/255, CGFloat($1.gKey)/255, CGFloat($1.bKey)/255).s
            })
            if let fb = fallback {
                let hsl = rgbToHSL(CGFloat(fb.rKey)/255, CGFloat(fb.gKey)/255, CGFloat(fb.bKey)/255)
                accentCandidates = [ScoredColor(h: hsl.h, s: hsl.s, l: hsl.l, count: fb.count, coverage: fb.positions.count)]
            }
        }

        guard !accentCandidates.isEmpty else { return nil }

        for i in accentCandidates.indices {
            let normFreq = CGFloat(accentCandidates[i].count) / maxCount
            let normSat = accentCandidates[i].s / 100.0
            let normCov = CGFloat(accentCandidates[i].coverage) / maxCoverage
            var score = normFreq * 0.50 + normSat * 0.30 + normCov * 0.20
            if accentCandidates[i].h >= 200 && accentCandidates[i].h <= 220 && accentCandidates[i].s < 60 { score *= 0.85 }
            if accentCandidates[i].h >= 15 && accentCandidates[i].h <= 50 && accentCandidates[i].s < 65 { score *= 0.7 }

            // Hue-family coupling (feed v11) — boost candidates within ±45°
            // of the bottom-half dominant hue, penalise candidates more
            // than 90° away. Locks accent and blur into the same color
            // family. Wrap-around-aware so reds at h=355 sit next to
            // reds at h=5.
            if let preferredH = preferredHueFamily {
                let raw = abs(accentCandidates[i].h - preferredH)
                let diff = min(raw, 360 - raw)
                if diff <= 45 {
                    score *= 1.3
                } else if diff > 90 {
                    score *= 0.5
                }
            }

            accentCandidates[i].score = score
        }

        accentCandidates.sort { $0.score > $1.score }
        let accentWinner = accentCandidates[0]

        let accentS = min(90.0, accentWinner.s * 1.15)
        let accentL: CGFloat = accentWinner.l <= 40
            ? 55.0 + (accentWinner.l / 40.0) * 10.0
            : 65.0 + ((accentWinner.l - 40.0) / 40.0) * 10.0
        let accentCol = colorFromHSL(
            h: accentWinner.h,
            s: max(65.0, accentS),
            l: max(55.0, min(75.0, accentL))
        )

        // --- Blur color ---
        let bottomBuckets = buckets.values
            .filter { $0.bottomCount > 0 }
            .sorted { $0.bottomCount > $1.bottomCount }

        var bestBlurBucket = bottomBuckets.first ?? buckets.values.max(by: { $0.count < $1.count })!
        var bestBlurScore: CGFloat = -1
        let maxBottomCount = CGFloat(bottomBuckets.first?.bottomCount ?? 1)

        for bucket in bottomBuckets {
            let hsl = rgbToHSL(CGFloat(bucket.rKey) / 255, CGFloat(bucket.gKey) / 255, CGFloat(bucket.bKey) / 255)
            let freq = CGFloat(bucket.bottomCount) / maxBottomCount
            var score = freq * 0.4 + (hsl.s / 100) * 0.45 + (CGFloat(bucket.positions.count) / maxCoverage) * 0.15
            let isMuddyBrown = hsl.h >= 20 && hsl.h <= 55 && hsl.s < 35
            if isMuddyBrown && freq < 0.7 { score *= 0.3 }
            if hsl.s < 15 && hsl.l < 30 { score *= 0.4 }
            if hsl.s >= 40 {
                if (hsl.h >= 180 && hsl.h <= 300) { score *= 1.3 }
                if (hsl.h >= 330 || hsl.h <= 15) { score *= 1.25 }
                if (hsl.h >= 100 && hsl.h <= 170) { score *= 1.2 }
                if (hsl.h >= 40 && hsl.h <= 70) { score *= 1.2 }
                if (hsl.h >= 15 && hsl.h <= 40) { score *= 1.15 }
            }
            if score > bestBlurScore {
                bestBlurScore = score
                bestBlurBucket = bucket
            }
        }

        let blurHSL = rgbToHSL(
            CGFloat(bestBlurBucket.rKey) / 255, CGFloat(bestBlurBucket.gKey) / 255, CGFloat(bestBlurBucket.bKey) / 255
        )

        let sourceH = blurHSL.s >= 15 ? blurHSL.h : accentWinner.h
        let sourceS = blurHSL.s >= 15 ? blurHSL.s : accentWinner.s

        let finalH: CGFloat
        let finalS: CGFloat
        let finalL: CGFloat

        if blurHSL.s < 10 && accentWinner.s < 15 {
            finalH = 0; finalS = 0; finalL = 5
        } else if sourceH >= 50 && sourceH <= 65 {
            finalH = 35; finalS = 70; finalL = 10
        } else if sourceH >= 65 && sourceH <= 85 {
            finalH = 45; finalS = 55; finalL = 9
        } else {
            finalH = sourceH
            finalS = max(50.0, min(80.0, sourceS * 1.1))
            finalL = 10
        }

        let adjustedL: CGFloat
        if finalS == 0 {
            adjustedL = finalL
        } else if finalH >= 200 && finalH <= 260 {
            adjustedL = 12
        } else if finalH >= 260 && finalH <= 320 {
            adjustedL = 11
        } else if finalH >= 320 || finalH <= 15 {
            adjustedL = 10
        } else if finalH >= 15 && finalH <= 50 {
            adjustedL = 9
        } else if finalH >= 80 && finalH <= 170 {
            adjustedL = 9
        } else {
            adjustedL = 10
        }

        let blurCol = colorFromHSL(h: finalH, s: finalS, l: adjustedL)

        // --- Icon lightness flag for top-right region ---
        let isLight: Bool = {
            var totalLum: CGFloat = 0
            var count: CGFloat = 0
            let startX = sampleW / 2
            let endY = sampleH / 3
            for y in 0..<endY {
                for x in startX..<sampleW {
                    let idx = (y * sampleW + x) * 4
                    let r = CGFloat(rawData[idx]) / 255.0
                    let g = CGFloat(rawData[idx + 1]) / 255.0
                    let b = CGFloat(rawData[idx + 2]) / 255.0
                    totalLum += 0.299 * r + 0.587 * g + 0.114 * b
                    count += 1
                }
            }
            return count > 0 && (totalLum / count) > 0.55
        }()

        let accentUI = UIColor(accentCol)
        let blurUI = UIColor(blurCol)

        colorCache.setObject(accentUI, forKey: url as NSURL)
        blurColorCache.setObject(blurUI, forKey: url as NSURL)
        lightnessCache.setObject(NSNumber(value: isLight), forKey: url as NSURL)

        return (accentUI, blurUI, isLight)
    }

}
