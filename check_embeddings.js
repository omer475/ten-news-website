const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Check if articles have embedding columns
  const { data, error } = await supabase
    .from("published_articles")
    .select("id, embedding, embedding_minilm")
    .limit(1)
    .single();

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log("Article ID:", data.id);
  const hasEmb = data.embedding != null;
  const hasMinilm = data.embedding_minilm != null;
  console.log("Has embedding:", hasEmb);
  if (hasEmb) console.log("  embedding length:", data.embedding.length);
  console.log("Has embedding_minilm:", hasMinilm);
  if (hasMinilm) console.log("  embedding_minilm length:", data.embedding_minilm.length);

  // Check what the match_articles_personal RPC expects
  // Check how many recent articles have embeddings
  const { count } = await supabase
    .from("published_articles")
    .select("id", { count: "exact", head: true })
    .not("embedding_minilm", "is", null)
    .gte("created_at", new Date(Date.now() - 48 * 3600000).toISOString());

  console.log("\nArticles with embeddings in last 48h:", count);

  // Check total articles in last 48h
  const { count: total } = await supabase
    .from("published_articles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 48 * 3600000).toISOString());

  console.log("Total articles in last 48h:", total);
  console.log("Coverage:", ((count / total) * 100).toFixed(1) + "%");

  // Get a sample embedding to see dimensions
  if (hasMinilm) {
    console.log("\nMiniLM embedding dimensions:", data.embedding_minilm.length);
    console.log("First 5 values:", data.embedding_minilm.slice(0, 5));
  }
  if (hasEmb) {
    console.log("\nMain embedding dimensions:", data.embedding.length);
    console.log("First 5 values:", data.embedding.slice(0, 5));
  }
}

main().catch(console.error);
