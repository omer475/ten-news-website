import SwiftUI

/// Geographic impact data with colored impact dots and region descriptions
struct EventGeographicImpactView: View {
    let data: GeographicImpactData

    private var regions: [ImpactRegion] { data.regions ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(data.title?.uppercased() ?? "GEOGRAPHIC IMPACT")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(regions.enumerated()), id: \.offset) { index, region in
                    regionRow(region, index: index)

                    if index < regions.count - 1 {
                        Divider()
                    }
                }
            }
            .padding(Theme.Spacing.md)
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
        }
    }

    private func regionRow(_ region: ImpactRegion, index: Int) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Impact level dot
            Circle()
                .fill(impactColor(region.impact))
                .frame(width: 10, height: 10)
                .padding(.top, 5)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(region.name ?? "Unknown Region")
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.primaryText)

                    Spacer()

                    if let impact = region.impact {
                        Text(impact.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(impactColor(impact))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(impactColor(impact).opacity(0.12))
                            )
                    }
                }

                if let description = region.description, !description.isEmpty {
                    Text(description)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.bodyText)
                        .lineSpacing(4)
                }
            }
        }
    }

    private func impactColor(_ impact: String?) -> Color {
        switch impact?.lowercased() {
        case "high", "severe", "critical":
            return Color(hex: "#FF3B30")
        case "medium", "moderate":
            return Color(hex: "#FF9500")
        case "low", "minor":
            return Color(hex: "#34C759")
        default:
            return Theme.Colors.accent
        }
    }
}

#Preview {
    let data = GeographicImpactData(
        title: "Geographic Impact",
        regions: [
            ImpactRegion(id: "1", name: "North America", impact: "high", description: "Major policy changes expected for industrial sector"),
            ImpactRegion(id: "2", name: "Europe", impact: "medium", description: "Already aligned with existing EU regulations"),
            ImpactRegion(id: "3", name: "Asia Pacific", impact: "low", description: "Gradual adoption timeline agreed upon"),
        ]
    )
    return ScrollView {
        EventGeographicImpactView(data: data)
            .padding()
    }
}
