import Foundation

// MARK: - TodayPlus Feed Redesign — template selector + image-rhythm balancer
// Spec §4, implemented exactly per the pseudocode. Runs at feed-assembly time
// in the view model (selection depends on neighboring cards, so it cannot be
// precomputed per story).

enum CardTemplate: String, CaseIterable, Hashable {
    case cover      // headline inside the photo
    case classic    // photo top, text below
    case stat       // stat-hero, one giant number
    case quote      // pull-quote led
    case versus     // two sides face off
    case line       // timeline / developing story
    case split      // compact, square thumb left
    case chart      // animated trend bars
    case map        // location card
    case legacy     // display == nil → current/legacy card (not one of the 9)

    /// Templates that display the story image. The legacy card shows the
    /// photo too, so it participates in the rhythm as an image card.
    var usesImage: Bool {
        switch self {
        case .cover, .classic, .split, .legacy: return true
        default: return false
        }
    }
}

/// One block in the assembled TodayPlus feed: a story card (with its chosen
/// template) or an interstitial module. `index` is the article's position in
/// FeedViewModel.articles — the dwell/skip signal hooks key off it.
enum TPBlock: Identifiable, Hashable {
    case story(index: Int, article: Article, template: CardTemplate)
    case module(key: String, item: TPModuleItem)

    var id: String {
        switch self {
        case .story(_, let article, _): return "story-\(article.id.stringValue)"
        case .module(let key, _): return key
        }
    }

    var isStory: Bool {
        if case .story = self { return true }
        return false
    }
}

@MainActor
final class TemplateSelector {

    // STATE (persisted across the session feed)
    private var lastUsed: [CardTemplate: Int] = [:]   // default -∞
    private var lastDesign: CardTemplate?
    private var lastWasImage = false
    private var noImgStreak = 0

    /// Stable candidate ordering — ties on lastUsed resolve to the earliest.
    private static let order: [CardTemplate] = [
        .cover, .classic, .stat, .quote, .versus, .line, .split, .chart, .map
    ]

    func reset() {
        lastUsed.removeAll()
        lastDesign = nil
        lastWasImage = false
        noImgStreak = 0
    }

    /// ELIGIBILITY (§4): which of the 9 designs this story's signals allow.
    private func eligible(for display: ArticleDisplay) -> [CardTemplate] {
        Self.order.filter { design in
            switch design {
            case .cover, .split: return true
            case .classic: return display.bullets.count >= 2
            case .stat: return display.big != nil
            case .quote: return display.quote != nil
            case .versus: return display.versus != nil
            case .line: return display.timeline?.isEmpty == false
            case .chart: return display.trend != nil
            case .map: return display.geo?.pins.isEmpty == false
            case .legacy: return false
            }
        }
    }

    /// CHOOSE(story, blockIdx) — §4 pseudocode, verbatim.
    func choose(display: ArticleDisplay, blockIdx: Int) -> CardTemplate {
        var candidates = eligible(for: display).filter { $0 != lastDesign }
        if candidates.isEmpty { candidates = [.split] }

        if lastWasImage {
            // rule: never 2 image cards in a row
            let nonImg = candidates.filter { !$0.usesImage }
            if !nonImg.isEmpty { candidates = nonImg }
        } else if noImgStreak >= 3 {
            // rule: force an image after 3 dry cards
            let img = candidates.filter { $0.usesImage }
            if !img.isEmpty { candidates = img }
        }

        if display.breaking,
           !lastWasImage,
           (lastUsed[.cover] ?? Int.min) < blockIdx - 3 {
            // breaking prefers cover, never breaks rhythm
            candidates = [.cover]
        }

        // least-recently-used → max variety
        let pick = candidates.min { (lastUsed[$0] ?? Int.min, idx($0)) < (lastUsed[$1] ?? Int.min, idx($1)) } ?? .split

        record(pick, blockIdx: blockIdx)
        return pick
    }

    /// display == nil → only the legacy fallback card. It shows the photo, so
    /// it still updates the image-rhythm state.
    func recordLegacy(blockIdx: Int) {
        record(.legacy, blockIdx: blockIdx)
    }

    private func record(_ design: CardTemplate, blockIdx: Int) {
        lastUsed[design] = blockIdx
        lastDesign = design
        lastWasImage = design.usesImage
        noImgStreak = design.usesImage ? 0 : noImgStreak + 1
    }

    private func idx(_ d: CardTemplate) -> Int {
        Self.order.firstIndex(of: d) ?? Self.order.count
    }
}
