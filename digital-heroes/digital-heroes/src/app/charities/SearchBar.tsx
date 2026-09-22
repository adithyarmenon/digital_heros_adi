'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SearchBar({ q, tag, tags }: { q: string; tag: string; tags: string[] }) {
  const router = useRouter();
  const [val, setVal] = useState(q);

  const update = (nextQ: string, nextTag: string) => {
    const params = new URLSearchParams();
    if (nextQ) params.set('q', nextQ);
    if (nextTag) params.set('tag', nextTag);
    router.push('/charities' + (params.toString() ? '?' + params.toString() : ''));
  };

  return (
    <div className="row">
      <input
        style={{ maxWidth: 320 }}
        placeholder="Search charities"
        value={val}
        aria-label="Search charities"
        onChange={(e) => {
          setVal(e.target.value);
          update(e.target.value, tag);
        }}
      />
      <select
        style={{ maxWidth: 200 }}
        aria-label="Filter by cause"
        value={tag}
        onChange={(e) => update(val, e.target.value)}
      >
        <option value="">All causes</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
