import { legalCopy } from "@/lib/copy";
import styles from "@/app/legal.module.css";

export type LegalView = "privacy" | "terms";

interface LegalDocumentViewProps {
  view: LegalView;
  onBack: () => void;
  onSelectView: (view: LegalView) => void;
}

export default function LegalDocumentView({
  view,
  onBack,
  onSelectView,
}: LegalDocumentViewProps) {
  const document = legalCopy[view];
  const crossView: LegalView = view === "privacy" ? "terms" : "privacy";
  const crossLabel = legalCopy[crossView].title;

  return (
    <section className={styles.legalView} aria-label={document.title}>
      <button
        type="button"
        className={`text-label-medium ${styles.backButton}`}
        onClick={onBack}
      >
        &larr; {legalCopy.shared.backToApp}
      </button>
      <article className={styles.document}>
        <header className={styles.documentHeader}>
          <h1 className={`text-headline-medium ${styles.title}`}>{document.title}</h1>
          <p className={`text-body-small ${styles.lastUpdated}`}>{document.lastUpdated}</p>
        </header>
        {document.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={`text-title-large ${styles.sectionHeading}`}>{section.heading}</h2>
            {section.blocks.map((block) =>
              block.type === "ul" ? (
                <ul key={block.items[0]} className={`text-body-large ${styles.bullets}`}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                block.items.map((item) => (
                  <p key={item} className={`text-body-large ${styles.paragraph}`}>
                    {item}
                  </p>
                ))
              )
            )}
          </section>
        ))}
        <footer className={styles.crossLinkRow}>
          <button
            type="button"
            className={`text-label-large ${styles.crossLink}`}
            onClick={() => onSelectView(crossView)}
          >
            {crossLabel}
          </button>
        </footer>
      </article>
    </section>
  );
}
