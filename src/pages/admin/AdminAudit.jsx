import { History, Search } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, Input, PageHeader } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDateTime } from '@/lib/format.js';

export default function AdminAudit() {
  const { data: logs } = useQuery('auditLogs', [], { sort: ['at', 'desc'] });
  const [q, setQ] = useState('');
  const list = logs.filter((l) => `${l.action} ${l.entity} ${l.actorName} ${l.note}`.toLowerCase().includes(q.toLowerCase())).slice(0, 300);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Admin financial actions, provider changes, offer terms and status transitions." icon={History} />
      <Input icon={Search} className="mb-4" placeholder="Filter by action, entity, actor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="divide-y divide-ink-50">
        {list.map((l) => (
          <div key={l.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className="w-36 shrink-0 text-xs text-ink-400">{formatDateTime(l.at)}</span>
            <Badge tone="dark" className="w-fit">{l.action}</Badge>
            <span className="min-w-0 flex-1 truncate">
              <b>{l.actorName}</b> <span className="text-ink-400">({l.actorRole})</span> · {l.entity} <code className="text-xs text-ink-500">{String(l.entityId).slice(-10)}</code> {l.note && `— ${l.note}`}
            </span>
          </div>
        ))}
        {!list.length && <p className="p-6 text-center text-sm text-ink-500">No entries.</p>}
      </Card>
    </div>
  );
}
