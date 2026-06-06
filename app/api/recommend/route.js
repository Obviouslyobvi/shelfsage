export const runtime = "nodejs";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request) {
  try {
    const { books, vibe, focus } = await request.json();

    if (!books || books.length === 0) {
      return Response.json(
        { error: "No books provided. Add some books to your library first." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-key-here") {
      return Response.json(
        {
          error:
            "ANTHROPIC_API_KEY is not configured. Add your key to .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const bookList = books
      .map((b, i) => `${i + 1}. "${b.title}" by ${b.author}`)
      .join("\n");

    const prompt = `You are a literary recommendation engine. A reader has shared their reading history below. Analyze their taste and recommend exactly 5 books they have NOT already read.

READER'S LIBRARY:
${bookList}

RECOMMENDATION VIBE: ${vibe}
READING FOCUS: ${focus}

Instructions:
1. Identify patterns in their reading: genres, themes, writing styles, time periods, and narrative preferences.
2. Based on the vibe "${vibe}" and focus "${focus}", select 5 books that fit. Each book must be a real, published book.
3. Do NOT recommend any book already in their library.
4. For each recommendation, explain specifically WHY it matches this reader's taste and the selected vibe/focus.

Respond with ONLY valid JSON in this exact format, no other text:
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "genre": "Genre",
      "match_score": 8,
      "reason": "A specific 2-3 sentence explanation of why this matches their reading patterns and the selected vibe/focus."
    }
  ]
}

match_score is 1-10 where 10 means a perfect match for this reader's taste combined with the vibe and focus settings.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].text;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse recommendation response as JSON.");
      }
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Recommendation error:", err);
    const message =
      err instanceof Anthropic.APIError
        ? `Claude API error: ${err.message}`
        : err.message || "Something went wrong generating recommendations.";
    return Response.json({ error: message }, { status: 500 });
  }
}
