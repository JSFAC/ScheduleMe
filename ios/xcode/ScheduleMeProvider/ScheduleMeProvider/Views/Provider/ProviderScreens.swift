import SwiftUI
import UniformTypeIdentifiers

enum ProviderMoreDestination: Hashable {
    case calendar
    case businessHours
    case services
    case clients
    case settings
    case editListing
}

struct ProviderMoreView: View {
    @State private var path: [ProviderMoreDestination] = []
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = true
    private let moreItems: [(title: String, icon: String, destination: ProviderMoreDestination)] = [
        ("Services", "briefcase", .services),
        ("Business Hours", "clock", .businessHours),
        ("Edit Listing", "square.and.pencil", .editListing),
        ("Clients", "person.2", .clients),
        ("Settings", "gearshape", .settings)
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                ScheduleMeBackground()
                    .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 10) {
                        VStack(spacing: 2) {
                            Text("FOR PROVIDERS")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .tracking(1.5)
                                .foregroundStyle(ScheduleMeTheme.accent)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 4)

                        ForEach(moreItems, id: \.title) { item in
                            ProviderMoreRow(title: item.title, icon: item.icon) { path.append(item.destination) }
                        }

                        ProviderMoreThemeToggleRow(isDarkMode: $darkModeEnabled)
                    }
                    .padding(16)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    ScheduleMeWordmark(size: 24)
                }
            }
            .navigationDestination(for: ProviderMoreDestination.self) { destination in
                switch destination {
                case .calendar:
                    ProviderCalendarView()
                case .businessHours:
                    ProviderBusinessHoursView()
                case .services:
                    ProviderServicesView()
                case .clients:
                    ProviderClientsView()
                case .settings:
                    ProviderSettingsView()
                case .editListing:
                    ProviderEditListingView()
                }
            }
        }
    }
}

struct ProviderEditListingView: View {
    struct EditableImage: Identifiable, Equatable {
        let id: UUID
        var url: String
    }

    private enum PreviewMode: String, CaseIterable, Identifiable {
        case compact
        case open

        var id: String { rawValue }
        var title: String {
            switch self {
            case .compact: return "Compact"
            case .open: return "Open Card"
            }
        }
    }

    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var isEditMode = false
    @State private var providerName = ""
    @State private var ownerName = ""
    @State private var phone = ""
    @State private var cityAddress = ""
    @State private var description = ""
    @State private var website = ""
    @State private var instagram = ""
    @State private var services: [String] = []
    @State private var newService = ""
    @State private var images: [EditableImage] = []
    @State private var newImageURL = ""
    @State private var showAddImageSheet = false
    @State private var draggingImageID: UUID?
    @State private var previewMode: PreviewMode = .open
    @State private var openPreviewImageIndex = 0
    @State private var isSaving = false
    @State private var message: String?

    private var coverImageURL: String {
        images.first?.url ?? ""
    }

    private var coverImageURLObject: URL? {
        let normalized = normalizeImageURL(coverImageURL)
        guard !normalized.isEmpty else { return nil }
        return URL(string: normalized)
    }

    private var previewImageURLs: [URL] {
        images
            .map(\.url)
            .map(normalizeImageURL)
            .filter { !$0.isEmpty }
            .compactMap(URL.init(string:))
    }

    private var openPreviewPriceLabel: String? {
        if let firstPriced = providerStore.services.first(where: { $0.priceCents != nil }) {
            return firstPriced.priceLabel
        }
        return nil
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        HStack(spacing: 8) {
                            Text("Listing Preview")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                            Spacer()
                            Button(isEditMode ? "Done Editing" : "Edit Card") {
                                withAnimation(.easeInOut(duration: 0.2)) { isEditMode.toggle() }
                                if !isEditMode {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                        proxy.scrollTo("edit-card-section", anchor: .top)
                                    }
                                }
                            }
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundStyle(isEditMode ? Color.white : ScheduleMeTheme.titleText)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(isEditMode ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                        }

                        previewModePicker

                        Group {
                            switch previewMode {
                            case .compact:
                                consumerStylePreviewCard
                            case .open:
                                openBusinessCardPreview
                            }
                        }

                        if isEditMode {
                            editFieldsCard
                                .id("edit-card-section")
                            servicesEditorCard
                            imagesEditorCard
                        }

                        Button(isSaving ? "Saving..." : "Save Listing") {
                            Task { await save() }
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                        .disabled(isSaving)

                        if let message {
                            Text(message)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Edit Listing")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAddImageSheet) {
            addImageSheet
        }
        .task {
            await providerStore.refreshAll()
            await providerStore.loadServices()
            providerName = providerStore.profile?.name ?? ""
            ownerName = providerStore.profile?.ownerName ?? ""
            phone = providerStore.profile?.phone ?? ""
            cityAddress = providerStore.profile?.address ?? ""
            description = providerStore.profile?.description ?? ""
            website = providerStore.profile?.website ?? ""
            instagram = providerStore.profile?.instagram ?? ""

            services = providerStore.profile?.serviceTags ?? []
            if services.isEmpty {
                services = providerStore.services.map(\.name)
            }

            let rawMedia = providerStore.profile?.mediaURLs ?? []
            if rawMedia.isEmpty, let cover = providerStore.profile?.coverURL, !cover.isEmpty {
                images = [EditableImage(id: UUID(), url: cover)]
            } else {
                images = rawMedia.map { EditableImage(id: UUID(), url: $0) }
            }
            await prefetchPreviewImages(urls: images.map(\.url))
        }
        .onChange(of: images) { _, newImages in
            let maxIndex = max(newImages.count - 1, 0)
            openPreviewImageIndex = min(openPreviewImageIndex, maxIndex)
        }
    }

    private var consumerStylePreviewCard: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 14) {
                ZStack(alignment: .topLeading) {
                    Group {
                        if let url = coverImageURLObject {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image): image.resizable().scaledToFill()
                                default: Rectangle().fill(ScheduleMeTheme.pageBackground)
                                }
                            }
                        } else {
                            Rectangle()
                                .fill(ScheduleMeTheme.pageBackground)
                                .overlay(
                                    Image(systemName: "photo")
                                        .font(.system(size: 22, weight: .semibold))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                )
                        }
                    }
                    .frame(width: 100, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color(hex: "22C55E"), lineWidth: 1.5)
                    )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(providerName.isEmpty ? "Your Business Name" : providerName)
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .lineLimit(1)

                    Text(description.isEmpty ? "Add a short description about your business." : description)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)

                    HStack(spacing: 6) {
                        if services.isEmpty {
                            Text("No service tags yet")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                        } else {
                            ForEach(Array(services.prefix(3)), id: \.self) { tag in
                                Text(tag)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                    .foregroundStyle(Color(hex: "9AE6D7"))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color(hex: "0F766E").opacity(0.25))
                                    .clipShape(Capsule())
                            }
                        }
                    }

                    HStack(spacing: 6) {
                        openPill
                        Text("•").foregroundStyle(ScheduleMeTheme.mutedText)
                        Text(cityAddress.isEmpty ? "City not set" : cityAddress)
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
        }
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
    }

    private var previewModePicker: some View {
        HStack(spacing: 8) {
            ForEach(PreviewMode.allCases) { mode in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        previewMode = mode
                    }
                } label: {
                    Text(mode.title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundStyle(previewMode == mode ? Color.white : ScheduleMeTheme.titleText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(previewMode == mode ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)
            }
        }
    }

    private var openBusinessCardPreview: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 0) {
                if previewImageURLs.isEmpty {
                    Rectangle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .frame(height: 260)
                        .overlay(
                            Image(systemName: "building.2")
                                .font(.system(size: 46, weight: .light))
                                .foregroundStyle(ScheduleMeTheme.accent.opacity(0.5))
                        )
                } else {
                    ZStack {
                        TabView(selection: $openPreviewImageIndex) {
                            ForEach(Array(previewImageURLs.enumerated()), id: \.offset) { index, url in
                                ZStack {
                                    ScheduleMeTheme.pageBackground
                                    AsyncImage(url: url) { phase in
                                        switch phase {
                                        case .success(let image):
                                            image.resizable().scaledToFit()
                                        default:
                                            Rectangle().fill(ScheduleMeTheme.pageBackground)
                                        }
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                }
                                .tag(index)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .automatic))
                        .frame(height: 260)
                    }
                }

                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(providerName.isEmpty ? "Your Business Name" : providerName)
                            .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .lineLimit(3)

                        Text(description.isEmpty ? "Add a short description about your business." : description)
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .lineLimit(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                        HStack(spacing: 12) {
                            HStack(spacing: 4) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 13))
                                    .foregroundColor(.orange)
                                Text("New")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("(0)")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                            Text("•").foregroundColor(ScheduleMeTheme.mutedText)
                            Text(cityAddress.isEmpty ? "City not set" : cityAddress)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .lineLimit(1)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                if services.isEmpty {
                                    Text("No service tags yet")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                } else {
                                    ForEach(Array(services.prefix(6)), id: \.self) { tag in
                                        Text(tag)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                            .foregroundStyle(ScheduleMeTheme.accent)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(ScheduleMeTheme.accentSoft)
                                            .clipShape(Capsule())
                                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                                    }
                                }
                            }
                        }

                        Button("Book Now") {}
                            .buttonStyle(ScheduleMePrimaryButtonStyle())
                            .disabled(true)
                            .opacity(0.85)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Services")
                                .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                .foregroundStyle(ScheduleMeTheme.titleText)

                            if providerStore.services.isEmpty && services.isEmpty {
                                Text("Add services below to see them here.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                            } else {
                                ForEach(Array(providerStore.services.prefix(4))) { service in
                                    ScheduleMeCard {
                                        HStack(alignment: .top, spacing: 10) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(service.name)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                                    .foregroundColor(ScheduleMeTheme.titleText)
                                                if let description = service.description, !description.isEmpty {
                                                    Text(description)
                                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                                        .lineLimit(2)
                                                }
                                                Text(service.durationLabel)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                            }
                                            Spacer()
                                            Text(service.priceLabel)
                                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                                                .foregroundColor(ScheduleMeTheme.accent)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }

                                if providerStore.services.isEmpty {
                                    ForEach(Array(services.prefix(4)), id: \.self) { service in
                                        ScheduleMeCard {
                                            HStack {
                                                Text(service)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                                    .foregroundColor(ScheduleMeTheme.titleText)
                                                Spacer()
                                                Text(openPreviewPriceLabel ?? "Custom")
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                                                    .foregroundColor(ScheduleMeTheme.accent)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Reviews")
                                .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                            ScheduleMeCard {
                                Text("No reviews yet")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Calendar")
                                .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                            ScheduleMeCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Image(systemName: "chevron.left")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(ScheduleMeTheme.mutedText)
                                        Spacer()
                                        Text(Date().formatted(.dateTime.month(.wide).year()))
                                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                            .foregroundStyle(ScheduleMeTheme.titleText)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(ScheduleMeTheme.mutedText)
                                    }

                                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 6) {
                                        ForEach(Array(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].enumerated()), id: \.offset) { _, day in
                                            Text(day)
                                                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                                                .foregroundStyle(ScheduleMeTheme.mutedText)
                                        }

                                        ForEach(previewCalendarDays, id: \.self) { day in
                                            let weekday = Calendar.current.component(.weekday, from: day)
                                            let isOpenDay = previewOpenWeekdays.contains(weekday)
                                            let isCurrentMonth = Calendar.current.isDate(day, equalTo: Date(), toGranularity: .month)
                                            Text(day.formatted(.dateTime.day()))
                                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                                .foregroundStyle(
                                                    isOpenDay && isCurrentMonth ? ScheduleMeTheme.titleText : ScheduleMeTheme.mutedText
                                                )
                                                .frame(maxWidth: .infinity, minHeight: 26)
                                                .background(
                                                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                                                        .fill(isOpenDay && isCurrentMonth ? ScheduleMeTheme.accent.opacity(0.35) : Color.clear)
                                                )
                                        }
                                    }
                                }
                            }
                        }
                }
                .padding(14)
                }
        }
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
    }

    private var editFieldsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Business Info")
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            TextField("Provider name", text: $providerName).modifier(ScheduleMeFieldModifier())
            TextField("Description", text: $description, axis: .vertical).modifier(ScheduleMeFieldModifier())
            TextField("Address / City", text: $cityAddress).modifier(ScheduleMeFieldModifier())
            TextField("Phone", text: $phone).keyboardType(.phonePad).modifier(ScheduleMeFieldModifier())
            TextField("Website", text: $website)
                .modifier(ScheduleMeFieldModifier())
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Instagram", text: $instagram)
                .modifier(ScheduleMeFieldModifier())
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Owner name", text: $ownerName).modifier(ScheduleMeFieldModifier())
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private var servicesEditorCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Services")
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            if !providerStore.services.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Current service listings")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                    ForEach(providerStore.services.prefix(5)) { service in
                        HStack {
                            Text(service.name)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                            Spacer()
                            Text(service.priceLabel)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                                .foregroundStyle(ScheduleMeTheme.accent)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Add service", text: $newService)
                    .modifier(ScheduleMeFieldModifier())
                Button("Add") {
                    let trimmed = newService.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    if !services.contains(trimmed) {
                        services.append(trimmed)
                    }
                    newService = ""
                }
                .buttonStyle(.borderedProminent)
                .tint(ScheduleMeTheme.accent)
            }

            if services.isEmpty {
                Text("No services yet")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            } else {
                FlowLayout(spacing: 8) {
                    ForEach(services, id: \.self) { service in
                        HStack(spacing: 6) {
                            Text(service)
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                            Button {
                                services.removeAll { $0 == service }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color(hex: "FCA5A5"))
                            }
                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                    }
                }
            }
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private var imagesEditorCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Images")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Spacer()
                Button {
                    showAddImageSheet = true
                } label: {
                    Label("Add Image", systemImage: "plus")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(ScheduleMeTheme.accent)
            }

            Text("Drag to reorder. First image is the cover.")
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.mutedText)

            if images.isEmpty {
                Text("No images yet")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                        imageRow(image, index: index)
                            .onDrag {
                                draggingImageID = image.id
                                return NSItemProvider(object: image.id.uuidString as NSString)
                            }
                            .onDrop(of: [UTType.text], delegate: ProviderImageDropDelegate(
                                item: image,
                                items: $images,
                                draggingID: $draggingImageID
                            ))
                    }
                }
            }
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private func imageRow(_ image: EditableImage, index: Int) -> some View {
        HStack(spacing: 10) {
            AsyncImage(url: URL(string: normalizeImageURL(image.url))) { phase in
                switch phase {
                case .success(let rendered):
                    rendered.resizable().scaledToFill()
                default:
                    Rectangle().fill(ScheduleMeTheme.pageBackground)
                }
            }
            .frame(width: 72, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(index == 0 ? Color(hex: "22C55E") : ScheduleMeTheme.cardBorder, lineWidth: index == 0 ? 1.5 : 1)
            )

            VStack(alignment: .leading, spacing: 4) {
                Text(image.id == images.first?.id ? "Cover Image" : "Gallery Image")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Text("Drag to reorder")
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
            Spacer()
            VStack(spacing: 6) {
                Button {
                    moveImage(from: index, to: index - 1)
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(index == 0 ? ScheduleMeTheme.mutedText : ScheduleMeTheme.titleText)
                        .frame(width: 26, height: 22)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(ScheduleMeTheme.cardBorder))
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)
                .disabled(index == 0)

                Button {
                    moveImage(from: index, to: index + 1)
                } label: {
                    Image(systemName: "arrow.down")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(index >= images.count - 1 ? ScheduleMeTheme.mutedText : ScheduleMeTheme.titleText)
                        .frame(width: 26, height: 22)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(ScheduleMeTheme.cardBorder))
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)
                .disabled(index >= images.count - 1)
            }
            Button {
                images.removeAll { $0.id == image.id }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color(hex: "FCA5A5"))
            }
            .contentShape(Rectangle())
        .buttonStyle(.plain)
        }
        .padding(8)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
    }

    private var addImageSheet: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TextField("Paste image URL", text: $newImageURL)
                    .modifier(ScheduleMeFieldModifier())
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Button("Add Image") {
                    let normalized = normalizeImageURL(newImageURL)
                    guard !normalized.isEmpty else { return }
                    images.append(EditableImage(id: UUID(), url: normalized))
                    newImageURL = ""
                    showAddImageSheet = false
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                Spacer()
            }
            .padding(16)
            .navigationTitle("Add Image")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { showAddImageSheet = false }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private var openPill: some View {
        HStack(spacing: 4) {
            Circle().fill(Color.green).frame(width: 6, height: 6)
            Text("Open")
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .foregroundColor(.green)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(Color.green.opacity(0.12))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.green.opacity(0.3)))
    }

    private func normalizeWebsite(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return trimmed }
        return "https://\(trimmed)"
    }

    private func normalizeInstagram(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.contains("instagram.com") { return normalizeWebsite(trimmed) }
        return "https://instagram.com/\(trimmed.replacingOccurrences(of: "@", with: ""))"
    }

    private func normalizeImageURL(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return trimmed }
        return "https://\(trimmed)"
    }

    private var previewHoursRows: [(day: String, hours: String)] {
        let canonical = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        let raw = providerStore.profile?.hours ?? [:]
        let lookup = Dictionary(uniqueKeysWithValues: raw.map { ($0.key.lowercased(), $0.value) })
        return canonical.compactMap { day in
            let key = day.lowercased()
            let short = String(key.prefix(3))
            guard let value = lookup[key] ?? lookup[short] else { return nil }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return (day: String(day.prefix(3)), hours: trimmed)
        }
    }

    private var previewOpenWeekdays: Set<Int> {
        var open: Set<Int> = []
        let dayToWeekday: [String: Int] = [
            "sun": 1, "mon": 2, "tue": 3, "wed": 4, "thu": 5, "fri": 6, "sat": 7
        ]
        for row in previewHoursRows {
            let key = String(row.day.prefix(3)).lowercased()
            if let weekday = dayToWeekday[key] {
                open.insert(weekday)
            }
        }
        return open
    }

    private var previewCalendarDays: [Date] {
        let calendar = Calendar.current
        let month = Date()
        guard let monthInterval = calendar.dateInterval(of: .month, for: month),
              let firstWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start),
              let lastDay = calendar.date(byAdding: .day, value: -1, to: monthInterval.end),
              let lastWeek = calendar.dateInterval(of: .weekOfMonth, for: lastDay) else {
            return []
        }

        var results: [Date] = []
        var cursor = firstWeek.start
        while cursor < lastWeek.end {
            results.append(cursor)
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return results
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let tags = services.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            let media = images.map { normalizeImageURL($0.url) }.filter { !$0.isEmpty }
            try await providerStore.updateProviderProfile(
                name: providerName.trimmingCharacters(in: .whitespacesAndNewlines),
                ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                address: cityAddress.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                website: normalizeWebsite(website),
                instagram: normalizeInstagram(instagram),
                coverURL: media.first ?? "",
                mediaURLs: media,
                serviceTags: tags
            )
            message = "Listing updated."
            await providerStore.refreshAll()
        } catch {
            message = error.localizedDescription
        }
    }

    private func moveImage(from: Int, to: Int) {
        guard from >= 0, from < images.count, to >= 0, to < images.count, from != to else { return }
        withAnimation(.easeInOut(duration: 0.18)) {
            let item = images.remove(at: from)
            images.insert(item, at: to)
        }
    }

    private func prefetchPreviewImages(urls: [String]) async {
        await withTaskGroup(of: Void.self) { group in
            for raw in urls.prefix(8) {
                let normalized = normalizeImageURL(raw)
                guard let url = URL(string: normalized), !normalized.isEmpty else { continue }
                group.addTask {
                    var request = URLRequest(url: url)
                    request.cachePolicy = .returnCacheDataElseLoad
                    _ = try? await URLSession.shared.data(for: request)
                }
            }
        }
    }
}

private struct ProviderImageDropDelegate: DropDelegate {
    let item: ProviderEditListingView.EditableImage
    @Binding var items: [ProviderEditListingView.EditableImage]
    @Binding var draggingID: UUID?

    func dropEntered(info: DropInfo) {
        guard let draggingID,
              let from = items.firstIndex(where: { $0.id == draggingID }),
              let to = items.firstIndex(where: { $0.id == item.id }),
              from != to else { return }

        withAnimation(.easeInOut(duration: 0.15)) {
            let moved = items.remove(at: from)
            items.insert(moved, at: to)
        }
    }

    func performDrop(info: DropInfo) -> Bool {
        draggingID = nil
        return true
    }
}

private struct FlowLayout<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            content
        }
    }
}

struct ProviderBusinessHoursView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var dayRows: [DayHoursRow] = []
    @State private var expandedDays: Set<String> = []
    @State private var isSaving = false
    @State private var statusMessage: String?
    @State private var isHydrating = false

    private let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    private let timeSlots: [Date] = {
        var slots: [Date] = []
        let calendar = Calendar.current
        let base = calendar.startOfDay(for: Date())
        for step in stride(from: 0, through: 95, by: 1) {
            if let date = calendar.date(byAdding: .minute, value: step * 15, to: base) {
                slots.append(date)
            }
        }
        return slots
    }()

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    Group {
                        if isHydrating && dayRows.isEmpty {
                            hoursSkeleton
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Business Hours")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.bold))
                                    .foregroundStyle(ScheduleMeTheme.titleText)

                                VStack(spacing: 8) {
                                    ForEach($dayRows) { $row in
                                        VStack(alignment: .leading, spacing: 6) {
                                            HStack(spacing: 8) {
                                                Text(row.day)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                                    .foregroundStyle(ScheduleMeTheme.titleText)
                                                Spacer(minLength: 6)
                                                if row.isOpen {
                                                    Text("\(row.startTime.formatted(date: .omitted, time: .shortened)) - \(row.endTime.formatted(date: .omitted, time: .shortened))")
                                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                                } else {
                                                    Text("Closed")
                                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                                }

                                                Toggle("", isOn: $row.isOpen)
                                                    .labelsHidden()
                                                    .tint(ScheduleMeTheme.accent)
                                                    .scaleEffect(0.76)
                                                    .onChange(of: row.isOpen) { _, isOpen in
                                                        if !isOpen {
                                                            expandedDays.remove(row.day)
                                                        } else {
                                                            expandedDays.insert(row.day)
                                                        }
                                                    }

                                                if row.isOpen {
                                                    Button {
                                                        if expandedDays.contains(row.day) {
                                                            expandedDays.remove(row.day)
                                                        } else {
                                                            expandedDays.insert(row.day)
                                                        }
                                                    } label: {
                                                        Image(systemName: expandedDays.contains(row.day) ? "chevron.up" : "chevron.down")
                                                            .font(.system(size: 12, weight: .bold))
                                                            .foregroundStyle(ScheduleMeTheme.mutedText)
                                                            .frame(width: 30, height: 30)
                                                            .contentShape(Rectangle())
                                                    }
                                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                                                }
                                            }
                                            .contentShape(Rectangle())
                                            .onTapGesture {
                                                guard row.isOpen else { return }
                                                if expandedDays.contains(row.day) {
                                                    expandedDays.remove(row.day)
                                                } else {
                                                    expandedDays.insert(row.day)
                                                }
                                            }

                                            if row.isOpen && expandedDays.contains(row.day) {
                                                HStack(spacing: 6) {
                                                    compactTimePicker("Start", selection: $row.startTime)
                                                    compactTimePicker("End", selection: $row.endTime)
                                                }
                                            }
                                        }
                                        .padding(8)
                                        .background(ScheduleMeTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                                    }
                                }

                                Button(isSaving ? "Saving..." : "Save Hours") {
                                    Task {
                                        isSaving = true
                                        defer { isSaving = false }
                                        do {
                                            let cleaned = dictionaryFromRows(dayRows)
                                            try await providerStore.updateBusinessHours(cleaned)
                                            await providerStore.refreshAll(force: false)
                                            dayRows = rowsFromHours(providerStore.profile?.hours ?? cleaned)
                                            statusMessage = "Business hours saved."
                                        } catch {
                                            statusMessage = error.localizedDescription
                                        }
                                    }
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                            }
                        }
                    }
                    .padding(10)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
                }
                .padding(16)
            }
        }
        .navigationTitle("Business Hours")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if dayRows.isEmpty {
                dayRows = rowsFromHours(providerStore.profile?.hours ?? [:])
            }
            if dayRows.isEmpty {
                isHydrating = true
            }
            await providerStore.refreshAll(force: false)
            dayRows = rowsFromHours(providerStore.profile?.hours ?? [:])
            isHydrating = false
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(45))
                guard !isSaving else { continue }
                await providerStore.refreshAll(force: false)
                dayRows = rowsFromHours(providerStore.profile?.hours ?? [:])
            }
        }
        .onChange(of: providerStore.profile?.hours ?? [:]) { _, newHours in
            dayRows = rowsFromHours(newHours)
        }
        .safeAreaInset(edge: .bottom) {
            if let statusMessage {
                Text(statusMessage)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ScheduleMeTheme.surface)
            }
        }
    }

    private var hoursSkeleton: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(ScheduleMeTheme.cardBorder)
                .frame(width: 130, height: 14)
            ForEach(0..<5, id: \.self) { _ in
                VStack(spacing: 6) {
                    HStack {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(ScheduleMeTheme.cardBorder)
                            .frame(width: 90, height: 12)
                        Spacer()
                        RoundedRectangle(cornerRadius: 999, style: .continuous)
                            .fill(ScheduleMeTheme.cardBorder)
                            .frame(width: 44, height: 24)
                    }
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(ScheduleMeTheme.cardBorder)
                            .frame(height: 34)
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(ScheduleMeTheme.cardBorder)
                            .frame(height: 34)
                    }
                }
                .padding(9)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                .redacted(reason: .placeholder)
                .scheduleMeShimmer()
            }
        }
    }

    private func compactTimePicker(_ label: String, selection: Binding<Date>) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
            Spacer(minLength: 6)
            Menu {
                ForEach(timeSlots, id: \.self) { slot in
                    Button(slot.formatted(date: .omitted, time: .shortened)) {
                        selection.wrappedValue = slot
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 11, weight: .semibold))
                    Text(selection.wrappedValue.formatted(date: .omitted, time: .shortened))
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(ScheduleMeTheme.titleText)
            }
            .tint(ScheduleMeTheme.titleText)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 11)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(ScheduleMeTheme.cardBorder))
    }

    private func normalizedHours(_ raw: [String: String]) -> [String: String] {
        var normalized: [String: String] = [:]
        let lowerLookup = Dictionary(uniqueKeysWithValues: raw.map { ($0.key.lowercased(), $0.value) })
        for day in days {
            let key = day.lowercased()
            if let value = lowerLookup[key], !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                normalized[day] = value
            } else if let value = lowerLookup[String(key.prefix(3))], !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                normalized[day] = value
            }
        }
        return normalized
    }

    private func rowsFromHours(_ raw: [String: String]) -> [DayHoursRow] {
        let normalized = normalizedHours(raw)
        let defaultStart = timeSlots[min(36, max(0, timeSlots.count - 1))] // 9:00 AM
        let defaultEnd = timeSlots[min(72, max(0, timeSlots.count - 1))] // 6:00 PM
        return days.map { day in
            if let value = normalized[day], !value.isEmpty {
                let components: [String]
                if value.contains("-") {
                    components = value.split(separator: "-", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                } else if value.lowercased().contains(" to ") {
                    components = value.components(separatedBy: " to ").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                } else {
                    components = [value]
                }
                let parts = components
                let start = parseTime(parts.first ?? "") ?? defaultStart
                let end = parseTime(parts.count > 1 ? parts[1] : "") ?? defaultEnd
                return DayHoursRow(day: day, isOpen: true, startTime: start, endTime: end)
            }
            return DayHoursRow(day: day, isOpen: false, startTime: defaultStart, endTime: defaultEnd)
        }
    }

    private func dictionaryFromRows(_ rows: [DayHoursRow]) -> [String: String] {
        var result: [String: String] = [:]
        for row in rows where row.isOpen {
            let start = row.startTime.formatted(date: .omitted, time: .shortened)
            let end = row.endTime.formatted(date: .omitted, time: .shortened)
            result[row.day] = "\(start) - \(end)"
        }
        return result
    }

    private func parseTime(_ text: String) -> Date? {
        let trimmed = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "  ", with: " ")
        let normalizedMeridiem = trimmed
            .replacingOccurrences(of: "am", with: " AM", options: .caseInsensitive)
            .replacingOccurrences(of: "pm", with: " PM", options: .caseInsensitive)
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        let formats = [
            "h:mm a", "h a", "ha", "h:mma", "h:mmA", "hA",
            "HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss", "HHmm"
        ]
        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: normalizedMeridiem) {
                return date
            }
            if let date = formatter.date(from: trimmed) {
                return date
            }
        }
        return nil
    }
}

private struct DayHoursRow: Identifiable {
    let id = UUID()
    let day: String
    var isOpen: Bool
    var startTime: Date
    var endTime: Date
}

struct ProviderMoreRow: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .frame(width: 20, height: 20)
                    .foregroundStyle(ScheduleMeTheme.accent)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }
}

struct ProviderMoreThemeToggleRow: View {
    @Binding var isDarkMode: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isDarkMode ? "moon.fill" : "sun.max")
                .frame(width: 20, height: 20)
                .foregroundStyle(ScheduleMeTheme.accent)
            Text("Dark Mode")
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)
            Spacer()
            Toggle("", isOn: $isDarkMode)
                .labelsHidden()
                .tint(ScheduleMeTheme.accent)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
    }
}

// Legacy row retained for simple navigation items.
struct ProviderMoreToggleRow: View {
    let title: String
    let icon: String
    let detail: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .frame(width: 20, height: 20)
                    .foregroundStyle(ScheduleMeTheme.accent)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Spacer()
                Text(detail)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.accent)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }
}
