'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { FEES, MIN_CHARITY, inr, subState } from '@/lib/domain';
import type { Charity } from '@/lib/domain';

function SubscribeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, profile, subscription, refresh, loading } = useAuth();
  const toast = useToast();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [charityId, setCharityId] = useState(params.get('c') || '');
  const [pct, setPct] = useState(MIN_CHARITY);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('charities').select('*').order('name').then(({ data }) => setCharities((data || []) as Charity[]));
  }, []);

  useEffect(() => {
    if (profile) {
      setCharityId((c) => c || profile.charity_id || '');
      setPct(profile.charity_pct || MIN_CHARITY);
    }
  }, [profile]);

  if (!loading && !userId) {
    return (
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 480 }}>
          <h2>Create your account first</h2>
          <p className="mute">You need an account to subscribe.</p>
          <Link className="btn cta" href={`/signup${charityId ? `?c=${charityId}` : ''}`}>
            Sign up
          </Link>
        </div>
      </section>
    );
  }
  if (profile?.role === 'admin') {
    return (
      <section className="sec">
        <div className="wrap">
          <h2>Admins don&apos;t subscribe</h2>
        </div>
      </section>
    );
  }

  const st = subState(subscription);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!(pct >= MIN_CHARITY && pct <= 100)) return setErr(`Charity share must be between ${MIN_CHARITY}% and 100%.`);
    setBusy(true);
    const supabase = createClient();
    const days = plan === 'yearly' ? 365 : 30;
    const renews = new Date();
    renews.setDate(renews.getDate() + days);

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('profiles').update({ charity_id: charityId, charity_pct: pct }).eq('id', userId),
      supabase.from('subscriptions').upsert(
        { user_id: userId, plan, status: 'active', renews_on: renews.toISOString().slice(0, 10) },
        { onConflict: 'user_id' }
      ),
    ]);
    setBusy(false);
    if (e1 || e2) return setErr((e1 || e2)!.message);
    await refresh();
    toast('Payment successful. You\'re in the next draw.');
    router.push('/dashboard');
  };

  return (
    <section className="sec">
      <div className="wrap">
        <h2>Choose your plan</h2>
        {st === 'active' && subscription && (
          <p className="pill ok">
            You&apos;re subscribed on the {subscription.plan} plan until {subscription.renews_on}.
          </p>
        )}
        <form onSubmit={submit}>
          <div className="grid g2">
            <label className="card">
              <input type="radio" name="plan" value="monthly" checked={plan === 'monthly'} onChange={() => setPlan('monthly')} style={{ width: 'auto' }} />{' '}
              <b>Monthly</b>
              <div className="ticker">{inr(FEES.monthly)}</div>
              <span className="mute">per month</span>
            </label>
            <label className="card">
              <input type="radio" name="plan" value="yearly" checked={plan === 'yearly'} onChange={() => setPlan('yearly')} style={{ width: 'auto' }} />{' '}
              <b>Yearly</b> <span className="pill ok">Save {inr(FEES.monthly * 12 - FEES.yearly)}</span>
              <div className="ticker">{inr(FEES.yearly)}</div>
              <span className="mute">per year</span>
            </label>
          </div>
          <div className="grid g2">
            <div>
              <label>Charity</label>
              <select value={charityId} onChange={(e) => setCharityId(e.target.value)}>
                {charities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Charity share (min {MIN_CHARITY}%)</label>
              <input type="number" min={MIN_CHARITY} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <h3>Payment (test mode)</h3>
            <p className="mute">Simulated checkout. No real charge is made.</p>
            <label>Card number</label>
            <input defaultValue="4242 4242 4242 4242" required />
            <div className="grid g2">
              <div>
                <label>Expiry</label>
                <input defaultValue="12/30" />
              </div>
              <div>
                <label>CVC</label>
                <input defaultValue="123" />
              </div>
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="cta" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? 'Processing…' : 'Pay and subscribe'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default function Subscribe() {
  return (
    <Suspense fallback={null}>
      <SubscribeForm />
    </Suspense>
  );
}
