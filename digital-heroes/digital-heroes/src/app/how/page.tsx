import Link from 'next/link';
import { TIER_SHARE, POOL_PCT, inr, FEES } from '@/lib/domain';

export default function How() {
  return (
    <section className="sec">
      <div className="wrap">
        <h2>How the draw works</h2>
        <p className="mute" style={{ maxWidth: '40em' }}>
          Each month we draw five numbers between 1 and 45. Your five saved scores are your numbers.
          Match three or more and you win a share of that tier&apos;s pool, split equally between
          everyone in the same tier.
        </p>
        <div className="card scroll">
          <table>
            <tbody>
              <tr>
                <th>Match</th>
                <th>Share of pool</th>
                <th>Rollover</th>
              </tr>
              {[5, 4, 3].map((t) => (
                <tr key={t}>
                  <td>{t}-number match</td>
                  <td>{TIER_SHARE[t] * 100}%</td>
                  <td>{t === 5 ? 'Yes, jackpot carries forward' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid g2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Random draw</h3>
            <p className="mute">Standard lottery style. Every number in 1 to 45 is equally likely.</p>
          </div>
          <div className="card">
            <h3>Algorithmic draw</h3>
            <p className="mute">
              Numbers are weighted by how often each score appears among active players.
            </p>
          </div>
        </div>
        <p className="mute">
          {POOL_PCT * 100}% of every subscription (monthly equivalent) funds the pool, starting at{' '}
          {inr(FEES.monthly)}/month. Admins simulate each draw before publishing it.
        </p>
        <Link className="btn cta" href="/subscribe">
          Join the next draw
        </Link>
      </div>
    </section>
  );
}
