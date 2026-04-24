import Foundation

enum ProviderCategoryNormalizer {
    private struct CategoryDef {
        let key: String
        let label: String
        let aliases: [String]
        let keywords: [String]
    }

    private static let defs: [CategoryDef] = [
        .init(
            key: "hair_and_beauty",
            label: "Hair & Beauty",
            aliases: ["hair and beauty", "hair & beauty", "hair beauty", "haircut", "haircuts", "barber", "barbershop", "salon", "beauty", "salon / beauty", "salon beauty"],
            keywords: ["hair", "beauty", "barber", "salon", "lashes", "brows", "makeup", "nails"]
        ),
        .init(
            key: "design",
            label: "Design",
            aliases: ["graphic design", "logo design", "branding", "ui design", "ux design", "web design", "visual design"],
            keywords: ["graphic", "logo", "brand", "ui", "ux", "web", "visual", "creative", "illustration"]
        ),
        .init(
            key: "cad_and_3d_printing",
            label: "CAD & 3D Printing",
            aliases: ["cad and 3d printing", "cad & 3d printing", "3d printing", "3d print", "3d modeling", "cad", "cad design", "fusion 360", "solidworks", "blender"],
            keywords: ["3d", "printing", "cad", "prototype", "fusion", "solidworks", "blender"]
        ),
        .init(
            key: "photography",
            label: "Photography",
            aliases: ["photography", "photographer", "photo"],
            keywords: ["photo", "photography", "camera", "shoot"]
        ),
        .init(
            key: "tutoring",
            label: "Tutoring",
            aliases: ["tutoring", "tutor", "lessons", "private lessons", "coaching", "music tutoring", "academic tutoring"],
            keywords: ["tutor", "tutoring", "homework", "study", "lesson", "coach", "training", "class"]
        ),
        .init(
            key: "plumbing",
            label: "Plumbing",
            aliases: ["plumbing", "plumber"],
            keywords: ["plumb", "pipe", "drain", "toilet", "faucet"]
        ),
        .init(
            key: "electrical",
            label: "Electrical",
            aliases: ["electrical", "electrician", "electric"],
            keywords: ["electrical", "electric", "wiring", "breaker", "outlet"]
        ),
        .init(
            key: "hvac",
            label: "HVAC",
            aliases: ["hvac", "ac", "heating and cooling"],
            keywords: ["hvac", "ac", "air conditioning", "cooling", "heating", "furnace"]
        ),
        .init(
            key: "cleaning",
            label: "Cleaning",
            aliases: ["cleaning", "cleaner", "deep clean"],
            keywords: ["clean", "cleaning", "maid", "housekeeping"]
        ),
        .init(
            key: "home_repair_handyman",
            label: "Home Repair / Handyman",
            aliases: ["home repair", "handyman", "home repair / handyman"],
            keywords: ["repair", "handyman", "install", "mount", "assemble", "fix"]
        ),
        .init(
            key: "painting",
            label: "Painting",
            aliases: ["painting", "painter", "paint"],
            keywords: ["paint", "painting", "painter"]
        ),
        .init(
            key: "landscaping",
            label: "Landscaping",
            aliases: ["landscaping", "landscape", "lawn care", "yard work"],
            keywords: ["landscape", "lawn", "yard", "garden"]
        ),
        .init(
            key: "moving",
            label: "Moving",
            aliases: ["moving", "movers", "move"],
            keywords: ["move", "moving", "mover", "haul"]
        ),
        .init(
            key: "automotive",
            label: "Automotive",
            aliases: ["automotive", "auto repair", "auto", "mechanic"],
            keywords: ["auto", "automotive", "car", "mechanic", "brake", "battery"]
        ),
        .init(
            key: "arts_and_crafts",
            label: "Arts & Crafts",
            aliases: [
                "arts and crafts", "arts & crafts", "crafts", "art", "artist", "handmade", "diy", "maker",
                "hobby", "hobbies", "craft class", "pottery", "ceramics", "painting class", "watercolor",
                "drawing", "sketching", "crochet", "knitting", "embroidery", "woodworking", "origami"
            ],
            keywords: [
                "art", "arts", "craft", "crafts", "draw", "illustration", "handmade", "maker", "diy",
                "hobby", "hobbies", "paint", "pottery", "ceramic", "crochet", "knit", "embroidery", "woodwork", "origami"
            ]
        ),
        .init(
            key: "clothing_and_fashion",
            label: "Clothing & Fashion",
            aliases: ["clothing and fashion", "clothing & fashion", "clothing", "fashion", "apparel", "wardrobe", "styling", "tailor", "sewing"],
            keywords: ["fashion", "clothing", "apparel", "wardrobe", "style", "outfit", "tailor", "sew", "alter"]
        ),
        .init(
            key: "music_and_audio",
            label: "Music & Audio",
            aliases: [
                "music and audio", "music & audio", "music", "audio", "music lessons", "dj", "music production",
                "audio engineering", "songwriting", "jazz", "jazz lessons", "piano lessons", "guitar lessons",
                "drum lessons", "voice lessons", "singing lessons", "instrument lessons", "band coaching"
            ],
            keywords: [
                "music", "audio", "song", "instrument", "guitar", "dj", "beat", "mix", "master", "vocal",
                "jazz", "piano", "drum", "violin", "sax", "sing", "choir", "band", "ukulele"
            ]
        ),
        .init(
            key: "electronics_and_tech",
            label: "Electronics & Tinkering",
            aliases: ["electronics and tech", "electronics & tech", "electronics and tinkering", "electronics & tinkering", "electronics", "tech", "soldering", "robotics", "arduino"],
            keywords: ["electronic", "tech", "device", "computer", "phone", "hardware", "arduino", "solder", "circuit", "pcb", "embedded", "robot", "tinker"]
        ),
        .init(
            key: "pest_control",
            label: "Pest Control",
            aliases: ["pest control", "pest"],
            keywords: ["pest", "bugs", "rodent", "roach", "ants"]
        )
    ]

    private static let aliasToKey: [String: String] = {
        var result: [String: String] = [:]
        for def in defs {
            result[normalizeBase(def.key)] = def.key
            result[normalizeBase(def.label)] = def.key
            for alias in def.aliases {
                result[normalizeBase(alias)] = def.key
            }
        }
        return result
    }()

    private static let keyToLabel: [String: String] = {
        Dictionary(uniqueKeysWithValues: defs.map { ($0.key, $0.label) })
    }()

    static func normalizeServiceTag(_ input: String, allowFallback: Bool = true) -> String {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "" }
        let normalized = normalizeBase(raw)
        guard !normalized.isEmpty else { return "" }

        if let exact = aliasToKey[normalized] {
            return exact
        }

        var bestKey: String?
        var bestScore = 0
        for def in defs {
            var score = 0
            for keyword in def.keywords where normalized.contains(keyword) {
                score += 1
            }
            if score > bestScore {
                bestScore = score
                bestKey = def.key
            }
        }
        if let bestKey, bestScore > 0 {
            return bestKey
        }

        if !allowFallback {
            return ""
        }
        return normalized.replacingOccurrences(of: " ", with: "_")
    }

    static func normalizeServiceTags(_ inputs: [String]) -> [String] {
        var out: [String] = []
        for raw in inputs {
            let key = normalizeServiceTag(raw, allowFallback: true)
            guard !key.isEmpty else { continue }
            if !out.contains(key) {
                out.append(key)
            }
        }
        return out
    }

    static func label(for raw: String) -> String {
        let key = normalizeServiceTag(raw, allowFallback: true)
        guard !key.isEmpty else { return "General" }
        if let canonical = keyToLabel[key] {
            return canonical
        }
        return key
            .split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }

    private static func normalizeBase(_ input: String) -> String {
        input
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "&", with: " and ")
            .replacingOccurrences(of: "/", with: " ")
            .replacingOccurrences(of: ",", with: " ")
            .replacingOccurrences(of: "+", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: #"[^a-z0-9 ]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum ProviderInputValidator {
    private static let blockedPhrases = [
        "kill yourself",
        "kys",
        "i will kill you",
        "i am going to kill you",
        "rape you",
        "go die",
        "you should die",
        "nazi"
    ]

    static func invalidNameMessage(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Business name is required." }
        if trimmed.count < 2 {
            return "Business name is too short."
        }
        if trimmed.count > 60 {
            return "Business name is too long. Keep it under 60 characters."
        }
        if containsBlockedContent(trimmed) {
            return "Business name appears inappropriate. Please revise it."
        }
        if !containsAllowedCharacters(trimmed) {
            return "Business name contains unsupported characters."
        }
        return nil
    }

    static func invalidCategoryMessage(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Category cannot be empty." }
        if trimmed.count < 2 {
            return "Category is too short."
        }
        if trimmed.count > 50 {
            return "Category is too long. Keep it under 50 characters."
        }
        if containsBlockedContent(trimmed) {
            return "Category appears inappropriate. Please revise it."
        }
        if !containsAllowedCharacters(trimmed) {
            return "Category contains unsupported characters."
        }
        return nil
    }

    private static func containsBlockedContent(_ text: String) -> Bool {
        let normalized = text.lowercased()
        return blockedPhrases.contains { normalized.contains($0) }
    }

    private static func containsAllowedCharacters(_ text: String) -> Bool {
        text.range(of: #"^[A-Za-z0-9 &+/'._-]+$"#, options: .regularExpression) != nil
    }
}
