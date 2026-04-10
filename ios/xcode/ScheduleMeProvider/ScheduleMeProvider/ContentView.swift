// FILE OVERVIEW:
// Legacy/simple shell view retained for compatibility in previews or older flows.
//
// DEBUG NOTES:
// If currently unused, keep in sync with root architecture to avoid stale references.

//
//  ContentView.swift
//  ScheduleMe
//
//  Created by Joshua on 3/30/26.
//

import SwiftUI

// MARK: - Legacy Placeholder View

struct ContentView: View {
    var body: some View {
        // Placeholder legacy view (not primary app entry).
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, world!")
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
