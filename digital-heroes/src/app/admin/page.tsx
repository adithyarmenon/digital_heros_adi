'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import {
  inr,
  iso,
  addDays,
  subState,
  hasAccess,
  monthlyEquivalent,
  nextMonthLabel,
  genNumbers,
  evaluateDraw,
  validateScore,
} from '@/lib/domain';
import type { Profile, Subscription, Score, Charity, Draw, Winner, EvalResult } from '@/lib/domain';

const TABS = ['reports', 'users', 'draws', 'charities', 'winners'] as const;

function AdminInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, profile, loading } = useAuth();
  const toast = useToast();
  const supabase = createClient();
  const tab = (params.get('tab') as (typeof TABS)[number]) || 'reports';

  const [users, setUsers] = useState<Profile[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [donationsTotal, setDonationsTotal] = useState(0);

  const [userModal, setUserModal] = useState<Profile | null>(null);
  const [charityModal, setCharityModal] = useState<Charity | 'new' | null>(null);
  const [sim, setSim] = useState<EvalResult | null>(null);
  const [mode, setMode] = useState<'random' | 'algo'>('random');
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [u, s, sc, c, d, w, don] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'user'),
      supabase.from('subscriptions').select('*'),
      supabase.from('scores').select('*'),
      supabase.from('charities').select('*').order('name'),
      supabase.from('draws').select('*').order('month', { ascending: false }),
      supabase.from('winners').select('*'),
      supabase.from('donations').select('amount'),
    ]);
    setUsers((u.data || []) as Profile[]);
    setSubs((s.data || []) as Subscription[]);
    setScores((sc.data || []) as Score[]);
    setCharities((c.data || []) as Charity[]);
    setDraws((d.data || []) as Draw[]);
    setWinners((w.data || []) as Winner[]);
    setDonationsTotal((don.data || []).reduce((a, x) => a + Number(x.amount), 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && (!userId || profile?.role !== 'admin')) router.push('/login');
  }, [loading, userId, profile, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading || !userId || profile?.role !== 'admin') return null;

  const setTab = (t: string) => router.push(`/admin?tab=${t}`);
  const subOf = (uid: string) => subs.find((s) => s.user_id === uid) || null;
  const scoresOf = (uid: string) => scores.filter((s) => s.user_id === uid).sort((a, b) => b.played_on.localeCompare(a.played_on));
  const activeUsers = users.filter((u) => hasAccess(subOf(u.id)));

  /* ---------- Reports ---------- */
  const pool = activeUsers.reduce((a, u) => a + monthlyEquivalent(subOf(u.id)), 0) * 0.5;
  const contrib = users.filter((u) => hasAccess(subOf(u.id))).reduce((a, u) => a + monthlyEquivalent(subOf(u.id)) * (u.charity_pct / 100), 0);
  const paidOut = winners.filter((w) => w.payment === 'paid').reduce((a, w) => a + w.amount, 0);

  /* ---------- Draws ---------- */
  const runSim = () => {
    const scoresByUserId: Record<string, number[]> = {};
    activeUsers.forEach((u) => (scoresByUserId[u.id] = scoresOf(u.id).map((s) => s.value)));
    const lastDraw = draws[0];
    const carryIn = lastDraw ? lastDraw.carry_out : 0;
    const numbers = genNumbers(mode, activeUsers.map((u) => scoresByUserId[u.id] || []));
    const result = evaluateDraw(
      nextMonthLabel(),
      numbers,
      mode,
      activeUsers.map((u) => monthlyEquivalent(subOf(u.id))),
      activeUsers.map((u) => u.id),
      scoresByUserId,
      carryIn
    );
    setSim(result);
  };

  const publish = async () => {
    if (!sim) return;
    if (draws.some((d) => d.month === sim.month)) return toast(`A draw for ${sim.month} is already published.`, true);
    const { data: draw, error } = await supabase
      .from('draws')
      .insert({
        month: sim.month,
        mode: sim.mode,
        numbers: sim.numbers,
        base_pool: sim.base,
        carry_in: sim.carryIn,
        carry_out: sim.carryOut,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !draw) return toast(error?.message || 'Could not publish.', true);
    const rows: Partial<Winner>[] = [];
    [5, 4, 3].forEach((t) => {
      sim.tiers[t].userIds.forEach((uid) => {
        rows.push({ draw_id: draw.id, user_id: uid, tier: t, amount: sim.tiers[t].each, status: 'awaiting_proof', payment: 'pending' });
      });
    });
    if (rows.length) {
      const { error: werr } = await supabase.from('winners').insert(rows);
      if (werr) return toast(werr.message, true);
    }
    setSim(null);
    toast('Draw published. Winners have been notified in their dashboards.');
    loadAll();
  };

  /* ---------- Winners ---------- */
  const setWinnerStatus = async (id: string, status: string) => {
    await supabase.from('winners').update({ status }).eq('id', id);
    loadAll();
  };
  const markPaid = async (id: string) => {
    await supabase.from('winners').update({ payment: 'paid' }).eq('id', id);
    toast('Marked as paid.');
    loadAll();
  };
  const viewProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 300);
    if (error) return toast(error.message, true);
    setProofUrl(data.signedUrl);
  };

  /* ---------- Charities ---------- */
  const feature = async (id: string) => {
    await supabase.from('charities').update({ featured: false }).neq('id', id);
    await supabase.from('charities').update({ featured: true }).eq('id', id);
    loadAll();
  };
  const delCharity = async (id: string) => {
    if (users.some((u) => u.charity_id === id)) return toast('Some users support this charity. Reassign them first.', true);
    if (!confirm('Delete charity?')) return;
    await supabase.from('charities').delete().eq('id', id);
    loadAll();
  };
  const saveCharity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name'));
    const description = String(form.get('desc'));
    const tag = String(form.get('tag'));
    const event = String(form.get('event') || '');
    const edate = String(form.get('edate') || '');
    const events = event && edate ? [{ title: event, date: edate }] : [];
    if (charityModal === 'new') {
      await supabase.from('charities').insert({ name, description, tag, events });
    } else if (charityModal) {
      await supabase.from('charities').update({ name, description, tag, events }).eq('id', charityModal.id);
    }
    setCharityModal(null);
    toast('Charity saved.');
    loadAll();
  };

  /* ---------- Users ---------- */
  const saveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userModal) return;
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name'));
    const plan = String(form.get('plan'));
    const status = String(form.get('status'));
    const renews = String(form.get('renews'));
    await supabase.from('profiles').update({ name }).eq('id', userModal.id);
    if (plan === 'none') {
      await supabase.from('subscriptions').delete().eq('user_id', userModal.id);
    } else {
      await supabase.from('subscriptions').upsert({ user_id: userModal.id, plan, status, renews_on: renews }, { onConflict: 'user_id' });
    }
    setUserModal(null);
    toast('User updated.');
    loadAll();
  };
  const adminEditScore = async (id: string, current: Score) => {
    const v = prompt('New score (1-45)', String(current.value));
    if (v === null) return;
    const err = validateScore(Number(v), current.played_on, scoresOf(current.user_id), current.id);
    if (err) return toast(err, true);
    await supabase.from('scores').update({ value: Number(v) }).eq('id', id);
    toast('Score updated.');
    loadAll();
  };
  const adminDelScore = async (id: string) => {
    await supabase.from('scores').delete().eq('id', id);
    toast('Score deleted.');
    loadAll();
  };

  const winLabel = (w: Winner) =>
    ({
      awaiting_proof: ['Upload proof', 'warn'],
      pending_review: ['In review', 'warn'],
      approved: ['Approved', 'ok'],
      rejected: ['Rejected', 'bad'],
    })[w.status];

  return (
    <section className="sec">
      <div className="wrap">
        <h2>Admin</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <a key={t} className={t === tab ? 'on' : ''} href="#" onClick={(e) => { e.preventDefault(); setTab(t); }}>
              {t[0].toUpperCase() + t.slice(1)}
            </a>
          ))}
        </div>

        {tab === 'reports' && (
          <>
            <div className="grid g4">
              <div className="card stat"><span className="mute">Total users</span><b>{users.length}</b></div>
              <div className="card stat"><span className="mute">Active subscribers</span><b>{activeUsers.length}</b></div>
              <div className="card stat"><span className="mute">Monthly prize pool</span><b>{inr(pool)}</b></div>
              <div className="card stat"><span className="mute">Charity per month</span><b>{inr(contrib)}</b></div>
              <div className="card stat"><span className="mute">Direct donations</span><b>{inr(donationsTotal)}</b></div>
              <div className="card stat"><span className="mute">Draws published</span><b>{draws.length}</b></div>
              <div className="card stat"><span className="mute">Winners</span><b>{winners.length}</b></div>
              <div className="card stat"><span className="mute">Paid out</span><b>{inr(paidOut)}</b></div>
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Contribution by charity (monthly)</h3>
              {charities.map((c) => {
                const v = users.filter((u) => u.charity_id === c.id && hasAccess(subOf(u.id))).reduce((a, u) => a + monthlyEquivalent(subOf(u.id)) * (u.charity_pct / 100), 0);
                return (
                  <div key={c.id}>
                    <p>{c.name} <b style={{ float: 'right' }}>{inr(v)}</b></p>
                    <div className="bar"><i style={{ width: `${contrib ? (v / contrib) * 100 : 0}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Draw statistics</h3>
              {draws.length ? (
                <table>
                  <tbody>
                    <tr><th>Month</th><th>Winners</th><th>Pool</th><th>5</th><th>4</th><th>3</th></tr>
                    {draws.map((d) => (
                      <tr key={d.id}><td>{d.month}</td><td>{winners.filter((w) => w.draw_id === d.id).length}</td><td>{inr(d.base_pool)}</td>
                        <td>{winners.filter((w) => w.draw_id === d.id && w.tier === 5).length}</td>
                        <td>{winners.filter((w) => w.draw_id === d.id && w.tier === 4).length}</td>
                        <td>{winners.filter((w) => w.draw_id === d.id && w.tier === 3).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mute">No published draws yet.</p>
              )}
            </div>
          </>
        )}

        {tab === 'users' && (
          <div className="card scroll">
            <table>
              <tbody>
                <tr><th>User</th><th>Plan</th><th>Status</th><th>Charity</th><th>Scores</th><th></th></tr>
                {users.map((u) => {
                  const s = subOf(u.id);
                  const st = subState(s);
                  const c = charities.find((x) => x.id === u.charity_id);
                  return (
                    <tr key={u.id}>
                      <td>{u.name}<br /><span className="mute">{u.email}</span></td>
                      <td>{s ? s.plan : '-'}</td>
                      <td><span className={`pill ${st === 'active' ? 'ok' : 'bad'}`}>{st}</span><br /><span className="mute">{s?.renews_on}</span></td>
                      <td>{c?.name} {u.charity_pct}%</td>
                      <td>{scoresOf(u.id).map((x) => x.value).join(', ')}</td>
                      <td><button className="ghost sm" onClick={() => setUserModal(u)}>Manage</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'draws' && (
          <>
            <div className="card">
              <h3>Run a draw for {nextMonthLabel()}</h3>
              <div className="row">
                <select style={{ maxWidth: 260 }} value={mode} onChange={(e) => setMode(e.target.value as 'random' | 'algo')}>
                  <option value="random">Random (lottery style)</option>
                  <option value="algo">Algorithmic (score-frequency weighted)</option>
                </select>
                <button onClick={runSim}>Run simulation</button>
              </div>
              {sim && (
                <>
                  <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
                  <h3>Simulation · {sim.mode === 'algo' ? 'algorithmic' : 'random'}</h3>
                  <div className="balls">{sim.numbers.map((n) => <div className="ball" key={n}>{n}</div>)}</div>
                  <p className="mute">{sim.participants} active players · base pool {inr(sim.base)}{sim.carryIn ? ` + ${inr(sim.carryIn)} rolled over` : ''}</p>
                  <table>
                    <tbody>
                      <tr><th>Tier</th><th>Pool</th><th>Winners</th><th>Each</th></tr>
                      {[5, 4, 3].map((t) => (
                        <tr key={t}><td>{t}-match</td><td>{inr(sim.tiers[t].pool)}</td><td>{sim.tiers[t].count}</td><td>{inr(sim.tiers[t].each)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {!sim.tiers[5].count && <p className="pill warn">No jackpot winner: this tier rolls over to next month.</p>}
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="cta" onClick={publish}>Publish results</button>
                    <button className="ghost" onClick={runSim}>Re-run</button>
                  </div>
                </>
              )}
            </div>
            <div className="card" style={{ marginTop: 18 }}>
              <h3>Published draws</h3>
              {draws.map((d) => (
                <p key={d.id}><b>{d.month}</b> · {d.mode} · {d.numbers.join(' ')} · jackpot {winners.some((w) => w.draw_id === d.id && w.tier === 5) ? 'won' : `rolled over (${inr(d.carry_out)})`}</p>
              ))}
              {!draws.length && <p className="mute">None yet.</p>}
            </div>
          </>
        )}

        {tab === 'charities' && (
          <>
            <button style={{ marginBottom: 14 }} onClick={() => setCharityModal('new')}>Add charity</button>
            <div className="grid g3">
              {charities.map((c) => (
                <div className="card" key={c.id}>
                  <div className="tile" style={{ height: 70, background: 'linear-gradient(135deg,#5B2A86,#E4572E)' }}>
                    {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                  <h3>{c.name}</h3>
                  <p className="mute">{c.description}</p>
                  {c.featured && <p><span className="pill warn">Featured</span></p>}
                  <div className="row">
                    <button className="ghost sm" onClick={() => setCharityModal(c)}>Edit</button>
                    <button className="ghost sm" onClick={() => feature(c.id)}>Feature</button>
                    <button className="danger sm" onClick={() => delCharity(c.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'winners' && (
          <div className="card scroll">
            <table>
              <tbody>
                <tr><th>Winner</th><th>Draw</th><th>Prize</th><th>Proof</th><th>Status</th><th></th></tr>
                {winners.map((w) => {
                  const u = users.find((x) => x.id === w.user_id);
                  const d = draws.find((x) => x.id === w.draw_id);
                  const l = winLabel(w);
                  return (
                    <tr key={w.id}>
                      <td>{u?.name}</td>
                      <td>{d?.month} · {w.tier}-match</td>
                      <td>{inr(w.amount)}</td>
                      <td>{w.proof_url ? <a href="#" onClick={(e) => { e.preventDefault(); viewProof(w.proof_url!); }}>View</a> : '-'}</td>
                      <td><span className={`pill ${l[1]}`}>{l[0]}</span> <span className={`pill ${w.payment === 'paid' ? 'ok' : ''}`}>{w.payment}</span></td>
                      <td>
                        {w.status === 'pending_review' && (
                          <>
                            <button className="okb sm" onClick={() => setWinnerStatus(w.id, 'approved')}>Approve</button>{' '}
                            <button className="danger sm" onClick={() => setWinnerStatus(w.id, 'rejected')}>Reject</button>
                          </>
                        )}
                        {w.status === 'approved' && w.payment === 'pending' && (
                          <button className="sm" onClick={() => markPaid(w.id)}>Mark paid</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!winners.length && <tr><td className="mute" colSpan={6}>No winners yet. Publish a draw first.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userModal && (
        <Modal onClose={() => setUserModal(null)}>
          <h3>Manage {userModal.name}</h3>
          <form onSubmit={saveUser}>
            <label>Name</label>
            <input name="name" defaultValue={userModal.name || ''} />
            <div className="grid g2">
              <div>
                <label>Plan</label>
                <select name="plan" defaultValue={subOf(userModal.id)?.plan || 'none'}>
                  <option value="none">none</option>
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select name="status" defaultValue={subOf(userModal.id)?.status || 'active'}>
                  <option value="active">active</option>
                  <option value="cancelled">cancelled</option>
                  <option value="lapsed">lapsed</option>
                </select>
              </div>
            </div>
            <label>Renewal date</label>
            <input name="renews" type="date" defaultValue={subOf(userModal.id)?.renews_on || iso(addDays(new Date(), 30))} />
            <button style={{ marginTop: 14 }}>Save profile &amp; subscription</button>
          </form>
          <h3 style={{ marginTop: 20 }}>Scores</h3>
          {scoresOf(userModal.id).map((s) => (
            <div className="row between" key={s.id}>
              <span><b>{s.value}</b> · {s.played_on}</span>
              <span>
                <button className="ghost sm" onClick={() => adminEditScore(s.id, s)}>Edit</button>{' '}
                <button className="ghost sm" onClick={() => adminDelScore(s.id)}>Delete</button>
              </span>
            </div>
          ))}
          {!scoresOf(userModal.id).length && <p className="mute">No scores.</p>}
        </Modal>
      )}

      {charityModal && (
        <Modal onClose={() => setCharityModal(null)}>
          <h3>{charityModal === 'new' ? 'Add' : 'Edit'} charity</h3>
          <form onSubmit={saveCharity}>
            <label>Name</label>
            <input name="name" required defaultValue={charityModal === 'new' ? '' : charityModal.name} />
            <label>Description</label>
            <textarea name="desc" required defaultValue={charityModal === 'new' ? '' : charityModal.description || ''} />
            <label>Cause</label>
            <input name="tag" required defaultValue={charityModal === 'new' ? '' : charityModal.tag || ''} />
            <label>Upcoming event (optional)</label>
            <input name="event" defaultValue={charityModal === 'new' ? '' : charityModal.events?.[0]?.title || ''} />
            <label>Event date</label>
            <input name="edate" type="date" defaultValue={charityModal === 'new' ? '' : charityModal.events?.[0]?.date || ''} />
            <div className="row" style={{ marginTop: 14 }}>
              <button>Save</button>
              <button type="button" className="ghost" onClick={() => setCharityModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {proofUrl && (
        <Modal onClose={() => setProofUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofUrl} alt="Winner proof" style={{ maxWidth: '100%' }} />
          <button style={{ marginTop: 14 }} onClick={() => setProofUrl(null)}>Close</button>
        </Modal>
      )}
    </section>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={null}>
      <AdminInner />
    </Suspense>
  );
}
