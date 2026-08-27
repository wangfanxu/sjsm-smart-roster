import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The requested page or language is not available.</p>
      <Link className="language-link" href="/en">Return home</Link>
    </main>
  );
}
