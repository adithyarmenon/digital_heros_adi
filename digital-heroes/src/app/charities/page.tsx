import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Charity } from '@/lib/domain';
import SearchBar from './SearchBar';

export const revalidate = 0;

function tileStyle() {
  return { background: 'linear-gradient(135deg, #5B2A86, #E4572E)', height: 120 };
}

export default async function Charities({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q = '', tag = '' } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('charities').select('*').order('name');
  const all = (data || []) as Charity[];
  const tags = [...new Set(all.map((c) => c.tag).filter(Boolean))] as string[];
  const list = all.filter(
    (c) =>
      (!tag || c.tag === tag) &&
      (c.name + ' ' + (c.description || '')).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="sec">
      <div className="wrap">
        <h2>Choose who you play for</h2>
        <SearchBar q={q} tag={tag} tags={tags} />
        <div className="grid g3" style={{ marginTop: 16 }}>
          {list.length === 0 && <p className="mute">No charities match. Clear the search to see them all.</p>}
          {list.map((c) => (
            <Link className="card" style={{ textDecoration: 'none' }} href={`/charities/${c.id}`} key={c.id}>
              <div className="tile" style={tileStyle()}>
                {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <span className="pill">{c.tag}</span>
              <h3 style={{ marginTop: 8 }}>{c.name}</h3>
              <p className="mute">{c.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
