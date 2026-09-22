'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { userId, profile, signOut } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dh_theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('dh_theme', next);
    setTheme(next);
  };

  const link = (href: string, label: string) => (
    <Link className={'navlink' + (path === href ? ' on' : '')} href={href}>
      {label}
    </Link>
  );

  return (
    <nav className="topnav">
      <div className="wrap">
        <Link className="logo" href="/">
          digital<i>.</i>heroes
        </Link>
        {link('/charities', 'Charities')}
        {link('/how', 'How the draw works')}
        <span className="sp" />
        {userId ? (
          <>
            {link(profile?.role === 'admin' ? '/admin' : '/dashboard', profile?.role === 'admin' ? 'Admin' : 'My dashboard')}
            <button
              className="ghost sm"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            {link('/login', 'Log in')}
            <Link className="btn sm cta" href="/subscribe">
              Subscribe
            </Link>
          </>
        )}
        <button className="ghost sm" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? '☀' : '◐'}
        </button>
      </div>
    </nav>
  );
}
