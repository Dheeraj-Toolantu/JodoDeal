import { Send } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { cx, formatDateTime } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';
import { Button, Input } from './ui.jsx';

export function TicketThread({ ticket, staff }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (status) => {
    setBusy(true);
    try {
      await call('replyTicket', { ticketId: ticket.id, message: msg, status });
      setMsg('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto">
        {ticket.messages.map((m, i) => {
          const mine = staff ? m.from === 'support' : m.from === 'customer';
          return (
            <div key={i} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', mine ? 'rounded-br-md bg-ink-900 text-white' : 'rounded-bl-md bg-ink-100 text-ink-900')}>
                <p className={cx('text-xs font-semibold', mine ? 'text-ink-300' : 'text-ink-500')}>{m.name}</p>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={cx('mt-1 text-[10px]', mine ? 'text-ink-400' : 'text-ink-400')}>{formatDateTime(m.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type your message…" onKeyDown={(e) => e.key === 'Enter' && msg.trim() && send()} />
        <Button icon={Send} loading={busy} disabled={!msg.trim()} onClick={() => send()} aria-label="Send" />
      </div>
      {staff && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="success" disabled={!msg.trim() || busy} onClick={() => send('RESOLVED')}>
            Reply & resolve
          </Button>
        </div>
      )}
    </div>
  );
}
