import SwiftUI

// MARK: - TodayPlus Feed Redesign — 5.9 MAP card
// Stylized inline vector world map: equirectangular 720×360 coordinate space,
// x = (lon+180)/360·720, y = (90−lat)/180·360. Low-poly continents drawn with
// Canvas — no external map service, no API keys, works offline (§10.5).

// MARK: Low-poly continent outlines (lon, lat)

private enum TPWorldMap {
    static let lands: [[(Double, Double)]] = [
        // North + Central America
        [(-168, 66), (-156, 71), (-140, 70), (-125, 72), (-110, 73), (-95, 72), (-82, 70),
         (-75, 62), (-80, 55), (-65, 60), (-55, 52), (-60, 46), (-70, 44), (-75, 38),
         (-80, 32), (-81, 25), (-90, 29), (-95, 22), (-90, 15), (-83, 9), (-79, 8.5),
         (-84, 13), (-92, 16), (-97, 20), (-105, 20), (-110, 23), (-115, 30), (-122, 34),
         (-124, 40), (-124, 48), (-132, 55), (-140, 60), (-152, 60), (-165, 55)],
        // South America
        [(-79, 9), (-71, 12), (-60, 8), (-52, 5), (-44, -2), (-35, -7), (-39, -13),
         (-41, -22), (-48, -28), (-53, -34), (-58, -39), (-65, -41), (-66, -48), (-69, -52),
         (-74, -50), (-72, -44), (-71, -32), (-70, -18), (-77, -12), (-81, -5), (-79, 2)],
        // Greenland
        [(-46, 60), (-38, 66), (-22, 70), (-18, 75), (-25, 78), (-38, 80), (-55, 82),
         (-68, 80), (-73, 78), (-60, 75), (-55, 69), (-52, 64)],
        // Eurasia (Europe + Asia, one outline)
        [(-10, 36), (-9, 43), (-1, 46), (0, 51), (8, 54), (8, 57), (5, 62), (12, 65),
         (18, 69), (26, 71), (40, 68), (50, 69), (60, 69), (70, 73), (80, 73), (90, 75),
         (100, 77), (110, 74), (120, 73), (140, 72), (160, 70), (170, 66), (179, 65),
         (178, 62), (163, 60), (155, 53), (142, 47), (135, 43), (129, 35), (122, 30),
         (121, 23), (108, 12), (104, 2), (98, 8), (91, 22), (80, 8), (77, 8), (72, 20),
         (66, 25), (57, 25), (52, 16), (44, 12), (43, 16), (35, 28), (33, 31), (36, 36),
         (27, 37), (26, 40), (22, 37), (15, 38), (18, 40), (13, 44), (9, 44), (3, 43),
         (3, 40), (-1, 37), (-6, 36)],
        // Africa
        [(-6, 35), (11, 37), (20, 32), (32, 31), (34, 28), (38, 18), (43, 12), (51, 12),
         (46, 2), (41, -2), (40, -10), (35, -20), (33, -29), (27, -34), (20, -35),
         (17, -29), (12, -18), (9, -7), (9, 4), (-5, 5), (-13, 9), (-17, 15), (-16, 20),
         (-13, 28)],
        // Australia
        [(114, -22), (122, -18), (130, -12), (136, -12), (142, -11), (146, -19),
         (150, -23), (153, -28), (151, -34), (146, -39), (139, -37), (135, -35),
         (129, -32), (122, -34), (115, -34), (113, -26)],
        // British Isles
        [(-5, 50), (-3, 53), (-5, 56), (-3, 58), (-6, 58), (-8, 54), (-10, 52)],
        // Japan
        [(130, 31), (135, 34.5), (140, 36), (141, 40), (144, 44), (141, 42), (137, 36),
         (132, 33)],
    ]

    static func project(lon: Double, lat: Double) -> CGPoint {
        CGPoint(x: (lon + 180) / 360 * 720, y: (90 - lat) / 180 * 360)
    }

    /// Auto-zoom (§5.9): viewBox = bounding box of all pins, padded ×2.4,
    /// min width 200 units, clamped to map bounds, 16:11 aspect.
    static func viewBox(for pins: [DisplayGeoPin]) -> CGRect {
        let pts = pins.map { project(lon: $0.lon, lat: $0.lat) }
        guard let first = pts.first else { return CGRect(x: 0, y: 0, width: 720, height: 495) }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for p in pts {
            minX = min(minX, p.x); maxX = max(maxX, p.x)
            minY = min(minY, p.y); maxY = max(maxY, p.y)
        }
        let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
        var w = max((maxX - minX) * 2.4, 200.0)
        var h = w * 11 / 16
        let neededH = max((maxY - minY) * 2.4, h)
        if neededH > h { h = neededH; w = h * 16 / 11 }
        w = min(w, 720); h = min(h, 495)
        var x = cx - w / 2, y = cy - h / 2
        x = max(0, min(x, 720 - w))
        y = max(0, min(y, max(0, 360 - h)))
        return CGRect(x: x, y: y, width: w, height: h)
    }
}

// MARK: - Card

struct TPMapCard: View {
    let ctx: TPCardContext

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TPKickerRow(category: ctx.display.category, accent: ctx.accent,
                        ageLabel: ctx.article.tpAgeLabel, prefixText: "ON THE MAP")

            TPHeadline(attributed: ctx.display.titleAttributed, accent: ctx.accent, size: 24)
                .padding(.top, 10)

            if let geo = ctx.display.geo {
                TPMapFigure(geo: geo, accent: ctx.accent)
                    .aspectRatio(16 / 11, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: TP.imageRadius))
                    .padding(.top, 18)
            }

            // <em> on the dark map surface would use goldSoft, but bullets sit
            // on the white bg below the map — normal accent applies.
            TPBullets(bullets: ctx.display.bulletsAttributed, accent: ctx.accent, maxCount: 2)
                .padding(.top, 16)

            TPCardFooter(article: ctx.article, tags: ctx.display.tags, state: ctx.state,
                         onTagTap: ctx.onTagTap, onInfoTap: ctx.onInfoTap)
                .padding(.top, 14)
        }
    }
}

// MARK: - Map figure

private struct TPMapFigure: View {
    let geo: DisplayGeo
    let accent: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let box = TPWorldMap.viewBox(for: geo.pins)
            let scale = size.width / box.width

            ZStack {
                TP.mapBg

                Canvas { context, _ in
                    func toScreen(_ p: CGPoint) -> CGPoint {
                        CGPoint(x: (p.x - box.minX) * scale, y: (p.y - box.minY) * scale)
                    }

                    // Graticule every 20 units
                    var grid = Path()
                    var gx = (box.minX / 20).rounded(.down) * 20
                    while gx <= box.maxX {
                        grid.move(to: toScreen(CGPoint(x: gx, y: box.minY)))
                        grid.addLine(to: toScreen(CGPoint(x: gx, y: box.maxY)))
                        gx += 20
                    }
                    var gy = (box.minY / 20).rounded(.down) * 20
                    while gy <= box.maxY {
                        grid.move(to: toScreen(CGPoint(x: box.minX, y: gy)))
                        grid.addLine(to: toScreen(CGPoint(x: box.maxX, y: gy)))
                        gy += 20
                    }
                    context.stroke(grid, with: .color(TP.mapGrid), lineWidth: 0.6)

                    // Continents
                    for land in TPWorldMap.lands {
                        var path = Path()
                        let pts = land.map { TPWorldMap.project(lon: $0.0, lat: $0.1) }.map(toScreen)
                        guard let first = pts.first else { continue }
                        path.move(to: first)
                        for p in pts.dropFirst() { path.addLine(to: p) }
                        path.closeSubpath()
                        context.fill(path, with: .color(TP.mapLand))
                        context.stroke(path, with: .color(TP.mapLandStroke), lineWidth: 0.8)
                    }

                    // Two-pin mode: dashed quadratic arc, peak lifted 22% of distance
                    if geo.isLinked {
                        let a = toScreen(TPWorldMap.project(lon: geo.pins[0].lon, lat: geo.pins[0].lat))
                        let b = toScreen(TPWorldMap.project(lon: geo.pins[1].lon, lat: geo.pins[1].lat))
                        let dist = hypot(b.x - a.x, b.y - a.y)
                        let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - dist * 0.22 * 2)
                        var arc = Path()
                        arc.move(to: a)
                        arc.addQuadCurve(to: b, control: mid)
                        context.stroke(
                            arc,
                            with: .color(accent),
                            style: StrokeStyle(lineWidth: 1.2, dash: [4, 4])
                        )
                    }
                }

                // Pins + pulse rings + labels (views, so the rings can animate)
                ForEach(Array(geo.pins.enumerated()), id: \.offset) { _, pin in
                    let p = TPWorldMap.project(lon: pin.lon, lat: pin.lat)
                    let screen = CGPoint(x: (p.x - box.minX) * scale, y: (p.y - box.minY) * scale)
                    TPMapPin(accent: accent, label: pin.label)
                        .position(screen)
                }

                // Distance label above the arc apex (two-pin mode)
                if geo.isLinked, let distance = geo.distance, !distance.isEmpty {
                    let a = TPWorldMap.project(lon: geo.pins[0].lon, lat: geo.pins[0].lat)
                    let b = TPWorldMap.project(lon: geo.pins[1].lon, lat: geo.pins[1].lat)
                    let sa = CGPoint(x: (a.x - box.minX) * scale, y: (a.y - box.minY) * scale)
                    let sb = CGPoint(x: (b.x - box.minX) * scale, y: (b.y - box.minY) * scale)
                    let dist = hypot(sb.x - sa.x, sb.y - sa.y)
                    Text(distance)
                        .font(TP.mono(9, weight: .medium))
                        .foregroundStyle(accent)
                        .position(x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 - dist * 0.22 - 10)
                }
            }
            .overlay(alignment: .bottomLeading) {
                if let pin = geo.pins.first {
                    Text(coordinateString(pin))
                        .font(TP.mono(9))
                        .foregroundStyle(TP.mapText.opacity(0.55))
                        .padding(12)
                }
            }
            .overlay(alignment: .topTrailing) {
                if let region = geo.region, !region.isEmpty {
                    Text(region)
                        .font(TP.mono(9, weight: .medium))
                        .kerning(9 * 0.12)
                        .foregroundStyle(TP.mapText.opacity(0.75))
                        .textCase(.uppercase)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(TP.mapBg.opacity(0.6))
                                .overlay(Capsule().strokeBorder(TP.mapText.opacity(0.14), lineWidth: 1))
                        )
                        .padding(12)
                }
            }
        }
    }

    private func coordinateString(_ pin: DisplayGeoPin) -> String {
        let latDir = pin.lat >= 0 ? "N" : "S"
        let lonDir = pin.lon >= 0 ? "E" : "W"
        return String(format: "%.2f°%@ · %.2f°%@", abs(pin.lat), latDir, abs(pin.lon), lonDir)
    }
}

// MARK: - Pin (solid dot + expanding pulse ring + label)

private struct TPMapPin: View {
    let accent: Color
    let label: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    var body: some View {
        ZStack {
            if !reduceMotion {
                // scale 0.4→2.6, opacity .9→0, 2.2s infinite (§5.9)
                Circle()
                    .stroke(accent.opacity(pulsing ? 0 : 0.9), lineWidth: 1.2)
                    .frame(width: 9, height: 9)
                    .scaleEffect(pulsing ? 2.6 : 0.4)
            }
            Circle()
                .fill(accent)
                .frame(width: 7, height: 7)
        }
        .overlay(alignment: .leading) {
            if let label, !label.isEmpty {
                Text(label)
                    .font(TP.mono(9, weight: .medium))
                    .foregroundStyle(TP.mapText)
                    .textCase(.uppercase)
                    .fixedSize()
                    .offset(x: 12)
            }
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 2.2).repeatForever(autoreverses: false)) {
                pulsing = true
            }
        }
    }
}
