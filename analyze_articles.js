const { createClient } = require("@supabase/supabase-js");
const s = createClient(
  "https://sdhdylsfngiybvoltoks.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  var t = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  var r1 = await s
    .from("published_articles")
    .select("id, title_news, summary_bullets_news, five_ws, emoji, category, components_order, interest_tags")
    .gte("created_at", t)
    .order("ai_final_score", { ascending: false })
    .limit(5);

  if (r1.error) { console.error(r1.error); return; }
  var data = r1.data || [];

  data.forEach(function (a, i) {
    console.log("--- Article " + (i + 1) + " [ID:" + a.id + "] ---");
    console.log("Title: " + a.title_news);
    console.log("Emoji: " + a.emoji + " | Cat: " + a.category);
    var b = a.summary_bullets_news || [];
    console.log("Bullets(" + b.length + "):");
    b.forEach(function (x) { console.log("  - " + x); });
    var w = a.five_ws;
    console.log("5Ws: " + (w ? "YES" : "NO"));
    if (w && typeof w === "object") {
      Object.entries(w).forEach(function (e) { console.log("  " + e[0] + ": " + e[1]); });
    }
    console.log("Components: " + JSON.stringify(a.components_order));
    console.log("Tags: " + JSON.stringify(a.interest_tags));
    console.log("");
  });

  // World events
  var r2 = await s
    .from("world_events")
    .select("id, name, importance, last_article_at")
    .eq("status", "ongoing")
    .order("last_article_at", { ascending: false })
    .limit(15);

  var ev = r2.data || [];
  console.log("=== WORLD EVENTS ===");
  ev.forEach(function (e, i) {
    console.log((i + 1) + ". [" + e.importance + "] " + e.name + " (last: " + e.last_article_at + ")");
  });

  var ids = ev.map(function (e) { return e.id; });
  if (ids.length > 0) {
    var r3 = await s.from("article_world_events").select("event_id").in("event_id", ids);
    var lnk = r3.data || [];
    var c = {};
    lnk.forEach(function (l) { c[l.event_id] = (c[l.event_id] || 0) + 1; });
    console.log("\nARTICLES PER EVENT:");
    ev.forEach(function (e) {
      console.log("  " + e.name + ": " + (c[e.id] || 0));
    });
  }
}
main();
