'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import type { Charity } from '@/lib/domain';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [charityId, setCharityId] = useState(params.get('c') || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('charities')
      .select('*')
      .order('name')
      .then(({ data }) => {
        const list = (data || []) as Charity[];
        setCharities(list);
        if (!charityId && list[0]) setCharityId(list[0].id);
      });
  }, [charityId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: { data: { name } },
    });
    if (error) {
      setBusy(false);
      return setErr(error.message.includes('already') ? 'That email is already registered. Log in instead.' : error.message);
    }
    // profile row is created by the DB trigger; give it a moment then set charity
    if (data.user) {
      await new Promise((r) => setTimeout(r, 400));
      await supabase.from('profiles').update({ charity_id: charityId }).eq('id', data.user.id);
    }
    setBusy(false);
    await refresh();
    router.push('/subscribe');
  };

  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 480 }}>
        <h2>Create your account</h2>
        <div className="card">
          <form onSubmit={submit}>
            <label>Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            <label>Charity you support</label>
            <select value={charityId} onChange={(e) => setCharityId(e.target.value)}>
              {charities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {err && <div className="err">{err}</div>}
            <button style={{ width: '100%', marginTop: 8 }} disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="mute">
            Have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
