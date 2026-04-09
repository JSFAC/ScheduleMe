// FILE OVERVIEW:
// Location permission + coordinate state for browse/campus/home screens.
//
// DEBUG NOTES:
// If distance or map behavior is wrong, verify permission status and fallback coordinate logic here.

import CoreLocation
import Foundation
import Combine

// MARK: - Location State Manager

@MainActor
final class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var authorizationStatus: CLAuthorizationStatus
    @Published private(set) var coordinate: CLLocationCoordinate2D?

    private let manager = CLLocationManager()

    override init() {
        authorizationStatus = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    /// Requests location permission if needed, or starts updates when already authorized.
    func requestIfNeeded() {
        #if targetEnvironment(simulator)
        // Keep simulator testing deterministic so nearby/search always uses UCSC area
        // unless we intentionally change this fallback.
        coordinate = Self.simulatorFallbackCoordinate
        #else
        switch authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
        default:
            break
        }
        #endif
    }

    /// Reacts to permission changes and starts location updates when access is granted.
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    /// Keeps the latest coordinate for distance filters + nearby API calls.
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        #if targetEnvironment(simulator)
        coordinate = Self.simulatorFallbackCoordinate
        #else
        coordinate = locations.last?.coordinate
        #endif
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        #if DEBUG
        print("Location error: \(error.localizedDescription)")
        #endif
    }
}

extension LocationManager {
    static var simulatorFallbackCoordinate: CLLocationCoordinate2D? {
        #if targetEnvironment(simulator)
        // UCSC / Santa Cruz fallback (ZIP 95064 area) for local simulator testing.
        return CLLocationCoordinate2D(latitude: 36.9916, longitude: -122.0583)
        #else
        return nil
        #endif
    }
}
