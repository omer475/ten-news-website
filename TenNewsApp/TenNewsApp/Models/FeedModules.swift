import Foundation

// MARK: - TodayPlus Feed Redesign — interstitial modules (GET /api/feed/modules)
//
// Generated once daily by the pipeline. A module key may be missing — it is
// simply skipped in the rotation. MARKET PULSE (§8.4) is client-side and
// skipped in v1; the remaining 4 rotate.

struct FeedModulesResponse: Codable {
    let date: String?
    let modules: FeedModules

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try? c.decodeIfPresent(String.self, forKey: .date)
        modules = (try? c.decodeIfPresent(FeedModules.self, forKey: .modules)) ?? FeedModules()
    }

    enum CodingKeys: String, CodingKey { case date, modules }
}

struct FeedModules: Codable {
    var history: HistoryModule?
    var notd: NotdModule?
    var briefs: BriefsModule?
    var countdowns: CountdownsModule?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        history = try? c.decodeIfPresent(HistoryModule.self, forKey: .history)
        notd = try? c.decodeIfPresent(NotdModule.self, forKey: .notd)
        briefs = try? c.decodeIfPresent(BriefsModule.self, forKey: .briefs)
        countdowns = try? c.decodeIfPresent(CountdownsModule.self, forKey: .countdowns)
    }

    enum CodingKeys: String, CodingKey { case history, notd, briefs, countdowns }
}

// MARK: 8.2 TODAY IN HISTORY — rows: [[1962, "event sentence"], …]

struct HistoryModule: Codable, Hashable {
    struct Row: Codable, Hashable {
        let year: Int
        let text: String

        init(from decoder: Decoder) throws {
            var c = try decoder.unkeyedContainer()
            year = (try? c.decode(Int.self)) ?? 0
            text = (try? c.decode(String.self)) ?? ""
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.unkeyedContainer()
            try c.encode(year); try c.encode(text)
        }

        var attributedText: AttributedString { TPMarkup.parse(text) }
    }
    let rows: [Row]
}

// MARK: 8.5 NUMBER OF THE DAY

struct NotdModule: Codable, Hashable {
    let value: FlexibleDouble
    let prefix: String?
    let unit: String?
    let context: String?
}

// MARK: 8.3 IN 10 SECONDS / WHILE YOU SCROLLED — 3 one-liner briefs

struct BriefsModule: Codable, Hashable {
    struct Row: Codable, Hashable {
        let tag: String
        let text: String

        var attributedText: AttributedString { TPMarkup.parse(text) }
    }
    let rows: [Row]
}

// MARK: 8.1 COUNTING DOWN

struct CountdownsModule: Codable, Hashable {
    struct Row: Codable, Hashable {
        let name: String
        let datetime: String
        let context: String?

        var date: Date? { ISO8601DateParsing.parse(datetime) }
    }
    let rows: [Row]

    /// COUNTING DOWN uses the first FUTURE row; if none, the module is skipped.
    var firstFuture: Row? {
        rows.first { ($0.date ?? .distantPast) > Date() }
    }
}

// MARK: - One concrete module insertion in the feed

enum TPModuleItem: Hashable {
    case countdown(CountdownsModule.Row)
    case history(HistoryModule)
    case briefs(BriefsModule, variantTitle: String)
    case notd(NotdModule)
}

// MARK: - Rotation (§4): rotate through available modules in order,
// reshuffling when exhausted. Modules do not affect image-rhythm state.

@MainActor
final class TPModuleRotation {
    private enum Kind: CaseIterable { case countdown, history, briefs, notd }

    private var modules: FeedModules
    private var cycle: [Kind] = []
    private var cursor = 0
    /// §8.3: the briefs module's two title variants rotate per appearance.
    private var briefsVariantFlip = false

    init(modules: FeedModules) {
        self.modules = modules
        cycle = Self.availableKinds(in: modules)
    }

    private static func availableKinds(in modules: FeedModules) -> [Kind] {
        var kinds: [Kind] = []
        if modules.countdowns?.firstFuture != nil { kinds.append(.countdown) }
        if modules.history?.rows.isEmpty == false { kinds.append(.history) }
        if modules.briefs?.rows.isEmpty == false { kinds.append(.briefs) }
        if modules.notd != nil { kinds.append(.notd) }
        return kinds
    }

    /// Next module to insert, or nil when no modules are available.
    func next() -> TPModuleItem? {
        guard !cycle.isEmpty else { return nil }
        if cursor >= cycle.count {
            cycle.shuffle()
            cursor = 0
        }
        let kind = cycle[cursor]
        cursor += 1
        switch kind {
        case .countdown:
            // The only kind that can go stale mid-session (its event passes).
            guard let row = modules.countdowns?.firstFuture else {
                cycle.removeAll { $0 == .countdown }
                cursor = min(cursor, cycle.count)
                return next()
            }
            return .countdown(row)
        case .history:
            guard let m = modules.history else { return nil }
            return .history(m)
        case .briefs:
            guard let m = modules.briefs else { return nil }
            briefsVariantFlip.toggle()
            return .briefs(m, variantTitle: briefsVariantFlip ? "IN 10 SECONDS" : "WHILE YOU SCROLLED")
        case .notd:
            guard let m = modules.notd else { return nil }
            return .notd(m)
        }
    }
}
