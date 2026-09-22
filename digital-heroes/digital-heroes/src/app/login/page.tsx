'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) return setErr('Email or password is incorrect.');
    await refresh();
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user!.id).single();
    router.push(prof?.role === 'admin' ? '/admin' : '/dashboard');
  };

  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 480 }}>
        <h2>Welcome back</h2>
        <div className="card">
          <form onSubmit={submit}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            {err && <div className="err">{err}</div>}
            <button style={{ width: '100%', marginTop: 8 }} disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <p className="mute">
            New here? <Link href="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
