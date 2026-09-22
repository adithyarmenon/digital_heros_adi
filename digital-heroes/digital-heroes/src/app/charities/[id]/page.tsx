import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Charity } from '@/lib/domain';
import DonateButton from './DonateButton';

export const revalidate = 0;

export default async function CharityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('charities').select('*').eq('id', id).single();
  const c = data as Charity | null;
  if (!c) notFound();

  return (
    <section className="sec">
      <div className="wrap">
        <div className="tile" style={{ height: 220, background: 'linear-gradient(135deg,#5B2A86,#E4572E)' }}>
          {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <span className="pill">{c.tag}</span>
        <h2>{c.name}</h2>
        <p className="mute" style={{ maxWidth: '40em' }}>
          {c.description} Your subscription contribution and any extra donations help fund this work
          all year.
        </p>
        <div className="card">
          <h3>Upcoming events</h3>
          {c.events && c.events.length > 0 ? (
            c.events.map((e, i) => (
              <p key={i}>
                {e.title} · <b>{e.date}</b>
              </p>
            ))
          ) : (
            <p className="mute">No events scheduled.</p>
          )}
        </div>
        <br />
        <div className="row">
          <Link className="btn cta" href={`/subscribe?c=${c.id}`}>
            Support {c.name}
          </Link>
          <DonateButton charityId={c.id} charityName={c.name} />
        </div>
      </div>
    </section>
  );
}
