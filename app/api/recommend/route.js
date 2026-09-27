export const runtime = "nodejs";

// Per-IP limit so a script cannot run up the Anthropic bill. This map lives
// in the server process; on serverless hosts each instance keeps its own
// count, which still blunts abuse but is not a hard global cap.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map();

function tooManyRequests(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const MAX_BOOKS = 50;
const MAX_FIELD = 200;
const clean = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (tooManyRequests(ip)) {
      return Response.json(
        { error: "Too many requests. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const rawBooks = Array.isArray(body?.books) ? body.books : [];
    const books = rawBooks
      .slice(0, MAX_BOOKS)
      .map((b) => ({ title: clean(b?.title, MAX_FIELD), author: clean(b?.author, MAX_FIELD) }))
      .filter((b) => b.title);
    const vibe = clean(body?.vibe, 100);
    const focus = clean(body?.focus, 100);

    if (books.length === 0) {
      return Response.json(
        { error: "No books provided." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-key-here") {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const bookList = books
      .map((b) => `- "${b.title}" by ${b.author}`)
      .join("\n");

    const prompt = `You are ShelfSage, an expert book recommendation engine. Analyze the reader's library and recommend exactly 5 books they would love.

Their library:
${bookList}

Recommendation vibe: ${vibe}
Focus on: ${focus}

Respond with ONLY a valid JSON array of 5 objects. No markdown, no code fences. Each object: "title", "author", "reason" (2-3 sentences referencing their books), "genre", "match_score" (1-10).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", response.status, errText);
      return Response.json(
        { error: "Failed to get recommendations." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    let recommendations;
    try {
      recommendations = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        recommendations = JSON.parse(match[0]);
      } else {
        return Response.json(
          { error: "Could not parse recommendations." },
          { status: 500 }
        );
      }
    }

    return Response.json({ recommendations });
  } catch (err) {
    console.error("Error:", err);
    return Response.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
