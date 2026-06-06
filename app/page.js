"use client";

import { useState, useRef } from "react";

const DEMO_BOOKS = [
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "Educated", author: "Tara Westover" },
  { title: "The Name of the Wind", author: "Patrick Rothfuss" },
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "Circe", author: "Madeline Miller" },
  { title: "Dune", author: "Frank Herbert" },
  { title: "The Midnight Library", author: "Matt Haig" },
  { title: "Klara and the Sun", author: "Kazuo Ishiguro" },
  { title: "Station Eleven", author: "Emily St. John Mandel" },
  { title: "Piranesi", author: "Susanna Clarke" },
];

const VIBES = [
  "Classic Match",
  "Surprising Hidden Gem",
  "Brain Expansion",
  "Cozy & Lighthearted",
  "Dark & Thrilling",
];

const FOCUSES = [
  "Rich Plot & World-building",
  "Character-driven",
  "Fast Pacing",
  "Beautiful Prose",
];

function parseGoodreadsCSV(text) {
  const lines = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (insideQuotes && i + 1 < text.length && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((ch === "\n" || ch === "\r") && !insideQuotes) {
      if (current.trim()) {
        lines.push(current);
      }
      current = "";
      if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    lines.push(current);
  }

  if (lines.length < 2) return [];

  const parseRow = (row) => {
    const fields = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < row.length && row[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(field.trim());
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const headerFields = parseRow(lines[0]);
  const headerMap = {};
  headerFields.forEach((h, i) => {
    headerMap[h.toLowerCase()] = i;
  });

  const titleIdx = headerMap["title"];
  const authorIdx =
    headerMap["author"] !== undefined
      ? headerMap["author"]
      : headerMap["author l-f"];
  const shelfIdx = headerMap["exclusive shelf"];

  if (titleIdx === undefined || authorIdx === undefined) {
    return [];
  }

  const books = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseRow(lines[i]);
    if (fields.length <= Math.max(titleIdx, authorIdx)) continue;

    const shelf = shelfIdx !== undefined ? fields[shelfIdx] : "";
    if (shelfIdx !== undefined && shelf !== "read") continue;

    const title = fields[titleIdx];
    let author = fields[authorIdx];

    if (author && author.includes(",")) {
      const parts = author.split(",").map((s) => s.trim());
      if (parts.length === 2 && !parts[1].includes(" ")) {
        author = parts[1] + " " + parts[0];
      }
    }

    if (title && author) {
      books.push({ title, author });
    }
  }

  return books;
}

function parseQuickAdd(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        return { title: byMatch[1].trim(), author: byMatch[2].trim() };
      }
      const dashMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (dashMatch) {
        return { title: dashMatch[1].trim(), author: dashMatch[2].trim() };
      }
      return { title: line, author: "Unknown" };
    });
}

export default function Home() {
  const [books, setBooks] = useState([]);
  const [activeTab, setActiveTab] = useState("csv");
  const [quickText, setQuickText] = useState("");
  const [vibe, setVibe] = useState(VIBES[0]);
  const [focus, setFocus] = useState(FOCUSES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseGoodreadsCSV(text);
      if (parsed.length === 0) {
        setError(
          "Could not parse any books from this CSV. Make sure it is a Goodreads export file."
        );
        return;
      }
      setBooks(parsed);
      setError(null);
      setResults(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleQuickAdd = () => {
    if (!quickText.trim()) return;
    const parsed = parseQuickAdd(quickText);
    setBooks((prev) => [...prev, ...parsed]);
    setQuickText("");
    setError(null);
    setResults(null);
  };

  const handleDemo = () => {
    setBooks(DEMO_BOOKS);
    setError(null);
    setResults(null);
  };

  const handleClear = () => {
    setBooks([]);
    setResults(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (books.length === 0) {
      setError("Add some books to your library first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books, vibe, focus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (data.recommendations) {
        setResults(data.recommendations);
      } else {
        setError("Unexpected response format. Please try again.");
      }
    } catch (err) {
      setError("Network error. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>ShelfSage</h1>
        <p>Import your reading history. Get recommendations that actually fit.</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="section">
        <div className="section-title">Import Books</div>
        <div className="tabs">
          <button
            className={`tab ${activeTab === "csv" ? "active" : ""}`}
            onClick={() => setActiveTab("csv")}
          >
            Upload Goodreads CSV
          </button>
          <button
            className={`tab ${activeTab === "quick" ? "active" : ""}`}
            onClick={() => setActiveTab("quick")}
          >
            Quick Add
          </button>
          <button
            className={`tab ${activeTab === "demo" ? "active" : ""}`}
            onClick={() => setActiveTab("demo")}
          >
            Demo Books
          </button>
        </div>

        {activeTab === "csv" && (
          <div
            className="upload-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <p>
              <strong>Click to upload</strong> your Goodreads export CSV
            </p>
            <p style={{ marginTop: 6, fontSize: 12, color: "#a3a3a3" }}>
              Export from Goodreads: My Books &rarr; Import/Export &rarr; Export
              Library
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
            />
          </div>
        )}

        {activeTab === "quick" && (
          <div className="textarea-wrap">
            <textarea
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={
                "Type one book per line:\nThe Great Gatsby by F. Scott Fitzgerald\nDune by Frank Herbert\n1984 by George Orwell"
              }
            />
            <div className="textarea-actions">
              <button
                className="btn btn-primary"
                onClick={handleQuickAdd}
                disabled={!quickText.trim()}
              >
                Add Books
              </button>
            </div>
          </div>
        )}

        {activeTab === "demo" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <p
              style={{
                fontSize: 14,
                color: "#737373",
                marginBottom: 16,
              }}
            >
              Load 10 sample books to try ShelfSage without importing your own
              library.
            </p>
            <button className="btn btn-secondary" onClick={handleDemo}>
              Load Demo Books
            </button>
          </div>
        )}
      </div>

      {books.length > 0 && (
        <div className="section">
          <div className="section-title">Your Library</div>
          <div className="book-list">
            <div className="book-list-header">
              <span>
                {books.length} book{books.length !== 1 ? "s" : ""}
              </span>
              <button className="book-list-clear" onClick={handleClear}>
                Clear all
              </button>
            </div>
            <div className="book-list-scroll">
              {books.map((book, i) => (
                <div key={i} className="book-item">
                  <span className="book-title">{book.title}</span>
                  <span className="book-author">{book.author}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {books.length > 0 && (
        <div className="section">
          <div className="section-title">Recommendation Settings</div>
          <div className="settings-row">
            <div className="setting-group">
              <label>Vibe</label>
              <select value={vibe} onChange={(e) => setVibe(e.target.value)}>
                {VIBES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="setting-group">
              <label>Focus</label>
              <select value={focus} onChange={(e) => setFocus(e.target.value)}>
                {FOCUSES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="generate-wrap">
            <button
              className="btn btn-accent btn-large"
              onClick={handleGenerate}
              disabled={loading || books.length === 0}
            >
              {loading ? "Generating..." : "Get Recommendations"}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Analyzing your reading taste...</p>
        </div>
      )}

      {results && (
        <div className="section">
          <div className="results-header">
            <h2>Your Recommendations</h2>
          </div>
          {results.map((rec, i) => (
            <div key={i} className="rec-card">
              <div className="rec-card-top">
                <div className="rec-card-info">
                  <h3>{rec.title}</h3>
                  <div className="rec-author">{rec.author}</div>
                  <span className="rec-genre">{rec.genre}</span>
                </div>
                <div className="rec-score">
                  <div className="rec-score-number">{rec.match_score}</div>
                  <div className="rec-score-label">Match</div>
                  <div className="rec-score-bar">
                    <div
                      className="rec-score-bar-fill"
                      style={{ width: `${(rec.match_score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="rec-reason">{rec.reason}</div>
            </div>
          ))}
        </div>
      )}

      {!books.length && !loading && !results && (
        <div className="empty-state">
          Import some books above to get started.
        </div>
      )}

      <footer className="footer">
        ShelfSage &middot; Powered by Claude
      </footer>
    </div>
  );
}
