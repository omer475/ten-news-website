import SwiftUI
import MapKit

struct LocationPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var locationName: String
    @Binding var locationDetail: String
    @Binding var coordinate: CLLocationCoordinate2D?

    @State private var searchText = ""
    @State private var searchResults: [MKMapItem] = []
    @State private var cameraPosition: MapCameraPosition = .region(
        MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 40, longitude: 29),
                           span: MKCoordinateSpan(latitudeDelta: 40, longitudeDelta: 40))
    )
    @State private var selectedMapItem: MKMapItem?
    @State private var pinCoordinate: CLLocationCoordinate2D?
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Map
                Map(position: $cameraPosition) {
                    if let pin = pinCoordinate {
                        Annotation("", coordinate: pin) {
                            VStack(spacing: 0) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.system(size: 32))
                                    .foregroundStyle(.blue)
                                    .shadow(radius: 4)
                                Image(systemName: "arrowtriangle.down.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.blue)
                                    .offset(y: -4)
                            }
                        }
                    }
                }
                .ignoresSafeArea(edges: .bottom)

                // Search overlay
                VStack {
                    // Search bar
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                        TextField("Search places...", text: $searchText)
                            .font(.system(size: 16))
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.words)
                            .onSubmit { performSearch() }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(.ultraThickMaterial, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                    // Search results dropdown
                    if !searchResults.isEmpty {
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(spacing: 0) {
                                ForEach(searchResults, id: \.self) { item in
                                    Button {
                                        selectPlace(item)
                                    } label: {
                                        searchResultRow(item)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .frame(maxHeight: 250)
                        .background(.ultraThickMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 16)
                    }

                    Spacer()

                    // Selected location bar
                    if pinCoordinate != nil {
                        selectedLocationBar
                            .padding(.horizontal, 16)
                            .padding(.bottom, 16)
                    }
                }
            }
            .navigationTitle("Select Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onChange(of: searchText) { _, newValue in
            guard !newValue.isEmpty else {
                searchResults = []
                return
            }
            Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                performSearch()
            }
        }
    }

    // MARK: - Search Result Row

    private func searchResultRow(_ item: MKMapItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name ?? "Unknown")
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)

                if let subtitle = formatSubtitle(item) {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    // MARK: - Selected Location Bar

    private var selectedLocationBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 24))
                .foregroundStyle(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(selectedMapItem?.name ?? "Selected Location")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                if let subtitle = selectedMapItem.flatMap({ formatSubtitle($0) }) {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Button {
                confirmSelection()
            } label: {
                Text("Select")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 8)
                    .background(.blue, in: Capsule())
            }
        }
        .padding(14)
        .background(.ultraThickMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Actions

    private func performSearch() {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = searchText
        let search = MKLocalSearch(request: request)
        search.start { response, _ in
            searchResults = response?.mapItems ?? []
        }
    }

    private func selectPlace(_ item: MKMapItem) {
        selectedMapItem = item
        pinCoordinate = item.placemark.coordinate
        searchResults = []
        searchText = item.name ?? ""

        withAnimation(.easeInOut(duration: 0.5)) {
            cameraPosition = .region(MKCoordinateRegion(
                center: item.placemark.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
            ))
        }
        HapticManager.medium()
    }

    private func confirmSelection() {
        guard let item = selectedMapItem, let coord = pinCoordinate else { return }
        locationName = item.name ?? "Location"
        locationDetail = formatSubtitle(item) ?? ""
        coordinate = coord
        HapticManager.medium()
        dismiss()
    }

    private func formatSubtitle(_ item: MKMapItem) -> String? {
        let placemark = item.placemark
        let parts = [placemark.locality, placemark.administrativeArea, placemark.country]
            .compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }
}
