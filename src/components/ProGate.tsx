import { useState, type ReactNode } from "react";
import { useEntitlement, startCheckout } from "../lib/entitlement";
import { Icon } from "./fx";

/**
 * Wraps a premium feature. Pro users (or any deployment without billing
 * configured) see the feature; everyone else sees an upgrade prompt.
 */
export function ProGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { isPro, loading } = useEntitlement();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="muted">Loading…</p>;
  if (isPro) return <>{children}</>;

  const upgrade = async () => {
    setBusy(true); setError(null);
    try { await startCheckout(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start checkout."); setBusy(false); }
  };

  return (
    <div className="paywall">
      <span className="paywall-badge"><Icon name="lock" size={22} /></span>
      <h2>{feature} is a Pro feature</h2>
      <p>Unlock {feature.toLowerCase()} and every premium tool — the replay trainer, edge finder, AI tutor and algorithm exports — with Inner Circle Pro.</p>
      {error && <div className="auth-error" style={{ maxWidth: 420, margin: "0 auto 16px" }}>{error}</div>}
      <button type="button" className="btn" onClick={upgrade} disabled={busy}>
        {busy ? "Starting…" : "Start 7-day free trial"}
      </button>
      <p className="paywall-fine">Then $19/month. Cancel anytime.</p>
    </div>
  );
}
