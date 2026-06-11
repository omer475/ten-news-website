import Foundation
import SwiftUI

// MARK: - TodayPlus Feed Redesign — display payload (spec §3)
//
// Every article from /api/feed/main may carry a `display` object produced by
// the Cloud Run pipeline (step13_feed_display.py). Presence of an optional
// signal (big / quote / versus / timeline / trend / geo) makes the story
// eligible for the corresponding card template. `display == nil` → legacy
// fallback card only.
//
// `<em>` / `<b>` are the only markup in title/bullets/quote.text. They are
// parsed into AttributedString ONCE here at decode time (spec §9) and cached
// on the model: <em> runs carry `.emphasized` inline intent (entity → accent
// color at render), <b> runs carry `.stronglyEmphasized` (bold ink).

// MARK: Markup parsing

enum TPMarkup {
    /// Parse a pipeline string containing only <em>/<b> tags into an
    /// AttributedString. Emphasis is recorded as inline presentation intent;
    /// the views map intents to accent color / bold ink per surface.
    static func parse(_ raw: String) -> AttributedString {
        var result = AttributedString()
        var remainder = Substring(unescape(raw))

        while let open = remainder.range(of: "<") {
            let before = remainder[remainder.startIndex..<open.lowerBound]
            if !before.isEmpty { result += AttributedString(String(before)) }
            remainder = remainder[open.lowerBound...]

            if remainder.hasPrefix("<em>"), let close = remainder.range(of: "</em>") {
                let inner = remainder[remainder.index(remainder.startIndex, offsetBy: 4)..<close.lowerBound]
                var run = AttributedString(String(inner))
                run.inlinePresentationIntent = .emphasized
                result += run
                remainder = remainder[close.upperBound...]
            } else if remainder.hasPrefix("<b>"), let close = remainder.range(of: "</b>") {
                let inner = remainder[remainder.index(remainder.startIndex, offsetBy: 3)..<close.lowerBound]
                var run = AttributedString(String(inner))
                run.inlinePresentationIntent = .stronglyEmphasized
                result += run
                remainder = remainder[close.upperBound...]
            } else {
                // Stray "<" that isn't a recognized tag — emit it literally.
                result += AttributedString("<")
                remainder = remainder[remainder.index(after: remainder.startIndex)...]
            }
        }
        if !remainder.isEmpty { result += AttributedString(String(remainder)) }
        return result
    }

    /// Strip tags entirely (for share sheets, accessibility labels, ticker).
    static func plain(_ raw: String) -> String {
        unescape(raw)
            .replacingOccurrences(of: "<em>", with: "")
            .replacingOccurrences(of: "</em>", with: "")
            .replacingOccurrences(of: "<b>", with: "")
            .replacingOccurrences(of: "</b>", with: "")
    }

    private static func unescape(_ s: String) -> String {
        guard s.contains("&") else { return s }
        return s
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
    }
}

// MARK: - Stats — ["LABEL", 886, "$", "B", "all-stock, closes Q3"]

struct DisplayStat: Codable, Hashable {
    let label: String
    let value: Double
    let prefix: String
    let unit: String
    let sub: String

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        label = (try? c.decode(String.self)) ?? ""
        value = try Self.flexibleNumber(&c)
        prefix = (try? c.decode(String.self)) ?? ""
        unit = (try? c.decode(String.self)) ?? ""
        sub = (try? c.decode(String.self)) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.unkeyedContainer()
        try c.encode(label); try c.encode(value)
        try c.encode(prefix); try c.encode(unit); try c.encode(sub)
    }

    static func flexibleNumber(_ c: inout UnkeyedDecodingContainer) throws -> Double {
        if let d = try? c.decode(Double.self) { return d }
        if let i = try? c.decode(Int.self) { return Double(i) }
        if let s = try? c.decode(String.self) { return Double(s) ?? 0 }
        _ = try? c.decode(String.self)
        return 0
    }
}

// MARK: - Big number — [5000, "", "", "robotaxis requested in a single permit"]

struct DisplayBig: Codable, Hashable {
    let value: Double
    let prefix: String
    let unit: String
    let caption: String

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        value = try DisplayStat.flexibleNumber(&c)
        prefix = (try? c.decode(String.self)) ?? ""
        unit = (try? c.decode(String.self)) ?? ""
        caption = (try? c.decode(String.self)) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.unkeyedContainer()
        try c.encode(value); try c.encode(prefix)
        try c.encode(unit); try c.encode(caption)
    }
}

// MARK: - Quote

struct DisplayQuote: Codable, Hashable {
    let text: String
    let who: String

    var attributedText: AttributedString { TPMarkup.parse(text) }
}

// MARK: - Versus

struct DisplayVersus: Codable, Hashable {
    struct Side: Codable, Hashable {
        let val: FlexibleDouble
        let unit: String?
        let who: String
    }
    let a: Side
    let b: Side
    let ratio: Double
    let note: String?
}

// MARK: - Timeline — [["MAY 28", "event text"], …]

struct DisplayTimelineEntry: Codable, Hashable {
    let dateLabel: String
    let text: String

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        dateLabel = (try? c.decode(String.self)) ?? ""
        text = (try? c.decode(String.self)) ?? ""
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.unkeyedContainer()
        try c.encode(dateLabel); try c.encode(text)
    }

    var attributedText: AttributedString { TPMarkup.parse(text) }
}

// MARK: - Trend

struct DisplayTrend: Codable, Hashable {
    let vals: [Double]
    let labels: [String]
    let unit: String?
    let caption: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        vals = (try? c.decode([FlexibleDouble].self, forKey: .vals).map(\.value)) ?? []
        labels = (try? c.decode([String].self, forKey: .labels)) ?? []
        unit = try? c.decodeIfPresent(String.self, forKey: .unit)
        caption = try? c.decodeIfPresent(String.self, forKey: .caption)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(vals.map(FlexibleDouble.init), forKey: .vals)
        try c.encode(labels, forKey: .labels)
        try c.encodeIfPresent(unit, forKey: .unit)
        try c.encodeIfPresent(caption, forKey: .caption)
    }

    enum CodingKeys: String, CodingKey { case vals, labels, unit, caption }

    /// Upstream guarantees vals/labels same length 4–8; clamp anyway.
    var points: [(value: Double, label: String)] {
        Array(zip(vals, labels))
    }
}

// MARK: - Geo

struct DisplayGeoPin: Codable, Hashable {
    let lat: Double
    let lon: Double
    let label: String?
}

struct DisplayGeo: Codable, Hashable {
    let pins: [DisplayGeoPin]
    let link: Bool?
    let distance: String?
    let region: String?

    var isLinked: Bool { link == true && pins.count == 2 }
}

// MARK: - ArticleDisplay

struct ArticleDisplay: Codable, Hashable {
    // Required (always present when display != nil)
    let category: String
    let breaking: Bool
    let title: String
    let lede: String
    let bullets: [String]
    let stats: [DisplayStat]
    let tags: [String]
    let imageURL: String?

    // Optional signals
    let big: DisplayBig?
    let quote: DisplayQuote?
    let versus: DisplayVersus?
    let timeline: [DisplayTimelineEntry]?
    let trend: DisplayTrend?
    let geo: DisplayGeo?

    // Parsed-at-decode caches (spec §9) — not encoded; rebuilt on decode.
    let titleAttributed: AttributedString
    let bulletsAttributed: [AttributedString]

    enum CodingKeys: String, CodingKey {
        case category, breaking, title, lede, bullets, stats, tags, imageURL
        case big, quote, versus, timeline, trend, geo
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        category = (try? c.decode(String.self, forKey: .category)) ?? "WORLD"
        breaking = (try? c.decode(Bool.self, forKey: .breaking)) ?? false
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        lede = (try? c.decode(String.self, forKey: .lede)) ?? ""
        bullets = (try? c.decode([String].self, forKey: .bullets)) ?? []
        stats = (try? c.decode([DisplayStat].self, forKey: .stats)) ?? []
        tags = (try? c.decode([String].self, forKey: .tags)) ?? []
        imageURL = try? c.decodeIfPresent(String.self, forKey: .imageURL)
        big = try? c.decodeIfPresent(DisplayBig.self, forKey: .big)
        quote = try? c.decodeIfPresent(DisplayQuote.self, forKey: .quote)
        versus = try? c.decodeIfPresent(DisplayVersus.self, forKey: .versus)
        timeline = try? c.decodeIfPresent([DisplayTimelineEntry].self, forKey: .timeline)
        trend = try? c.decodeIfPresent(DisplayTrend.self, forKey: .trend)
        geo = try? c.decodeIfPresent(DisplayGeo.self, forKey: .geo)

        titleAttributed = TPMarkup.parse(title)
        bulletsAttributed = bullets.map(TPMarkup.parse)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(category, forKey: .category)
        try c.encode(breaking, forKey: .breaking)
        try c.encode(title, forKey: .title)
        try c.encode(lede, forKey: .lede)
        try c.encode(bullets, forKey: .bullets)
        try c.encode(stats, forKey: .stats)
        try c.encode(tags, forKey: .tags)
        try c.encodeIfPresent(imageURL, forKey: .imageURL)
        try c.encodeIfPresent(big, forKey: .big)
        try c.encodeIfPresent(quote, forKey: .quote)
        try c.encodeIfPresent(versus, forKey: .versus)
        try c.encodeIfPresent(timeline, forKey: .timeline)
        try c.encodeIfPresent(trend, forKey: .trend)
        try c.encodeIfPresent(geo, forKey: .geo)
    }

    var plainTitle: String { TPMarkup.plain(title) }

    var image: URL? {
        guard let imageURL, !imageURL.isEmpty else { return nil }
        return URL(string: imageURL)
    }

    /// Timeline entries are guaranteed 3–4 by upstream validation.
    var timelineEntries: [DisplayTimelineEntry] { timeline ?? [] }
}

// MARK: - Age label ("30m", "2h", "1d") — computed client-side per contract

extension Article {
    var tpAgeLabel: String {
        guard let date = publishedDate else { return "" }
        let seconds = max(0, Date().timeIntervalSince(date))
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(max(1, minutes))m" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h" }
        return "\(hours / 24)d"
    }
}
