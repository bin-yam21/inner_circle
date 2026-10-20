import { useState } from "react";
import { PageHead } from "../components/ui";
import { Icon } from "../components/fx";
import { useEntitlement, startCheckout, openBillingPortal } from "../lib/entitlement";

const PRO_FEATURES = [
  "Full ICT course library, drills & quizzes",
  "Trade journal with stats & edge finder",
  "Replay trainer for backtesting setups",
  "AI tutor trained on your lesson notes",
  "Export trading algorithms (Pine scripts)",
  "Sync across all your devices",
];

export default function Pricing() {
  const { isPro, status, billingEnabled } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  };

  return (
    <>
      <PageHead eyebrow="Membership" title="Inner Circle Pro" lede="One plan. Everything you need to learn, journal and sharpen your edge." />
      {error && <div className="auth-error" style={{ maxWidth: 520 }}>{error}</div>}

      <div className="pricing">
        <div className="price-card">
          <div className="price-tag">
            <span className="amount">$19</span><span className="per">/month</span>
          </div>
          <p className="price-sub">Billed monthly · 7-day free trial · cancel anytime</p>
          <ul className="price-list">
            {PRO_FEATURES.map((f) => (
              <li key={f}><span className="tick"><Icon name="check" size={14} /></span>{f}</li>
            ))}
          </ul>

          {!billingEnabled ? (
            <p className="muted" style={{ textAlign: "center" }}>Billing isn't enabled in this environment — all features are currently unlocked.</p>
          ) : isPro ? (
            <>
              <div className="price-active"><Icon name="badge-check" size={16} /> You're on Pro{status === "trialing" ? " (trial)" : ""}</div>
              <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => act(openBillingPortal)} disabled={busy}>
                {busy ? "Opening…" : "Manage billing"}
              </button>
            </>
          ) : (
            <button type="button" className="btn" style={{ width: "100%", justifyContent: "center", padding: 14, fontSize: 15 }} onClick={() => act(startCheckout)} disabled={busy}>
              {busy ? "Starting…" : "Start 7-day free trial"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
