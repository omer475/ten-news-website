import SwiftUI

struct OnboardingView: View {
    let appViewModel: AppViewModel

    @State private var viewModel = OnboardingViewModel()

    var body: some View {
        ZStack {
            // Background
            Theme.Colors.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar
                ProgressView(value: viewModel.progress)
                    .tint(Theme.Colors.accent)
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.md)

                // Step content
                TabView(selection: $viewModel.currentStep) {
                    welcomeStep
                        .tag(OnboardingViewModel.Step.welcome)

                    CountrySelectionView(viewModel: viewModel)
                        .tag(OnboardingViewModel.Step.country)

                    countriesStep
                        .tag(OnboardingViewModel.Step.countries)

                    TopicSelectionView(viewModel: viewModel)
                        .tag(OnboardingViewModel.Step.topics)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(AppAnimations.pageTransition, value: viewModel.currentStep)

                // Bottom buttons
                bottomButtons
            }
        }
    }

    // MARK: - Welcome Step

    private var welcomeStep: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "newspaper.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.Colors.accent)

            Text("Welcome to Today+")
                .font(.system(size: 32, weight: .bold))
                .multilineTextAlignment(.center)

            Text("Your personalized global news feed.\nLet's set up your preferences.")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .padding(Theme.Spacing.lg)
    }

    // MARK: - Countries Step

    private var countriesStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Follow Countries")
                .font(.system(size: 28, weight: .bold))
                .padding(.top, Theme.Spacing.lg)

            Text("Select countries you want to follow news from")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 12) {
                    ForEach(viewModel.availableCountries, id: \.id) { country in
                        Button {
                            viewModel.toggleCountry(country.id)
                        } label: {
                            HStack(spacing: 8) {
                                Text(country.flag)
                                Text(country.name)
                                    .font(.system(size: 14, weight: .medium))
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .glassEffect(
                                viewModel.selectedCountries.contains(country.id)
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

    // MARK: - Bottom Buttons

    private var bottomButtons: some View {
        HStack {
            if viewModel.currentStep != .welcome {
                Button("Back") {
                    viewModel.previousStep()
                }
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
            }

            Spacer()

            GlassCTAButton(
                title: viewModel.isLastStep ? "Get Started" : "Continue",
                action: {
                    if viewModel.isLastStep {
                        let prefs = viewModel.buildPreferences()
                        appViewModel.completeOnboarding(with: prefs)
                    } else {
                        viewModel.nextStep()
                    }
                },
                isDisabled: !viewModel.canProceed
            )
            .frame(width: 160)
        }
        .padding(Theme.Spacing.lg)
    }
}

#Preview {
    OnboardingView(appViewModel: AppViewModel())
}
