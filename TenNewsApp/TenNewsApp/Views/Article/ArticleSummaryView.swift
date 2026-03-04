import SwiftUI

/// Shows article summary text, detail items, and five_ws section
struct ArticleSummaryView: View {
    let article: Article

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            // Summary text
            if !article.displaySummary.isEmpty {
                Text(article.displaySummary)
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.bodyText)
                    .lineSpacing(6)
            }

            // Detail items (label/value pairs)
            if let details = article.details ?? article.detailsB2, !details.isEmpty {
                detailItemsSection(details)
            }

            // Five Ws section
            if let fiveWs = article.fiveWs {
                fiveWsSection(fiveWs)
            }
        }
    }

    // MARK: - Detail Items

    private func detailItemsSection(_ details: [DetailItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("KEY DETAILS")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            ForEach(Array(details.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 12) {
                    Text(item.displayLabel)
                        .font(Theme.Fonts.captionMedium())
                        .foregroundStyle(Theme.Colors.secondaryText)
                        .frame(width: 90, alignment: .leading)

                    Text(item.displayValue)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 8)

                if item.displayLabel != details.last?.displayLabel {
                    Divider()
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }

    // MARK: - Five Ws

    private func fiveWsSection(_ fiveWs: FiveWs) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("THE FIVE Ws")
                .font(Theme.Fonts.sectionLabel())
                .foregroundStyle(Theme.Colors.secondaryText)
                .tracking(1)

            VStack(alignment: .leading, spacing: 16) {
                fiveWsRow(label: "WHO", value: fiveWs.who, icon: "person.fill")
                fiveWsRow(label: "WHAT", value: fiveWs.what, icon: "doc.text.fill")
                fiveWsRow(label: "WHEN", value: fiveWs.when, icon: "clock.fill")
                fiveWsRow(label: "WHERE", value: fiveWs.where_, icon: "mappin.circle.fill")
                fiveWsRow(label: "WHY", value: fiveWs.why, icon: "questionmark.circle.fill")
                if let how = fiveWs.how {
                    fiveWsRow(label: "HOW", value: how, icon: "gearshape.fill")
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }

    @ViewBuilder
    private func fiveWsRow(label: String, value: String?, icon: String) -> some View {
        if let value, !value.isEmpty {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Colors.accent)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Colors.accent)
                        .tracking(0.5)

                    Text(value)
                        .font(Theme.Fonts.body())
                        .foregroundStyle(Theme.Colors.primaryText)
                        .lineSpacing(4)
                }
            }
        }
    }
}

#Preview {
    ScrollView {
        ArticleSummaryView(article: PreviewData.sampleArticle)
            .padding()
    }
}
