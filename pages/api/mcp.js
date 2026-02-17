import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Disable Next.js body parsing so MCP transport can read raw body
export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function createNewsServer() {
  const server = new McpServer({
    name: "todayplus",
    version: "1.0.0",
  });

  // Tool 1: Get articles list with filters
  server.tool(
    "get_articles",
    `Search and list Today+ news articles. Returns curated, multi-source verified articles sorted by importance score (0-1000).

Filters:
- topic: economics, stock_markets, banking, startups, ai, tech_industry, consumer_tech, cybersecurity, space, science, climate, health, biotech, politics, geopolitics, conflicts, human_rights, football, american_football, basketball, tennis, f1, cricket, combat_sports, olympics, entertainment, music, gaming, travel
- country: usa, uk, china, russia, germany, france, spain, italy, ukraine, turkiye, india, japan, israel, canada, australia
- min_score: 900+ globally critical, 700-899 very important, 500-699 notable
- hours: time window (default 24)
- date: specific date YYYY-MM-DD
- limit: max results (default 30, max 50)

Scoring: 900-1000 = globally critical, 700-899 = very important, 500-699 = notable, below 500 = minor.
country_relevance (0-100): 80+ nationally critical, 60-79 significant, below 60 minor.
Always mention source count when num_sources > 1.`,
    {
      topic: z.string().optional().describe("Topic code to filter by"),
      country: z.string().optional().describe("Country code to filter by"),
      min_score: z.number().optional().describe("Minimum importance score 0-1000"),
      hours: z.number().optional().describe("Time window in hours, default 24"),
      date: z.string().optional().describe("Specific date YYYY-MM-DD"),
      limit: z.number().optional().describe("Max articles to return, default 30"),
    },
    async (args) => {
      let query = supabase
        .from("published_articles")
        .select("id, title_news, emoji, ai_final_score, countries, topics, country_relevance, topic_relevance, category, summary_bullets_news, published_at, num_sources, image_url")
        .order("ai_final_score", { ascending: false });

      if (args.date) {
        const startDate = new Date(args.date + "T00:00:00Z");
        const endDate = new Date(args.date + "T00:00:00Z");
        endDate.setDate(endDate.getDate() + 1);
        query = query.gte("published_at", startDate.toISOString()).lt("published_at", endDate.toISOString());
      } else {
        const hoursAgo = args.hours || 24;
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        query = query.gte("published_at", since);
      }

      if (args.topic) query = query.contains("topics", [args.topic]);
      if (args.country) query = query.contains("countries", [args.country]);
      if (args.min_score) query = query.gte("ai_final_score", args.min_score);

      const maxResults = Math.min(args.limit || 30, 50);
      query = query.limit(maxResults);

      const { data, error } = await query;

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ articles: data, count: data.length }) }],
      };
    }
  );

  // Tool 2: Get full article detail
  server.tool(
    "get_article_detail",
    `Get full details of a specific Today+ article including visual components.

Returns: title, summary bullets, five W's (Who/What/When/Where/Why), key details with statistics, graph data for charts, map data with coordinates, source information.

IMPORTANT - Visual components:
- details: Array of {label, value} statistics. Display these prominently with bold numbers.
- graph: Chart data with type, labels, values. ALWAYS render as a visual chart.
- map: Location data with coordinates. ALWAYS render on a visual map.
- If multiple components exist, render ALL of them.
Always credit sources: "Verified across X sources" when num_sources > 1.`,
    {
      id: z.number().describe("Article ID"),
    },
    async (args) => {
      const { data, error } = await supabase
        .from("published_articles")
        .select("id, title_news, emoji, ai_final_score, countries, topics, country_relevance, topic_relevance, category, summary_bullets_news, five_ws, details, graph, map, published_at, num_sources, source_titles, image_url, url, interest_tags")
        .eq("id", args.id)
        .single();

      if (error || !data) {
        return { content: [{ type: "text", text: "Article not found." }] };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  return server;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const server = createNewsServer();
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}
