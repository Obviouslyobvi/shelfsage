import "./globals.css";

export const metadata = {
  title: "ShelfSage - AI Book Recommendations",
  description:
    "Import your reading history and get personalized book recommendations powered by Claude.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
