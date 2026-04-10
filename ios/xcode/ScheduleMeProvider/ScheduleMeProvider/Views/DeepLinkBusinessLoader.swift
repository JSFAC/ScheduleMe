import SwiftUI

struct DeepLinkBusinessLoader: View {
    let lookupKey: String
    let onClose: () -> Void

    @State private var isLoading = true
    @State private var loadedBusiness: BusinessSummary?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if let loadedBusiness {
                    BusinessDetailView(business: loadedBusiness)
                } else if isLoading {
                    VStack(spacing: 14) {
                        ProgressView()
                            .tint(ScheduleMeTheme.accent)
                            .scaleEffect(1.2)
                        Text("Opening business...")
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ScheduleMeTheme.pageBackground)
                } else {
                    ScheduleMePage {
                        ScheduleMeEmptyState(
                            title: "Business not found",
                            message: errorMessage ?? "This link may be expired or unavailable.",
                            systemImage: "mappin.slash"
                        )
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { onClose() }
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }
            }
            .task(id: lookupKey) {
                await loadBusiness()
            }
        }
    }

    private func loadBusiness() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let isUUIDLike = UUID(uuidString: lookupKey) != nil
        let query = isUUIDLike
            ? [URLQueryItem(name: "id", value: lookupKey)]
            : [URLQueryItem(name: "slug", value: lookupKey)]

        do {
            let response: BusinessLookupResponse = try await APIClient.shared.get(
                path: "/api/business-lookup",
                queryItems: query
            )
            if let business = response.business {
                loadedBusiness = business
            } else {
                errorMessage = response.error ?? "Business not found."
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct BusinessLookupResponse: Decodable {
    let business: BusinessSummary?
    let error: String?
}
