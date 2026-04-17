const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Try to get embedding via RPC - maybe we need to use the match function
  // First, let's see what RPC functions exist for matching
  const { data: funcs, error: funcErr } = await supabase.rpc('match_articles_personal', {
    query_embedding: Array(384).fill(0.01), // Try 384-dim (MiniLM)
    match_count: 3,
    hours_window: 48,
    exclude_ids: null,
    min_similarity: 0,
  });

  if (funcErr) {
    console.log("384-dim match error:", funcErr.message);
    // Try 1536-dim (OpenAI)
    const { data: funcs2, error: funcErr2 } = await supabase.rpc('match_articles_personal', {
      query_embedding: Array(1536).fill(0.01),
      match_count: 3,
      hours_window: 48,
      exclude_ids: null,
      min_similarity: 0,
    });
    if (funcErr2) {
      console.log("1536-dim match error:", funcErr2.message);
    } else {
      console.log("1536-dim match works! Results:", funcs2?.length);
      if (funcs2?.length > 0) console.log("Sample:", JSON.stringify(funcs2[0], null, 2));
    }
  } else {
    console.log("384-dim match works! Results:", funcs?.length);
    if (funcs?.length > 0) console.log("Sample:", JSON.stringify(funcs[0], null, 2));
  }

  // Also try MiniLM variant
  const { data: minilm, error: minilmErr } = await supabase.rpc('match_articles_personal_minilm', {
    query_embedding: Array(384).fill(0.01),
    match_count: 3,
    hours_window: 48,
    exclude_ids: null,
    min_similarity: 0,
  });
  if (minilmErr) {
    console.log("\nMiniLM match error:", minilmErr.message);
  } else {
    console.log("\nMiniLM match works! Results:", minilm?.length);
    if (minilm?.length > 0) console.log("Sample:", JSON.stringify(minilm[0], null, 2));
  }

  // Check if we can get raw embedding from an article
  const { data: raw } = await supabase
    .from("published_articles")
    .select("id, embedding_minilm")
    .eq("id", 43298)
    .single();

  console.log("\nDirect select of embedding_minilm for id 43298:");
  if (raw?.embedding_minilm) {
    console.log("  Type:", typeof raw.embedding_minilm);
    console.log("  Length:", Array.isArray(raw.embedding_minilm) ? raw.embedding_minilm.length : "not array");
    console.log("  First 3:", Array.isArray(raw.embedding_minilm) ? raw.embedding_minilm.slice(0, 3) : String(raw.embedding_minilm).substring(0, 100));
  } else {
    console.log("  NULL - vector columns may not be selectable via REST API");
    // Try via SQL
    const { data: sqlResult, error: sqlErr } = await supabase.rpc('get_article_embedding', { p_article_id: 43298 });
    if (sqlErr) {
      console.log("  No get_article_embedding RPC:", sqlErr.message);
    } else {
      console.log("  RPC result:", sqlResult);
    }
  }
}

main().catch(console.error);
