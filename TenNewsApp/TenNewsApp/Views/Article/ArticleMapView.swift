import SwiftUI
import MapKit

/// Map view using MapKit showing MapLocation pins
struct ArticleMapView: View {
    let mapData: MapData

    private var locations: [MapLocation] { mapData.locations ?? [] }

    private var region: MKCoordinateRegion {
        guard !locations.isEmpty else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 20, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 100, longitudeDelta: 100)
            )
        }

        let lats = locations.map(\.latitude)
        let lons = locations.map(\.longitude)
        let centerLat = (lats.min()! + lats.max()!) / 2
        let centerLon = (lons.min()! + lons.max()!) / 2
        let spanLat = max((lats.max()! - lats.min()!) * 1.5, 5)
        let spanLon = max((lons.max()! - lons.min()!) * 1.5, 5)

        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLon),
            span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLon)
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            if let title = mapData.title, !title.isEmpty {
                Text(title.uppercased())
                    .font(Theme.Fonts.sectionLabel())
                    .foregroundStyle(Theme.Colors.secondaryText)
                    .tracking(1)
            }

            Map(initialPosition: .region(region)) {
                ForEach(Array(locations.enumerated()), id: \.offset) { _, location in
                    if let name = location.name {
                        Annotation(name, coordinate: CLLocationCoordinate2D(
                            latitude: location.latitude,
                            longitude: location.longitude
                        )) {
                            VStack(spacing: 2) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(Theme.Colors.accent)
                                Text(name)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(Theme.Colors.primaryText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.regularMaterial, in: Capsule())
                            }
                        }
                    }
                }
            }
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.medium))

            // Location list
            if !locations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(locations.enumerated()), id: \.offset) { _, location in
                        HStack(spacing: 8) {
                            Image(systemName: "mappin")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Colors.accent)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(location.name ?? "Unknown")
                                    .font(Theme.Fonts.captionMedium())
                                    .foregroundStyle(Theme.Colors.primaryText)
                                if let desc = location.description, !desc.isEmpty {
                                    Text(desc)
                                        .font(Theme.Fonts.footnote())
                                        .foregroundStyle(Theme.Colors.secondaryText)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(Theme.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: Theme.CornerRadius.large))
    }
}

#Preview {
    let mapData = MapData(
        type: "points",
        title: "Key Locations",
        locations: [
            MapLocation(name: "New York", lat: 40.7128, lng: -74.0060, lon: nil, description: "UN Headquarters"),
            MapLocation(name: "Geneva", lat: 46.2044, lng: 6.1432, lon: nil, description: "Preliminary talks"),
        ],
        regions: nil
    )
    return ScrollView {
        ArticleMapView(mapData: mapData)
            .padding()
    }
}
