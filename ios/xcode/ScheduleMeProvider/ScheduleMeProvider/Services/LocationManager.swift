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
        switch authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
        default:
            break
        }
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
        coordinate = locations.last?.coordinate
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
        return CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437)
        #else
        return nil
        #endif
    }
}
