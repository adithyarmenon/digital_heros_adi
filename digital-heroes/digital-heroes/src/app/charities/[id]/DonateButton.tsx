'use client';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { createClient } from '@/lib/supabase/client';

export default function DonateButton({ charityId, charityName }: { charityId: string; charityName: string }) {
  const { userId, profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(500);
  const [busy, setBusy] = useState(false);

  if (!userId || profile?.role !== 'user') return null;

  const submit = async () => {
    if (!(amt > 0)) return toast('Enter an amount above zero.', true);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from('donations').insert({
      user_id: userId,
      charity_id: charityId,
      amount: amt,
    });
    setBusy(false);
    if (error) return toast(error.message, true);
    setOpen(false);
    toast('Thank you. Donation recorded.');
  };

  return (
    <>
      <button className="ghost" onClick={() => setOpen(true)}>
        Make a one-off donation
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3>One-off donation to {charityName}</h3>
          <p className="mute">Separate from your subscription and not tied to the draw.</p>
          <label>Amount (₹)</label>
          <input type="number" min={1} value={amt} onChange={(e) => setAmt(Number(e.target.value))} />
          <div className="row" style={{ marginTop: 14 }}>
            <button onClick={submit} disabled={busy}>
              {busy ? 'Donating…' : 'Donate'}
            </button>
            <button className="ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
