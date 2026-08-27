import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages, isLocale } from "@/i18n/config";

type HomePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);
  const alternateLocale = locale === "en" ? "zh" : "en";

  return (
    <main className="page-shell">
      <nav className="topbar" aria-label={messages.languageNavigationLabel}>
        <div className="brand-mark" aria-label="SJSM SmartRoster">
          <span aria-hidden="true">S</span>
          <strong>SmartRoster</strong>
        </div>
        <Link className="language-link" href={`/${alternateLocale}`}>
          {messages.switchLanguage}
        </Link>
      </nav>

      <section className="hero">
        <div className="eyebrow">{messages.eyebrow}</div>
        <h1>{messages.title}</h1>
        <p className="lead">{messages.description}</p>

        <div className="principle">
          <span className="principle-icon" aria-hidden="true">✓</span>
          <div>
            <strong>{messages.principleTitle}</strong>
            <p>{messages.principleDescription}</p>
          </div>
        </div>
      </section>

      <section className="status-card" aria-labelledby="foundation-status">
        <div>
          <span className="status-pill">{messages.status}</span>
          <h2 id="foundation-status">{messages.foundationTitle}</h2>
          <p>{messages.foundationDescription}</p>
        </div>
        <ul className="check-list">
          {messages.foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
