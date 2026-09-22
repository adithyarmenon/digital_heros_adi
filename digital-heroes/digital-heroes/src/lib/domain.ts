export const FEES = { monthly: 499, yearly: 4990 };
export const POOL_PCT = 0.5;
export const MIN_CHARITY = 10;
export const TIER_SHARE: Record<number, number> = { 5: 0.4, 4: 0.35, 3: 0.25 };

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const iso = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
export const addDays = (d: Date | string, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const nextMonthLabel = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1)).slice(0, 7);
};

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  role: 'user' | 'admin';
  charity_id: string | null;
  charity_pct: number;
};
export type Subscription = {
  id: string;
  user_id: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'lapsed';
  renews_on: string;
};
export type Score = { id: string; user_id: string; value: number; played_on: string };
export type Charity = {
  id: string;
  name: string;
  description: string | null;
  tag: string | null;
  featured: boolean;
  events: { title: string; date: string }[];
};
export type Draw = {
  id: string;
  month: string;
  mode: string;
  numbers: number[];
  base_pool: number;
  carry_in: number;
  carry_out: number;
  published_at: string;
};
export type Winner = {
  id: string;
  draw_id: string;
  user_id: string;
  tier: number;
  amount: number;
  proof_url: string | null;
  status: 'awaiting_proof' | 'pending_review' | 'approved' | 'rejected';
  payment: 'pending' | 'paid';
};

export function monthlyEquivalent(sub: Subscription | null): number {
  if (!sub) return 0;
  return sub.plan === 'yearly' ? FEES.yearly / 12 : FEES.monthly;
}

export function subState(sub: Subscription | null): 'active' | 'cancelled' | 'lapsed' | 'none' {
  if (!sub) return 'none';
  const live = new Date(sub.renews_on) >= new Date(iso(new Date()));
  if (sub.status === 'active') return live ? 'active' : 'lapsed';
  if (sub.status === 'cancelled') return live ? 'cancelled' : 'lapsed';
  return 'lapsed';
}
export const hasAccess = (sub: Subscription | null) =>
  ['active', 'cancelled'].includes(subState(sub));

export function validateScore(value: number, date: string, existing: Score[], excludeId?: string) {
  if (!Number.isInteger(value) || value < 1 || value > 45)
    return 'Score must be a whole number from 1 to 45.';
  if (!date) return 'Choose the date you played.';
  if (date > iso(new Date())) return 'Date cannot be in the future.';
  if (existing.some((s) => s.played_on === date && s.id !== excludeId))
    return 'You already have a score for that date. Edit or delete it instead.';
  return null;
}

export function genNumbers(mode: 'random' | 'algo', scoresByUser: number[][]): number[] {
  const pick = new Set<number>();
  if (mode === 'random') {
    while (pick.size < 5) pick.add(1 + Math.floor(Math.random() * 45));
  } else {
    const w: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) w[i] = 1;
    scoresByUser.forEach((vals) => vals.forEach((v) => (w[v] = (w[v] || 0) + 1)));
    while (pick.size < 5) {
      const tot = [...Array(45)].reduce((a, _, i) => (pick.has(i + 1) ? a : a + w[i + 1]), 0);
      let r = Math.random() * tot;
      for (let i = 1; i <= 45; i++) {
        if (pick.has(i)) continue;
        r -= w[i];
        if (r <= 0) {
          pick.add(i);
          break;
        }
      }
    }
  }
  return [...pick].sort((a, b) => a - b);
}

export type TierResult = { pool: number; count: number; each: number; userIds: string[] };
export type EvalResult = {
  month: string;
  mode: string;
  numbers: number[];
  participants: number;
  base: number;
  carryIn: number;
  carryOut: number;
  tiers: Record<number, TierResult>;
};

export function evaluateDraw(
  month: string,
  numbers: number[],
  mode: string,
  activeSubMonthly: number[], // monthly-equivalent fee for each active subscriber
  activeUserIds: string[],
  scoresByUserId: Record<string, number[]>,
  carryIn: number
): EvalResult {
  const base = activeSubMonthly.reduce((a, b) => a + b, 0) * POOL_PCT;
  const tiers: Record<number, TierResult> = {};
  [5, 4, 3].forEach((t) => {
    const amt = base * TIER_SHARE[t] + (t === 5 ? carryIn : 0);
    const winners = activeUserIds.filter((uid) => {
      const vals = new Set(scoresByUserId[uid] || []);
      const matches = numbers.filter((n) => vals.has(n)).length;
      return matches === t;
    });
    tiers[t] = { pool: amt, count: winners.length, each: winners.length ? amt / winners.length : 0, userIds: winners };
  });
  return {
    month,
    mode,
    numbers,
    participants: activeUserIds.length,
    base,
    carryIn,
    carryOut: tiers[5].count ? 0 : tiers[5].pool,
    tiers,
  };
}
