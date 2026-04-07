// FILE OVERVIEW:
// MapKit style helpers and reusable map configuration modifiers.
//
// DEBUG NOTES:
// Map appearance mismatches should be corrected in this helper layer.

import SwiftUI
import MapKit

// MARK: - Map Styling Helpers

extension View {
    @ViewBuilder
    func applyScheduleMeMapStyle() -> some View {
        // iOS 17+ map style to keep visual consistency with app theme.
        if #available(iOS 17.0, *) {
            self
                .mapStyle(.standard(elevation: .flat, emphasis: .muted))
        } else {
            self
        }
    }
}
