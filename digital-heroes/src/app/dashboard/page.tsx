'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import {
  MIN_CHARITY,
  inr,
  iso,
  subState,
  hasAccess,
  monthlyEquivalent,
  validateScore,
  nextMonthLabel,
} from '@/lib/domain';
import type { Charity, Score, Draw, Winner } from '@/lib/domain';

export default function Dashboard() {
  const router = useRouter();
  const { userId, profile, subscription, loading, refresh } = useAuth();
  const toast = useToast();
  const supabase = createClient();

  const [charities, setCharities] = useState<Charity[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [busy, setBusy] = useState(false);
  const [scoreErr, setScoreErr] = useState('');
  const [editing, setEditing] = useState<Score | null>(null);
  const [charityModal, setCharityModal] = useState(false);
  const [proofFor, setProofFor] = useState<Winner | null>(null);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const [{ data: c }, { data: sc }, { data: dr }, { data: wn }] = await Promise.all([
      supabase.from('charities').select('*').order('name'),
      supabase.from('scores').select('*').eq('user_id', userId).order('played_on', { ascending: false }),
      supabase.from('draws').select('*').order('month', { ascending: false }),
      supabase.from('winners').select('*').eq('user_id', userId),
    ]);
    setCharities((c || []) as Charity[]);
    setScores((sc || []) as Score[]);
    setDraws((dr || []) as Draw[]);
    setWinners((wn || []) as Winner[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!loading && !userId) router.push('/login');
    if (!loading && profile?.role === 'admin') router.push('/admin');
  }, [loading, userId, profile, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading || !userId || !profile) return null;

  const st = subState(subscription);
  const locked = !hasAccess(subscription);
  const charity = charities.find((c) => c.id === profile.charity_id);
  const won = winners.filter((w) => w.status === 'approved').reduce((a, w) => a + w.amount, 0);
  const stTxt: Record<string, [string, string]> = {
    active: ['Active', 'ok'],
    cancelled: ['Cancelled · access until period end', 'warn'],
    lapsed: ['Lapsed', 'bad'],
    none: ['Not subscribed', 'bad'],
  };

  const addScore = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = Number(form.get('v'));
    const d = String(form.get('d'));
    const err = validateScore(v, d, scores);
    if (err) return setScoreErr(err);
    setScoreErr('');
    setBusy(true);
    const { error } = await supabase.from('scores').insert({ user_id: userId, value: v, played_on: d });
    setBusy(false);
    if (error) return setScoreErr(error.message);
    (e.target as HTMLFormElement).reset();
    toast('Score saved.');
    loadAll();
  };

  const deleteScore = async (id: string) => {
    if (!confirm('Delete this score?')) return;
    await supabase.from('scores').delete().eq('id', id);
    loadAll();
  };

  const saveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const v = Number(form.get('v'));
    const d = String(form.get('d'));
    const err = validateScore(v, d, scores, editing.id);
    if (err) return toast(err, true);
    const { error } = await supabase.from('scores').update({ value: v, played_on: d }).eq('id', editing.id);
    if (error) return toast(error.message, true);
    setEditing(null);
    toast('Score updated.');
    loadAll();
  };

  const cancelSub = async () => {
    if (!subscription) return;
    if (!confirm('Cancel? You keep access until ' + subscription.renews_on + '.')) return;
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('user_id', userId);
    await refresh();
    toast('Subscription cancelled.');
  };

  const saveCharity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const cid = String(form.get('charity'));
    const pct = Number(form.get('pct'));
    if (!(pct >= MIN_CHARITY && pct <= 100)) return toast(`Minimum is ${MIN_CHARITY}%.`, true);
    await supabase.from('profiles').update({ charity_id: cid, charity_pct: pct }).eq('id', userId);
    await refresh();
    setCharityModal(false);
  };

  const uploadProof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!proofFor) return;
    const form = new FormData(e.currentTarget);
    const file = form.get('file') as File;
    if (!file || file.size === 0) return toast('Choose a screenshot first.', true);
    if (file.size > 1.5e6) return toast('Image is too large. Keep it under 1.5 MB.', true);
    setBusy(true);
    const path = `${userId}/${proofFor.id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('proofs').upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      return toast(upErr.message, true);
    }
    const { error } = await supabase
      .from('winners')
      .update({ proof_url: path, status: 'pending_review' })
      .eq('id', proofFor.id);
    setBusy(false);
    if (error) return toast(error.message, true);
    setProofFor(null);
    toast('Proof submitted for review.');
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
        <h2>Hi {(profile.name || 'there').split(' ')[0]}</h2>
        <div className="grid g4">
          <div className="card stat">
            <span className="mute">Subscription</span>
            <br />
            <span className={`pill ${stTxt[st][1]}`}>{stTxt[st][0]}</span>
            <p className="mute" style={{ margin: '8px 0' }}>
              {subscription ? `${subscription.plan} · renews ${subscription.renews_on}` : 'No plan yet'}
            </p>
            <div className="row">
              {st === 'active' ? (
                <button className="ghost sm" onClick={cancelSub}>
                  Cancel
                </button>
              ) : (
                <Link className="btn sm cta" href="/subscribe">
                  {subscription ? 'Renew' : 'Subscribe'}
                </Link>
              )}
            </div>
          </div>
          <div className="card stat">
            <span className="mute">Draws entered</span>
            <b>{draws.length}</b>
            <span className="mute">Next draw: {nextMonthLabel()}</span>
          </div>
          <div className="card stat">
            <span className="mute">Total won</span>
            <b>{inr(won)}</b>
            <span className="mute">
              {winners.length} win{winners.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="card stat">
            <span className="mute">Your charity</span>
            <b style={{ fontSize: '1.2rem' }}>{charity?.name || '—'}</b>
            <span className="mute">
              {profile.charity_pct}% · {inr(monthlyEquivalent(subscription) * profile.charity_pct / 100)}/mo
            </span>
            <br />
            <button className="ghost sm" style={{ marginTop: 8 }} onClick={() => setCharityModal(true)}>
              Change
            </button>
          </div>
        </div>

        <div className="grid g2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Your last 5 scores</h3>
            {locked ? (
              <>
                <p className="mute">Score entry unlocks with an active subscription.</p>
                <Link className="btn cta" href="/subscribe">
                  Subscribe
                </Link>
              </>
            ) : (
              <>
                <form onSubmit={addScore} className="row" style={{ alignItems: 'end' }}>
                  <div style={{ width: 110 }}>
                    <label>Score</label>
                    <input name="v" type="number" min={1} max={45} required />
                  </div>
                  <div>
                    <label>Date played</label>
                    <input name="d" type="date" max={iso(new Date())} defaultValue={iso(new Date())} required />
                  </div>
                  <button disabled={busy}>Add score</button>
                </form>
                {scoreErr && <div className="err">{scoreErr}</div>}
              </>
            )}
            <table style={{ marginTop: 10 }}>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.value}</b>
                    </td>
                    <td>{s.played_on}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!locked && (
                        <>
                          <button className="ghost sm" onClick={() => setEditing(s)}>
                            Edit
                          </button>{' '}
                          <button className="ghost sm" onClick={() => deleteScore(s.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {scores.length === 0 && (
                  <tr>
                    <td className="mute" colSpan={3}>
                      No scores yet. Add your first one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mute">{scores.length}/5 saved. One score per date; newest first.</p>
          </div>

          <div className="card">
            <h3>Winnings</h3>
            {winners.length ? (
              <div className="scroll">
                <table>
                  <tbody>
                    {winners.map((w) => {
                      const d = draws.find((x) => x.id === w.draw_id);
                      const l = winLabel(w);
                      return (
                        <tr key={w.id}>
                          <td>
                            {d?.month}
                            <br />
                            <span className="mute">{w.tier}-match</span>
                          </td>
                          <td>
                            <b>{inr(w.amount)}</b>
                          </td>
                          <td>
                            <span className={`pill ${l[1]}`}>{l[0]}</span>
                            <br />
                            <span className={`pill ${w.payment === 'paid' ? 'ok' : ''}`}>
                              {w.payment === 'paid' ? 'Paid' : 'Payment pending'}
                            </span>
                          </td>
                          <td>
                            {['awaiting_proof', 'rejected'].includes(w.status) && (
                              <button className="sm" onClick={() => setProofFor(w)}>
                                Upload proof
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mute">No wins yet. Keep your scores up to date and check back after the next draw.</p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Draw history</h3>
          {draws.length ? (
            draws.map((d) => {
              const vals = new Set(scores.map((s) => s.value));
              return (
                <p key={d.id}>
                  <b>{d.month}</b>
                  <div className="balls">
                    {d.numbers.map((n) => (
                      <div className={`ball ${vals.has(n) ? 'hit' : ''}`} key={n}>
                        {n}
                      </div>
                    ))}
                  </div>
                </p>
              );
            })
          ) : (
            <p className="mute">The first draw hasn&apos;t been published yet.</p>
          )}
        </div>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3>Edit score</h3>
          <form onSubmit={saveEdit}>
            <label>Score (1-45)</label>
            <input name="v" type="number" min={1} max={45} defaultValue={editing.value} required />
            <label>Date</label>
            <input name="d" type="date" defaultValue={editing.played_on} max={iso(new Date())} required />
            <div className="row" style={{ marginTop: 14 }}>
              <button>Save</button>
              <button type="button" className="ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {charityModal && (
        <Modal onClose={() => setCharityModal(false)}>
          <h3>Your charity</h3>
          <form onSubmit={saveCharity}>
            <label>Charity</label>
            <select name="charity" defaultValue={profile.charity_id || ''}>
              {charities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label>Share of fee (min {MIN_CHARITY}%)</label>
            <input name="pct" type="number" min={MIN_CHARITY} max={100} defaultValue={profile.charity_pct} />
            <div className="row" style={{ marginTop: 14 }}>
              <button>Save</button>
              <button type="button" className="ghost" onClick={() => setCharityModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {proofFor && (
        <Modal onClose={() => setProofFor(null)}>
          <h3>Upload proof</h3>
          <p className="mute">Upload a screenshot of your scores from your golf platform.</p>
          <form onSubmit={uploadProof}>
            <input type="file" name="file" accept="image/*" required />
            <button style={{ marginTop: 14 }} disabled={busy}>
              {busy ? 'Uploading…' : 'Submit for review'}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
