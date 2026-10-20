import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseEnabled } from "./supabase";
import { useAuth } from "./auth";

/**
 * Subscription entitlements.
 *
 * Billing is only enforced when BOTH Supabase is configured AND a Stripe price
 * id is present (VITE_STRIPE_PRICE_ID). Until then `subscriptionsEnabled` is
 * false and everyone is treated as Pro, so the app (and the test suite) run
 * fully unlocked. Once configured, a user's plan is read from the `profiles`
 * table that the Stripe webhook keeps up to date.
 */
export const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID as string | undefined;
export const subscriptionsEnabled = supabaseEnabled && Boolean(STRIPE_PRICE_ID);

export type Plan = "free" | "pro";
export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

interface EntitlementState {
  loading: boolean;
  /** True when the user may use Pro-only features. */
  isPro: boolean;
  plan: Plan;
  status: SubStatus;
  /** Whether billing is actually enforced in this deployment. */
  billingEnabled: boolean;
  refresh: () => void;
}

const Ctx = createContext<EntitlementState | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [status, setStatus] = useState<SubStatus>("none");
  const [loading, setLoading] = useState(subscriptionsEnabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!subscriptionsEnabled || !supabase || !user) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    supabase.from("profiles").select("plan, subscription_status").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setPlan((data?.plan as Plan) ?? "free");
        setStatus((data?.subscription_status as SubStatus) ?? "none");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [user, tick]);

  const billingEnabled = subscriptionsEnabled;
  const isPro = !billingEnabled ? true : (status === "active" || status === "trialing");

  return (
    <Ctx.Provider value={{ loading, isPro, plan, status, billingEnabled, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEntitlement(): EntitlementState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlement must be used within EntitlementProvider");
  return v;
}

/** Kicks off Stripe Checkout for the Pro plan via the Supabase edge function. */
export async function startCheckout(): Promise<void> {
  if (!supabase || !STRIPE_PRICE_ID) throw new Error("Billing is not configured.");
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { priceId: STRIPE_PRICE_ID, returnUrl: window.location.origin },
  });
  if (error) throw error;
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error("Could not start checkout.");
  window.location.href = url;
}

/** Opens the Stripe customer portal so a subscriber can manage/cancel billing. */
export async function openBillingPortal(): Promise<void> {
  if (!supabase) throw new Error("Billing is not configured.");
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { portal: true, returnUrl: window.location.origin },
  });
  if (error) throw error;
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error("Could not open billing portal.");
  window.location.href = url;
}
