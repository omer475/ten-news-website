import SwiftUI

/// Onboarding flow that guides users through country and topic selection.
struct OnboardingFlowView: View {
    @Environment(AppViewModel.self) private var appViewModel
    @State private var viewModel = OnboardingViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                progressBar

                TabView(selection: $viewModel.currentStep) {
                    welcomeStep.tag(OnboardingViewModel.Step.welcome)
                    countryStep.tag(OnboardingViewModel.Step.country)
                    countriesStep.tag(OnboardingViewModel.Step.countries)
                    topicsStep.tag(OnboardingViewModel.Step.topics)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(AppAnimations.pageTransition, value: viewModel.currentStep)

                bottomButtons
            }
            .background(Theme.Colors.backgroundPrimary)
            .navigationTitle("Welcome")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.regularMaterial, for: .navigationBar)
        }
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.Colors.separator)
                    .frame(height: 4)
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.Colors.accent)
                    .frame(width: geo.size.width * viewModel.progress, height: 4)
                    .animation(AppAnimations.quickSpring, value: viewModel.progress)
            }
        }
        .frame(height: 4)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.top, Theme.Spacing.md)
    }

    // MARK: - Steps

    private var welcomeStep: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            Image(systemName: "newspaper.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.Colors.accent)
            Text("Welcome to Today+")
                .font(.title.bold())
            Text("Your personalized news feed, curated daily.")
                .font(Theme.Fonts.body())
                .foregroundStyle(Theme.Colors.secondaryText)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(Theme.Spacing.lg)
    }

    private var countryStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Where are you from?")
                .font(.title2.bold())
                .padding(.horizontal, Theme.Spacing.lg)

            List(viewModel.availableCountries) { country in
                Button {
                    viewModel.selectCountry(country.id)
                } label: {
                    HStack {
                        Text(country.flag).font(.title2)
                        Text(country.name)
                            .font(Theme.Fonts.bodyMedium())
                            .foregroundStyle(Theme.Colors.primaryText)
                        Spacer()
                        if viewModel.selectedCountry == country.id {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Theme.Colors.accent)
                                .fontWeight(.semibold)
                        }
                    }
                }
                .listRowBackground(
                    viewModel.selectedCountry == country.id
                        ? Theme.Colors.accent.opacity(0.1)
                        : Color.clear
                )
            }
            .listStyle(.insetGrouped)
        }
    }

    private var countriesStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Follow Countries")
                    .font(.title2.bold())
                Text("Select countries you want news from")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
            .padding(.horizontal, Theme.Spacing.lg)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))], spacing: Theme.Spacing.sm) {
                    ForEach(viewModel.availableCountries) { country in
                        Button {
                            viewModel.toggleCountry(country.id)
                        } label: {
                            HStack {
                                Text(country.flag)
                                Text(country.name)
                                    .font(Theme.Fonts.captionMedium())
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Theme.Colors.primaryText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(
                                viewModel.selectedCountries.contains(country.id)
                                    ? AnyShapeStyle(Theme.Colors.accent.opacity(0.15))
                                    : AnyShapeStyle(Theme.Colors.cardBackground),
                                in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                            )
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
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }

    private var topicsStep: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Pick Your Topics")
                    .font(.title2.bold())
                Text("Choose at least 3 topics (\(viewModel.selectedTopics.count) selected)")
                    .font(Theme.Fonts.body())
                    .foregroundStyle(Theme.Colors.secondaryText)
            }
            .padding(.horizontal, Theme.Spacing.lg)

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: Theme.Spacing.sm) {
                    ForEach(viewModel.availableTopics) { topic in
                        Button {
                            viewModel.toggleTopic(topic.id)
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: topic.icon).font(.caption)
                                Text(topic.name)
                                    .font(Theme.Fonts.captionMedium())
                                    .lineLimit(1)
                            }
                            .foregroundStyle(
                                viewModel.selectedTopics.contains(topic.id)
                                    ? .white : Theme.Colors.primaryText
                            )
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(
                                viewModel.selectedTopics.contains(topic.id)
                                    ? AnyShapeStyle(Theme.Colors.accent)
                                    : AnyShapeStyle(Theme.Colors.cardBackground),
                                in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }

    // MARK: - Bottom Buttons

    private var bottomButtons: some View {
        HStack(spacing: Theme.Spacing.md) {
            if viewModel.currentStep != .welcome {
                Button("Back") {
                    viewModel.previousStep()
                }
                .font(Theme.Fonts.bodyMedium())
                .foregroundStyle(Theme.Colors.secondaryText)
            }

            Spacer()

            Button {
                if viewModel.isLastStep {
                    let prefs = viewModel.buildPreferences()
                    appViewModel.completeOnboarding(with: prefs)
                } else {
                    viewModel.nextStep()
                }
            } label: {
                Text(viewModel.isLastStep ? "Get Started" : "Continue")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .glassEffect(
                        .regular.tint(.blue).interactive(),
                        in: RoundedRectangle(cornerRadius: Theme.CornerRadius.medium)
                    )
            }
            .opacity(viewModel.canProceed ? 1.0 : 0.5)
            .disabled(!viewModel.canProceed)
        }
        .padding(Theme.Spacing.lg)
    }
}

#Preview {
    OnboardingFlowView()
        .environment(AppViewModel())
}
