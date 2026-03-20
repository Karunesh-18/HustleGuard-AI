"use client";

import { SyntheticEvent, useEffect, useMemo, useState } from "react";

type ZoneLiveData = {
  zone_name: string;
  rainfall_mm: number;
  aqi: number;
  traffic_index: number;
  dai: number;
  workability_score: number;
  updated_at: string;
};

type PayoutRead = {
  id: number;
  zone_name: string;
  trigger_reason: string;
  payout_amount_inr: number;
  eligible_riders: number;
  event_time: string;
};

type RiderRead = {
  id: number;
  name: string;
  email: string;
  city: string;
  home_zone: string;
  reliability_score: number;
  created_at: string;
};

type SubscriptionRead = {
  id: number;
  rider_id: number;
  plan_name: string;
  weekly_premium: number;
  active: boolean;
  created_at: string;
};

type HealthRead = {
  status: string;
  database_ready: boolean;
  database_error: string | null;
  database_backend: string;
};

type ApiError = {
  detail?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export default function Home() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [payouts, setPayouts] = useState<PayoutRead[]>([]);
  const [health, setHealth] = useState<HealthRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [homeZone, setHomeZone] = useState("Koramangala");
  const [onboardingStatus, setOnboardingStatus] = useState<string>("");
  const [createdRider, setCreatedRider] = useState<RiderRead | null>(null);

  const [planName, setPlanName] = useState("Weekly Shield");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("");
  const [activeSubscription, setActiveSubscription] = useState<SubscriptionRead | null>(null);

  const worstZone = useMemo(() => {
    if (zones.length === 0) {
      return null;
    }
    return [...zones].sort((a, b) => a.workability_score - b.workability_score)[0];
  }, [zones]);

  const totalEligibleRiders = useMemo(
    () => payouts.reduce((sum, payout) => sum + payout.eligible_riders, 0),
    [payouts],
  );

  async function refreshLiveData() {
    setLoading(true);
    setApiError(null);
    try {
      const [zonesRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE}/zones/live-data`, { cache: "no-store" }),
        fetch(`${API_BASE}/payouts/recent`, { cache: "no-store" }),
      ]);

      if (!zonesRes.ok || !payoutsRes.ok) {
        throw new Error("Failed to fetch live data from backend.");
      }

      const zonesData = (await zonesRes.json()) as ZoneLiveData[];
      const payoutsData = (await payoutsRes.json()) as PayoutRead[];

      setZones(zonesData);
      setPayouts(payoutsData);
    } catch {
      setApiError("Unable to load live data. Make sure backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  async function checkApiHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Health endpoint is not reachable.");
      }
      const healthData = (await response.json()) as HealthRead;
      setHealth(healthData);
    } catch {
      setApiError("Unable to check API health. Make sure backend is running on port 8000.");
    }
  }

  useEffect(() => {
    void refreshLiveData();
  }, []);

  async function handleOnboard(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setOnboardingStatus("Submitting rider onboarding...");
    try {
      const response = await fetch(`${API_BASE}/riders/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, city, home_zone: homeZone }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as ApiError;
        throw new Error(errorBody.detail ?? "Onboarding failed.");
      }

      const rider = (await response.json()) as RiderRead;
      setCreatedRider(rider);
      setOnboardingStatus(`Rider onboarded successfully. Rider ID: ${rider.id}`);
      setSubscriptionStatus("");
      setActiveSubscription(null);
    } catch (error) {
      setOnboardingStatus(error instanceof Error ? error.message : "Onboarding failed.");
    }
  }

  async function handleSubscribe(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createdRider) {
      setSubscriptionStatus("Onboard a rider first.");
      return;
    }

    setSubscriptionStatus("Creating subscription...");
    try {
      const subscribeRes = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: createdRider.id, plan_name: planName }),
      });

      if (!subscribeRes.ok) {
        const errorBody = (await subscribeRes.json()) as ApiError;
        throw new Error(errorBody.detail ?? "Subscription failed.");
      }

      const subscription = (await subscribeRes.json()) as SubscriptionRead;
      setActiveSubscription(subscription);
      setSubscriptionStatus("Subscription activated successfully.");
    } catch (error) {
      setSubscriptionStatus(error instanceof Error ? error.message : "Subscription failed.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 md:px-10 md:py-16">
        <section className="rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-8 shadow-[0_0_80px_rgba(34,211,238,0.08)] backdrop-blur sm:p-10">
          <p className="mb-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Predict. Protect. Pay.
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
            HustleGuard AI for Gig Worker Income Protection
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Real-time disruption intelligence and parametric payouts for delivery riders when weather,
            traffic, or public alerts reduce earning potential.
          </p>
          <p className="mt-3 text-xs text-cyan-200/80">Connected API base: {API_BASE}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => void checkApiHealth()}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Check API Health
            </button>
            <button
              type="button"
              onClick={() => void refreshLiveData()}
              className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200"
            >
              Refresh Live Data
            </button>
          </div>
        </section>

        <section id="overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Lowest Workability Zone",
              value: worstZone ? worstZone.zone_name : "-",
              note: worstZone ? `${worstZone.workability_score}/100 score` : "No data",
            },
            {
              title: "Delivery Activity Index",
              value: worstZone ? worstZone.dai.toFixed(2) : "-",
              note: "From live zone feed",
            },
            {
              title: "Eligible Riders",
              value: `${totalEligibleRiders}`,
              note: "Across recent payout events",
            },
            {
              title: "Latest Payout",
              value: payouts[0] ? `INR ${payouts[0].payout_amount_inr}` : "-",
              note: payouts[0] ? payouts[0].zone_name : "No events yet",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/30"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{card.title}</p>
              <p className="mt-2 text-3xl font-bold text-cyan-300">{card.value}</p>
              <p className="mt-2 text-sm text-slate-300">{card.note}</p>
            </article>
          ))}
        </section>

        {apiError ? (
          <section className="rounded-2xl border border-rose-400/50 bg-rose-900/30 p-4 text-rose-200">{apiError}</section>
        ) : null}

        {health ? (
          <section className="rounded-2xl border border-cyan-500/40 bg-cyan-900/20 p-4 text-cyan-100">
            <p className="font-semibold">API Health: {health.status}</p>
            <p className="mt-1 text-sm">Database ready: {String(health.database_ready)}</p>
            <p className="mt-1 text-sm">Database backend: {health.database_backend}</p>
            {health.database_error ? <p className="mt-1 text-xs text-cyan-200/90">{health.database_error}</p> : null}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-semibold text-white">Live Zone Feed</h2>
            <p className="mt-2 text-sm text-slate-400">Source: /zones/live-data</p>
            {loading ? <p className="mt-4 text-slate-300">Loading...</p> : null}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2">Zone</th>
                    <th className="py-2">Rain (mm)</th>
                    <th className="py-2">AQI</th>
                    <th className="py-2">DAI</th>
                    <th className="py-2">Workability</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.zone_name} className="border-b border-slate-800/80 text-slate-200">
                      <td className="py-2">{zone.zone_name}</td>
                      <td className="py-2">{zone.rainfall_mm.toFixed(1)}</td>
                      <td className="py-2">{zone.aqi}</td>
                      <td className="py-2">{zone.dai.toFixed(2)}</td>
                      <td className="py-2">{zone.workability_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-semibold text-white">Recent Payout Events</h2>
            <p className="mt-2 text-sm text-slate-400">Source: /payouts/recent</p>
            <div className="mt-4 space-y-3">
              {payouts.map((payout) => (
                <div key={payout.id} className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                  <p className="text-sm font-semibold text-cyan-300">{payout.zone_name}</p>
                  <p className="mt-1 text-sm text-slate-300">{payout.trigger_reason}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    INR {payout.payout_amount_inr} • {payout.eligible_riders} riders • {new Date(payout.event_time).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-semibold text-white">Rider Onboarding</h2>
            <p className="mt-2 text-sm text-slate-400">POST /riders/onboard</p>
            <form className="mt-4 space-y-3" onSubmit={handleOnboard}>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rider Name"
                required
              />
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                type="email"
                required
              />
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                required
              />
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={homeZone}
                onChange={(event) => setHomeZone(event.target.value)}
                placeholder="Home Zone"
                required
              />
              <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
                Onboard Rider
              </button>
            </form>
            {onboardingStatus ? <p className="mt-3 text-sm text-slate-300">{onboardingStatus}</p> : null}
          </article>

          <article className="rounded-3xl border border-slate-700/80 bg-slate-900/60 p-6">
            <h2 className="text-2xl font-semibold text-white">Insurance Subscription</h2>
            <p className="mt-2 text-sm text-slate-400">POST /subscriptions</p>
            <form className="mt-4 space-y-3" onSubmit={handleSubscribe}>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Plan Name"
                required
              />
              <button
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={!createdRider}
              >
                Activate Subscription
              </button>
            </form>
            {subscriptionStatus ? <p className="mt-3 text-sm text-slate-300">{subscriptionStatus}</p> : null}
            {activeSubscription ? (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-900/20 p-3 text-sm text-emerald-100">
                Active Plan: {activeSubscription.plan_name} | Premium: INR {activeSubscription.weekly_premium}/week
              </div>
            ) : null}
          </article>
        </section>
      </main>
    </div>
  );
}
