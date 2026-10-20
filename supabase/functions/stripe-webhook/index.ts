// Supabase Edge Function: receive Stripe webhooks and sync subscription state
// into public.profiles.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
//
// In Stripe → Developers → Webhooks, add the function URL and subscribe to:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted
import Stripe from "https://esm.sh/stripe@16?target=deno&no-check";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Map a Stripe subscription status to the app's plan.
const planFor = (status: string) => (status === "active" || status === "trialing" ? "pro" : "free");

async function syncByCustomer(customerId: string, status: string, subId: string | null, periodEnd: number | null) {
  await admin
    .from("profiles")
    .update({
      plan: planFor(status),
      subscription_status: status,
      stripe_subscription_id: subId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, sig, webhookSecret);
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e instanceof Error ? e.message : ""}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription && s.customer) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await syncByCustomer(s.customer as string, sub.status, sub.id, sub.current_period_end);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncByCustomer(sub.customer as string, sub.status, sub.id, sub.current_period_end);
        break;
      }
    }
  } catch (e) {
    return new Response(`Handler error: ${e instanceof Error ? e.message : ""}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
