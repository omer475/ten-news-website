import MapKit
import SwiftUI

/// Combined Global Impact view — MapKit map + country details + perspectives.
/// Merges geographic impact and perspectives into one cohesive section.
struct EventGlobalImpactView: View {
    let geoData: GeographicImpactData?
    let perspectives: [Perspective]
    var accentColor: Color = Color(hex: "#0057B7")

    @State private var selectedCountry: ImpactCountry? = nil
    @State private var expandedPerspective: Int? = nil
    @State private var mapPosition: MapCameraPosition = .automatic

    private var countries: [ImpactCountry] { geoData?.countries ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Map
            if !countries.isEmpty {
                mapSection
            }

            // Country pills
            if !countries.isEmpty {
                countryPillsSection
            }

            // Selected country detail
            if let country = selectedCountry {
                selectedCountryDetail(country)
            }

            // Perspectives
            if !perspectives.isEmpty {
                perspectivesSection
            }

            // Region summaries
            if let regionsSummary = geoData?.regionsSummary, !regionsSummary.isEmpty {
                regionSummariesSection(regionsSummary)
            }
        }
    }

    // MARK: - Map

    private var mapSection: some View {
        Map(position: $mapPosition) {
            ForEach(Array(countries.enumerated()), id: \.offset) { _, country in
                if let coord = Self.coordinate(for: country.code) {
                    Annotation(country.name ?? "", coordinate: coord) {
                        Button {
                            withAnimation(.spring(duration: 0.35, bounce: 0.2)) {
                                selectedCountry = selectedCountry == country ? nil : country
                                HapticManager.light()
                            }
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(roleColor(country.role).opacity(0.2))
                                    .frame(width: 28, height: 28)
                                Circle()
                                    .fill(roleColor(country.role))
                                    .frame(width: 12, height: 12)
                                if selectedCountry == country {
                                    Circle()
                                        .strokeBorder(roleColor(country.role), lineWidth: 2)
                                        .frame(width: 28, height: 28)
                                }
                            }
                        }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 18))
    }

    // MARK: - Country Pills

    private var countryPillsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let total = geoData?.totalCountriesAffected {
                HStack(spacing: 6) {
                    Text("\(total)")
                        .font(.system(size: 22, weight: .heavy, design: .rounded))
                        .foregroundStyle(accentColor)
                    Text("countries affected")
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                }
            }

            FlowLayout(spacing: 8) {
                ForEach(Array(countries.enumerated()), id: \.offset) { _, country in
                    let isSelected = selectedCountry == country
                    Button {
                        withAnimation(.spring(duration: 0.35, bounce: 0.2)) {
                            selectedCountry = isSelected ? nil : country
                            HapticManager.light()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            if let code = country.code {
                                Text(Self.flagEmoji(for: code))
                                    .font(.system(size: 14))
                            }
                            Text(country.name ?? "Unknown")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.primary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .glassEffect(
                            isSelected
                                ? .regular.tint(accentColor.opacity(0.15)).interactive()
                                : .regular.interactive(),
                            in: Capsule()
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Selected Country Detail

    private func selectedCountryDetail(_ country: ImpactCountry) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                if let code = country.code {
                    Text(Self.flagEmoji(for: code))
                        .font(.system(size: 22))
                }
                Text(country.name ?? "")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.primary)

                Spacer()

                if let role = country.role {
                    Text(role.capitalized)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(roleColor(role))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .glassEffect(
                            .regular.tint(roleColor(role).opacity(0.1)).interactive(),
                            in: Capsule()
                        )
                }
            }

            if let description = country.description, !description.isEmpty {
                Text(description)
                    .font(.system(size: 14))
                    .foregroundStyle(.primary.opacity(0.8))
                    .lineSpacing(4)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 16))
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .scale(scale: 0.95, anchor: .top)),
            removal: .opacity
        ))
    }

    // MARK: - Perspectives

    private var perspectivesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Perspectives")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.secondary)
                .tracking(0.3)

            ForEach(Array(perspectives.enumerated()), id: \.offset) { index, p in
                perspectiveCard(p, index: index)
            }
        }
    }

    private func perspectiveCard(_ p: Perspective, index: Int) -> some View {
        let config = stanceConfig(p.stance)
        let isExpanded = expandedPerspective == index

        return Button {
            withAnimation(.spring(duration: 0.4, bounce: 0.2)) {
                expandedPerspective = isExpanded ? nil : index
                HapticManager.light()
            }
        } label: {
            HStack(alignment: .top, spacing: 0) {
                // Colored stance bar
                RoundedRectangle(cornerRadius: 2)
                    .fill(config.color.gradient)
                    .frame(width: 4)
                    .padding(.vertical, 4)

                VStack(alignment: .leading, spacing: 12) {
                    // Entity header
                    HStack(spacing: 10) {
                        if let icon = p.icon, !icon.isEmpty {
                            Text(icon)
                                .font(.system(size: 22))
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            Text(p.entity ?? "")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)

                            HStack(spacing: 4) {
                                Image(systemName: config.icon)
                                    .font(.system(size: 9))
                                Text(config.label.uppercased())
                                    .font(.system(size: 10, weight: .bold))
                                    .tracking(0.5)
                            }
                            .foregroundStyle(config.color)
                        }

                        Spacer()

                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.tertiary)
                            .rotationEffect(isExpanded ? .degrees(180) : .zero)
                    }

                    if isExpanded {
                        VStack(alignment: .leading, spacing: 14) {
                            if let position = p.position, !position.isEmpty {
                                HStack(alignment: .top, spacing: 12) {
                                    Text("\u{201C}")
                                        .font(.system(size: 36, weight: .bold))
                                        .foregroundStyle(config.color.opacity(0.4))
                                        .offset(y: -8)
                                    Text(position)
                                        .font(.system(size: 15))
                                        .italic()
                                        .foregroundStyle(.primary.opacity(0.85))
                                        .lineSpacing(6)
                                }
                            }

                            if let sourceContext = p.sourceContext, !sourceContext.isEmpty {
                                HStack(spacing: 6) {
                                    Image(systemName: "quote.closing")
                                        .font(.system(size: 10))
                                        .foregroundStyle(.tertiary)
                                    Text(sourceContext)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .padding(.leading, 14)
                .padding(.trailing, 16)
                .padding(.vertical, 16)
            }
            .glassEffect(
                isExpanded
                    ? .regular.tint(config.color.opacity(0.06)).interactive()
                    : .regular.interactive(),
                in: RoundedRectangle(cornerRadius: 18)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Region Summaries

    private func regionSummariesSection(_ summaries: [RegionSummary]) -> some View {
        VStack(spacing: 8) {
            ForEach(Array(summaries.enumerated()), id: \.offset) { _, rs in
                if let region = rs.region, let status = rs.status {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(accentColor)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(region)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                            Text(status)
                                .font(.system(size: 13))
                                .foregroundStyle(.secondary)
                                .lineSpacing(4)
                        }

                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    // MARK: - Helpers

    private func stanceConfig(_ stance: String?) -> (color: Color, label: String, icon: String) {
        switch stance?.lowercased() {
        case "supportive", "supports":
            return (Color(hex: "#059669"), "Supports", "hand.thumbsup.fill")
        case "opposed", "opposes":
            return (Color(hex: "#dc2626"), "Opposes", "hand.thumbsdown.fill")
        case "concerned":
            return (Color(hex: "#d97706"), "Concerned", "exclamationmark.triangle.fill")
        case "defensive", "defending":
            return (Color(hex: "#2563eb"), "Defending", "shield.fill")
        case "divided":
            return (Color(hex: "#7c3aed"), "Divided", "arrow.triangle.branch")
        default:
            return (Color(hex: "#6b7280"), "Neutral", "minus.circle.fill")
        }
    }

    private func roleColor(_ role: String?) -> Color {
        switch role?.lowercased() {
        case "initiator", "primary", "aggressor":
            return Color(hex: "#dc2626")
        case "major actor", "major", "secondary":
            return Color(hex: "#f97316")
        case "affected", "observer":
            return Color(hex: "#3b82f6")
        default:
            return Color(hex: "#6b7280")
        }
    }

    // MARK: - Country Code → Coordinate

    static func coordinate(for code: String?) -> CLLocationCoordinate2D? {
        guard let code = code?.uppercased() else { return nil }
        return countryCoordinates[code]
    }

    private static let countryCoordinates: [String: CLLocationCoordinate2D] = [
        "US": CLLocationCoordinate2D(latitude: 39.83, longitude: -98.58),
        "CN": CLLocationCoordinate2D(latitude: 35.86, longitude: 104.20),
        "RU": CLLocationCoordinate2D(latitude: 61.52, longitude: 105.32),
        "GB": CLLocationCoordinate2D(latitude: 55.38, longitude: -3.44),
        "FR": CLLocationCoordinate2D(latitude: 46.23, longitude: 2.21),
        "DE": CLLocationCoordinate2D(latitude: 51.17, longitude: 10.45),
        "JP": CLLocationCoordinate2D(latitude: 36.20, longitude: 138.25),
        "KR": CLLocationCoordinate2D(latitude: 35.91, longitude: 127.77),
        "IN": CLLocationCoordinate2D(latitude: 20.59, longitude: 78.96),
        "BR": CLLocationCoordinate2D(latitude: -14.24, longitude: -51.93),
        "AU": CLLocationCoordinate2D(latitude: -25.27, longitude: 133.78),
        "CA": CLLocationCoordinate2D(latitude: 56.13, longitude: -106.35),
        "IL": CLLocationCoordinate2D(latitude: 31.05, longitude: 34.85),
        "UA": CLLocationCoordinate2D(latitude: 48.38, longitude: 31.17),
        "PL": CLLocationCoordinate2D(latitude: 51.92, longitude: 19.15),
        "TR": CLLocationCoordinate2D(latitude: 38.96, longitude: 35.24),
        "SA": CLLocationCoordinate2D(latitude: 23.89, longitude: 45.08),
        "IR": CLLocationCoordinate2D(latitude: 32.43, longitude: 53.69),
        "VE": CLLocationCoordinate2D(latitude: 6.42, longitude: -66.59),
        "CO": CLLocationCoordinate2D(latitude: 4.57, longitude: -74.30),
        "EC": CLLocationCoordinate2D(latitude: -1.83, longitude: -78.18),
        "MX": CLLocationCoordinate2D(latitude: 23.63, longitude: -102.55),
        "ID": CLLocationCoordinate2D(latitude: -0.79, longitude: 113.92),
        "TW": CLLocationCoordinate2D(latitude: 23.70, longitude: 120.96),
        "PH": CLLocationCoordinate2D(latitude: 12.88, longitude: 121.77),
        "TH": CLLocationCoordinate2D(latitude: 15.87, longitude: 100.99),
        "VN": CLLocationCoordinate2D(latitude: 14.06, longitude: 108.28),
        "NG": CLLocationCoordinate2D(latitude: 9.08, longitude: 8.68),
        "ZA": CLLocationCoordinate2D(latitude: -30.56, longitude: 22.94),
        "EG": CLLocationCoordinate2D(latitude: 26.82, longitude: 30.80),
        "IT": CLLocationCoordinate2D(latitude: 41.87, longitude: 12.57),
        "ES": CLLocationCoordinate2D(latitude: 40.46, longitude: -3.75),
        "SE": CLLocationCoordinate2D(latitude: 60.13, longitude: 18.64),
        "NO": CLLocationCoordinate2D(latitude: 60.47, longitude: 8.47),
        "FI": CLLocationCoordinate2D(latitude: 61.92, longitude: 25.75),
        "CL": CLLocationCoordinate2D(latitude: -35.68, longitude: -71.54),
        "AR": CLLocationCoordinate2D(latitude: -38.42, longitude: -63.62),
        "PE": CLLocationCoordinate2D(latitude: -9.19, longitude: -75.02),
        "SY": CLLocationCoordinate2D(latitude: 34.80, longitude: 38.99),
        "IQ": CLLocationCoordinate2D(latitude: 33.22, longitude: 43.68),
        "AF": CLLocationCoordinate2D(latitude: 33.94, longitude: 67.71),
        "PK": CLLocationCoordinate2D(latitude: 30.38, longitude: 69.35),
        "MM": CLLocationCoordinate2D(latitude: 21.91, longitude: 95.96),
        "GE": CLLocationCoordinate2D(latitude: 42.32, longitude: 43.36),
        "BY": CLLocationCoordinate2D(latitude: 53.71, longitude: 27.95),
    ]

    // MARK: - Country Code → Flag Emoji

    static func flagEmoji(for code: String) -> String {
        let uppercased = code.uppercased()
        // Handle special non-country codes
        if uppercased == "EU" { return "🇪🇺" }
        let base: UInt32 = 127397
        var emoji = ""
        for scalar in uppercased.unicodeScalars {
            if let flag = Unicode.Scalar(base + scalar.value) {
                emoji.append(String(flag))
            }
        }
        return emoji.isEmpty ? "🏳️" : emoji
    }
}

// MARK: - Flow Layout (wrapping pills)

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

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
            maxX = max(maxX, x)
        }

        return (CGSize(width: maxX, height: y + rowHeight), positions)
    }
}
