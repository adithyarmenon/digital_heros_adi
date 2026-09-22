import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { FEES, POOL_PCT, MIN_CHARITY, inr, monthlyEquivalent, hasAccess } from '@/lib/domain';
import type { Charity, Draw, Subscription } from '@/lib/domain';

export const revalidate = 0;

export default async function Home() {
  const supabase = await createClient();
  const [{ data: charities }, { data: draws }, { data: subs }, { data: profiles }] = await Promise.all([
    supabase.from('charities').select('*'),
    supabase.from('draws').select('*').order('month', { ascending: false }).limit(1),
    supabase.from('subscriptions').select('*'),
    supabase.from('profiles').select('id, charity_pct').eq('role', 'user'),
  ]);

  const subList = (subs || []) as Subscription[];
  const activeSubs = subList.filter((s) => hasAccess(s));
  const pool = activeSubs.reduce((a, s) => a + monthlyEquivalent(s), 0) * POOL_PCT;

  const pctByUser = new Map((profiles || []).map((p) => [p.id, p.charity_pct]));
  const totalToCharities = activeSubs.reduce(
    (a, s) => a + monthlyEquivalent(s) * ((pctByUser.get(s.user_id) ?? 10) / 100),
    0
  );

  const featured = ((charities || []) as Charity[]).find((c) => c.featured) || (charities || [])[0];
  const lastDraw = (draws as Draw[] | null)?.[0];

  return (
    <>
      <div className="hero">
        <div className="ring" />
        <div className="wrap">
          <p className="mute" style={{ fontWeight: 600 }}>
            Your scores. Someone else&apos;s good day.
          </p>
          <h1>
            Play your round.
            <br />
            Change a life.
          </h1>
          <p className="lead">
            Subscribe, log your last five Stableford scores, and choose the cause your fee supports.
            Every month your scores enter a prize draw too.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link className="btn cta" href="/subscribe">
              Start giving from {inr(FEES.monthly)}/month
            </Link>
            <Link className="btn ghost" href="/how">
              See how you can win
            </Link>
          </div>
        </div>
      </div>

      <section className="sec">
        <div className="wrap grid g3">
          <div className="card">
            <div className="ticker">{inr(totalToCharities)}</div>
            <p className="mute">going to charities every month from current subscribers</p>
          </div>
          <div className="card">
            <div className="ticker">{inr(pool)}</div>
            <p className="mute">in this month&apos;s prize pool</p>
          </div>
          <div className="card">
            <div className="ticker">{activeSubs.length}</div>
            <p className="mute">active heroes playing this month</p>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Three steps. That&apos;s the whole game.</h2>
          <div className="grid g3">
            <div className="card">
              <h3>1. Subscribe &amp; pick a cause</h3>
              <p className="mute">
                At least {MIN_CHARITY}% of your fee goes to your charity. Raise it whenever you like.
              </p>
            </div>
            <div className="card">
              <h3>2. Enter your last 5 scores</h3>
              <p className="mute">
                Stableford, 1 to 45. A new score pushes out the oldest, so your five are always fresh.
              </p>
            </div>
            <div className="card">
              <h3>3. Match the monthly draw</h3>
              <p className="mute">
                Match 3, 4 or 5 numbers to win a share of the pool. Unclaimed jackpots roll over.
              </p>
            </div>
          </div>
        </div>
      </section>

      {featured && (
        <section className="sec">
          <div className="wrap">
            <div className="card grid g2" style={{ alignItems: 'center' }}>
              <div
                className="tile"
                style={{
                  height: 180,
                  background: `linear-gradient(135deg, ${'#5B2A86'}, ${'#E4572E'})`,
                }}
              >
                {featured.name
                  .split(' ')
                  .map((w: string) => w[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <span className="pill warn">Featured charity</span>
                <h2 style={{ marginTop: 12 }}>{featured.name}</h2>
                <p className="mute">{featured.description}</p>
                <Link className="btn" href={`/charities/${featured.id}`}>
                  Read their story
                </Link>
              </div>
            </div>
            {lastDraw && (
              <div className="card" style={{ marginTop: 18 }}>
                <h3>Latest draw · {lastDraw.month}</h3>
                <div className="balls">
                  {lastDraw.numbers.map((n) => (
                    <div className="ball" key={n}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
