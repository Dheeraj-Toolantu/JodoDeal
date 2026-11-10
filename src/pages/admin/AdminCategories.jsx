import { LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CATEGORIES } from '@shared/categories.js';
import { FULFILMENT_META } from '@shared/constants.js';
import Icon from '@/components/Icon.jsx';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { call, errorMessage } from '@/services/api.js';

function Row({ c }) {
  const [f, setF] = useState({ commissionPct: c.commissionPct, platformFee: c.platformFee, active: c.active, pilot: c.pilot });
  const [busy, setBusy] = useState(false);
  const dirty = f.commissionPct !== c.commissionPct || f.platformFee !== c.platformFee || f.active !== c.active || f.pilot !== c.pilot;
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.gradient} text-white`}><Icon name={c.icon} className="h-4 w-4" /></span>
          <div><p className="font-semibold">{c.name}</p><p className="text-xs text-ink-400">{FULFILMENT_META[c.fulfilment]?.label}</p></div>
        </div>
      </td>
      <td className="px-4 py-3"><Input className="!w-20 !py-1.5" inputMode="numeric" value={f.commissionPct} onChange={(e) => setF((x) => ({ ...x, commissionPct: Number(e.target.value.replace(/[^\d.]/g, '')) }))} /></td>
      <td className="px-4 py-3"><Input className="!w-20 !py-1.5" inputMode="numeric" value={f.platformFee} onChange={(e) => setF((x) => ({ ...x, platformFee: Number(e.target.value.replace(/\D/g, '')) }))} /></td>
      <td className="px-4 py-3">{c.gstRate}%</td>
      <td className="px-4 py-3"><input type="checkbox" checked={f.pilot} onChange={(e) => setF((x) => ({ ...x, pilot: e.target.checked }))} className="h-4 w-4 rounded text-brand-600" aria-label="Pilot" /></td>
      <td className="px-4 py-3"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} className="h-4 w-4 rounded text-brand-600" aria-label="Active" /></td>
      <td className="px-4 py-3 text-right">
        <Button size="sm" disabled={!dirty} loading={busy} onClick={async () => {
          setBusy(true);
          try {
            await call('updateCategory', { categoryId: c.id, patch: f });
            toast.success(`${c.name} updated`);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}>Save</Button>
      </td>
    </tr>
  );
}

export default function AdminCategories() {
  const { data } = useQuery('categories', []);
  const cats = CATEGORIES.map((c) => ({ ...c, ...(data.find((d) => d.id === c.id) || {}) }));
  return (
    <div>
      <PageHeader title="Categories, commissions & fees" subtitle="Commercial rates are tested per category — never one flat assumption." icon={LayoutGrid} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>{['Category', 'Commission %', 'Platform fee ₹', 'GST', 'Pilot', 'Active', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {cats.map((c) => <Row key={`${c.id}-${c.updatedAt || ''}`} c={c} />)}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-ink-500"><Badge tone="brand">Pilot</Badge> categories are highlighted for the first launch city.</p>
    </div>
  );
}
