import Link from "next/link";

import styles from "./page.module.css";

const metrics = [
  { label: "Availability", value: "99.98%", hint: "SLA in last 90 days" },
  { label: "Lead Time", value: "42 min", hint: "From draft to publish" },
  { label: "Cost Delta", value: "-18%", hint: "Per report lifecycle" },
];

const features = [
  {
    title: "Controlled Workflows",
    description:
      "Route every report through consistent templates, approvals, and ownership checkpoints.",
  },
  {
    title: "Governance Visibility",
    description:
      "Track status, risks, and release quality through one operational command surface.",
  },
  {
    title: "Enterprise Export",
    description:
      "Generate review-ready output with stable typography and predictable handoff quality.",
  },
];

export default function EnterpriseDemoPage() {
  return (
    <div className={styles.viewport}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.brand}>Northline Ops</p>
          <nav aria-label="Primary" className={styles.nav}>
            <a href="#features">Features</a>
            <a href="#metrics">Metrics</a>
            <a href="#cta">Contact</a>
          </nav>
        </header>

        <main className={styles.main}>
          <section className={styles.hero}>
            <p className={styles.kicker}>Enterprise Design Sample</p>
            <h1>Ship report operations with calm, measurable control.</h1>
            <p>
              A simple demo page showing how an enterprise-facing product can communicate trust,
              clarity, and execution speed without visual noise.
            </p>
            <div className={styles.actions}>
              <button type="button">Request a walkthrough</button>
              <Link href="/">Back to app</Link>
            </div>
          </section>

          <section id="metrics" className={styles.metrics} aria-label="Key performance indicators">
            {metrics.map((item) => (
              <article key={item.label} className={styles.metricCard}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <span>{item.hint}</span>
              </article>
            ))}
          </section>

          <section id="features" className={styles.features}>
            <div className={styles.sectionHead}>
              <h2>What this layout demonstrates</h2>
              <p>Readable hierarchy, clean spacing rhythm, and purposeful motion.</p>
            </div>
            <div className={styles.featureGrid}>
              {features.map((feature) => (
                <article key={feature.title} className={styles.featureCard}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="cta" className={styles.cta} aria-label="Call to action">
            <div>
              <h2>Need a production variant?</h2>
              <p>Extend this sample into your full dashboard, portal, or reporting workspace.</p>
            </div>
            <button type="button">Start design review</button>
          </section>
        </main>
      </div>
    </div>
  );
}
