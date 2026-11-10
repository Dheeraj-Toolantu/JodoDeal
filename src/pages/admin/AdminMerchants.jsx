import { BadgeCheck, FileText } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { categoryById } from '@shared/categories.js';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Tabs, Textarea } from '@/components/ui.jsx';
import { useDoc, useQuery } from '@/hooks/useData.js';
import { formatDate } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

const TONE = { PENDING_VERIFICATION: 'amber', VERIFIED: 'emerald', REJECTED: 'rose', SUSPENDED: 'rose' };

function Review({ merchant, onClose }) {
  const { data: priv } = useDoc(`merchantPrivate/${merchant.id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (decision) => {
    setBusy(true);
    try {
      await call('reviewMerchant', { merchantId: merchant.id, decision, note });
      toast.success(`Merchant ${decision.toLowerCase()}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={merchant.name}
      size="lg"
      footer={
        <>
          {merchant.status === 'PENDING_VERIFICATION' && <Button variant="secondary" loading={busy} onClick={() => decide('REJECT')}>Reject</Button>}
          {merchant.status === 'VERIFIED' && <Button variant="danger" loading={busy} onClick={() => decide('SUSPEND')}>Suspend</Button>}
          {merchant.status === 'SUSPENDED' && <Button variant="success" loading={busy} onClick={() => decide('REINSTATE')}>Reinstate</Button>}
          {['PENDING_VERIFICATION', 'REJECTED'].includes(merchant.status) && <Button variant="success" loading={busy} onClick={() => decide('VERIFY')}>Verify business</Button>}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-ink-600">{merchant.description}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <p><span className="text-ink-500">City:</span> {merchant.city}</p>
          <p><span className="text-ink-500">Type:</span> {merchant.businessType}</p>
          <p><span className="text-ink-500">Address:</span> {merchant.address}</p>
          <p><span className="text-ink-500">Categories:</span> {merchant.categoryIds.map((c) => categoryById(c)?.name).join(', ')}</p>
          <p><span className="text-ink-500">Support:</span> {merchant.supportPhone} · {merchant.contactEmail}</p>
          <p><span className="text-ink-500">Service PINs:</span> {(merchant.serviceAreas || []).join(', ') || '—'}</p>
        </div>
        {priv && (
          <div className="rounded-2xl bg-ink-50 p-4">
            <p className="mb-2 font-bold">KYC</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p>Legal name: {priv.legalName}</p>
              <p>GSTIN: {priv.gstin || '—'}</p>
              <p>PAN: {priv.pan || '—'}</p>
              <p>Bank: {priv.bank?.accountName} ••••{priv.bank?.accountLast4} ({priv.bank?.ifsc})</p>
            </div>
            <p className="mb-1 mt-3 font-semibold">Documents</p>
            <div className="flex flex-wrap gap-2">
              {(priv.documents || []).map((d, i) =>
                d.url ? (
                  <a key={i} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-600 ring-1 ring-ink-100"><FileText className="h-3.5 w-3.5" />{d.name}</a>
                ) : (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-ink-100"><FileText className="h-3.5 w-3.5" />{d.name}</span>
                ),
              )}
            </div>
          </div>
        )}
        <Field label="Note (required to reject or suspend)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function AdminMerchants() {
  const { data: merchants } = useQuery('merchants', [], { sort: ['createdAt', 'desc'] });
  const [tab, setTab] = useState('PENDING_VERIFICATION');
  const [active, setActive] = useState(null);
  const list = merchants.filter((m) => tab === 'ALL' || m.status === tab);
  return (
    <div>
      <PageHeader title="Merchants & providers" subtitle="Verify businesses before they can publish deals." icon={BadgeCheck} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={['PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'REJECTED', 'ALL'].map((s) => ({ value: s, label: s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase(), count: s === 'ALL' ? merchants.length : merchants.filter((m) => m.status === s).length }))} />
      {list.length ? (
        <div className="space-y-3">
          {list.map((m) => (
            <Card key={m.id} className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-gradient font-display font-bold text-white">{m.name[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.name} <Badge tone={TONE[m.status]} className="ml-1">{m.status.replace('_', ' ').toLowerCase()}</Badge></p>
                <p className="truncate text-sm text-ink-500">{m.city} · {m.categoryIds.map((c) => categoryById(c)?.name).join(', ')} · registered {formatDate(m.createdAt)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setActive(m)}>Review</Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={BadgeCheck} title="Nothing in this queue" />
      )}
      {active && <Review merchant={active} onClose={() => setActive(null)} />}
    </div>
  );
}
