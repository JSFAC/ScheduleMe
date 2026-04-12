import SwiftUI

struct ProviderServicesView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var editingService: ProviderService?
    @State private var showingCreate = false
    @State private var errorText: String?
    @State private var customRequestRequiresExactTime = true
    @State private var isSavingCustomRequestScheduling = false

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 10) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Custom Request Scheduling")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.titleText)

                            HStack(alignment: .center, spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(customRequestRequiresExactTime ? "Exact time required" : "Due date only")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundStyle(ScheduleMeTheme.titleText)
                                    Text("Choose whether custom requests need an exact time or just a due date.")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                        .multilineTextAlignment(.leading)
                                        .lineLimit(2)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                Toggle("", isOn: $customRequestRequiresExactTime)
                                    .labelsHidden()
                                    .toggleStyle(SwitchToggleStyle(tint: ScheduleMeTheme.accent))
                                    .disabled(isSavingCustomRequestScheduling)
                            }
                        }
                    }
                    .onChange(of: customRequestRequiresExactTime) { _, newValue in
                        Task {
                            isSavingCustomRequestScheduling = true
                            defer { isSavingCustomRequestScheduling = false }
                            do {
                                try await providerStore.updateCustomRequestScheduling(requiresExactTime: newValue)
                                errorText = nil
                            } catch {
                                errorText = error.localizedDescription
                            }
                        }
                    }

                    if providerStore.services.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No services yet",
                            message: "Create your first service so customers can request it.",
                            systemImage: "briefcase"
                        )
                    } else {
                        ForEach(providerStore.services) { service in
                            ScheduleMeCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(service.name)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                            .foregroundStyle(ScheduleMeTheme.titleText)
                                        Spacer()
                                        Text(service.priceLabel)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.bold))
                                            .foregroundStyle(ScheduleMeTheme.titleText)
                                    }
                                    Text(service.description ?? "No description")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)
                                    HStack {
                                        Text(service.durationLabel)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                            .foregroundStyle(ScheduleMeTheme.accent)
                                        Spacer()
                                        Button("Edit") { editingService = service }
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                                        Button("Delete", role: .destructive) {
                                            Task {
                                                do {
                                                    try await providerStore.deleteService(id: service.id)
                                                    errorText = nil
                                                } catch {
                                                    errorText = error.localizedDescription
                                                }
                                            }
                                        }
                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                        .foregroundStyle(Color(hex: "F87171"))
                                        .contentShape(Rectangle())
        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("Services")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingCreate = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let errorText {
                Text(errorText)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(.red)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ScheduleMeTheme.surface)
            }
        }
        .sheet(isPresented: $showingCreate) {
            ProviderServiceEditorSheet(mode: .create, service: nil)
        }
        .sheet(item: $editingService) { service in
            ProviderServiceEditorSheet(mode: .edit, service: service)
        }
        .task {
            await providerStore.refreshAll()
            customRequestRequiresExactTime = providerStore.profile?.customRequestRequiresExactTime ?? true
        }
    }
}

struct ProviderServiceEditorSheet: View {
    enum Mode { case create, edit }

    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.dismiss) private var dismiss

    let mode: Mode
    let service: ProviderService?

    @State private var name = ""
    @State private var description = ""
    @State private var priceDigits = ""
    @State private var priceText = ""
    @State private var duration = ""
    @State private var requiresExactTime = true
    @State private var errorText: String?
    private let minServiceCents = 500

    var body: some View {
        NavigationStack {
            ZStack {
                ScheduleMeBackground()
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 10) {
                        TextField("Service name", text: $name)
                            .modifier(ScheduleMeFieldModifier())
                            .scheduleMePasteMenu($name)

                        TextField("Description", text: $description, axis: .vertical)
                            .modifier(ScheduleMeFieldModifier())
                            .scheduleMePasteMenu($description)

                        HStack(spacing: 8) {
                            HStack(spacing: 0) {
                                Text("$")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                                    .padding(.leading, 12)
                                TextField("0.00", text: $priceText)
                                .keyboardType(.numberPad)
                                .scheduleMePasteMenu($priceText)
                                .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                                .padding(.leading, 4)
                                .padding(.trailing, 12)
                                .onChange(of: priceText) { _, newValue in
                                    let digits = newValue.filter(\.isNumber)
                                    priceDigits = digits
                                    let formatted = formatCentsDigits(digits)
                                    if formatted != newValue {
                                        priceText = formatted
                                    }
                                }
                            }
                            .padding(.vertical, 10)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(ScheduleMeTheme.cardBorder)
                                    .allowsHitTesting(false)
                            )

                            TextField("Time (minutes)", text: $duration)
                                .keyboardType(.numberPad)
                                .modifier(ScheduleMeFieldModifier())
                                .scheduleMePasteMenu($duration)
                        }

                        if let minimumPriceWarning {
                            Text(minimumPriceWarning)
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundStyle(Color(hex: "F59E0B"))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Toggle(isOn: $requiresExactTime) {
                            Text(requiresExactTime ? "Exact Time Required" : "Exact Time Optional")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.titleText)
                        }
                        .toggleStyle(SwitchToggleStyle(tint: ScheduleMeTheme.accent))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(ScheduleMeTheme.cardBorder)
                                .allowsHitTesting(false)
                        )

                        if let errorText {
                            Text(errorText)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Button(mode == .create ? "Create Service" : "Save Changes") {
                            Task { await save() }
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                        .disabled(!canSubmit)
                        .opacity(canSubmit ? 1 : 0.7)
                    }
                    .padding(16)
                }
            }
            .navigationTitle(mode == .create ? "New Service" : "Edit Service")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                }
            }
            .onAppear {
                guard let service else { return }
                name = service.name
                description = service.description ?? ""
                if let cents = service.priceCents {
                    priceDigits = String(cents)
                    priceText = formatCentsDigits(priceDigits)
                }
                if let durationMin = service.durationMin {
                    duration = "\(durationMin)"
                }
                requiresExactTime = service.requiresExactTime ?? true
            }
        }
        .presentationDetents([.large])
    }

    private func save() async {
        let priceValue = priceCentsFromDigits
        guard priceValue >= minServiceCents else {
            errorText = "Minimum service price is $5.00."
            return
        }
        guard let durationValue = Int(duration), durationValue > 0 else {
            errorText = "Enter a valid duration."
            return
        }

        do {
            if mode == .create {
                try await providerStore.createService(
                    name: name,
                    description: description,
                    priceCents: priceValue,
                    durationMin: durationValue,
                    requiresExactTime: requiresExactTime
                )
            } else if let service {
                try await providerStore.updateService(
                    id: service.id,
                    name: name,
                    description: description,
                    priceCents: priceValue,
                    durationMin: durationValue,
                    requiresExactTime: requiresExactTime
                )
            }
            errorText = nil
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private var minimumPriceWarning: String? {
        guard !priceDigits.isEmpty else { return nil }
        return priceCentsFromDigits < minServiceCents ? "Minimum service price is $5.00." : nil
    }

    private var canSubmit: Bool {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let durationValue = Int(duration) ?? 0
        return !trimmedName.isEmpty && priceCentsFromDigits >= minServiceCents && durationValue > 0
    }

    private var priceCentsFromDigits: Int {
        Int(priceDigits) ?? 0
    }

    private func formatCentsDigits(_ digits: String) -> String {
        guard !digits.isEmpty else { return "" }
        let value = Double(Int(digits) ?? 0) / 100.0
        return String(format: "%.2f", value)
    }
}
