import SwiftUI

struct CountrySelectionView: View {
    let viewModel: OnboardingViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Where are you from?")
                .font(.system(size: 28, weight: .bold))
                .padding(.top, Theme.Spacing.lg)

            Text("Select your home country")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 12) {
                    ForEach(viewModel.availableCountries, id: \.id) { country in
                        Button {
                            viewModel.selectCountry(country.id)
                        } label: {
                            HStack(spacing: 8) {
                                Text(country.flag)
                                    .font(.title3)
                                Text(country.name)
                                    .font(.system(size: 14, weight: .medium))
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .glassEffect(
                                viewModel.selectedCountry == country.id
                                    ? .regular.tint(.blue).interactive()
                                    : .regular.interactive(),
                                in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, Theme.Spacing.lg)
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
    }
}

#Preview {
    CountrySelectionView(viewModel: OnboardingViewModel())
}
