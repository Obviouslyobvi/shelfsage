export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { books, vibe, focus } = await request.json();

    if (!books || books.length === 0) {
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
      .slice(0, 50)
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
