import { ExternalLink, Megaphone } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { categoryById } from '@shared/categories.js';
import { FAILURE_POLICIES, PRICING_RULES } from '@shared/constants.js';
import { validateOffer } from '@shared/operations.js';
import { TierLadder } from '@/components/deal.jsx';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Tabs, Textarea } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDate } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

const TONE = { DRAFT: 'slate', PENDING_APPROVAL: 'amber', CHANGES_REQUESTED: 'rose', APPROVED: 'emerald', REJECTED: 'rose', PAUSED: 'slate' };

function Review({ offer, onClose }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const issues = validateOffer(offer);
  const decide = async (decision) => {
    setBusy(true);
    try {
      await call('reviewOffer', { offerId: offer.id, decision, note });
      toast.success(decision === 'APPROVE' ? 'Offer approved — first group opened' : 'Feedback sent to merchant');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const L = ({ t, v }) => (v ? <p><span className="text-ink-500">{t}:</span> {Array.isArray(v) ? v.join(' · ') : v}</p> : null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Review offer"
      size="xl"
      footer={
        offer.status === 'PENDING_APPROVAL' ? (
          <>
            <Button variant="secondary" loading={busy} onClick={() => decide('REJECT')}>Reject</Button>
            <Button variant="secondary" loading={busy} onClick={() => decide('REQUEST_CHANGES')}>Request changes</Button>
            <Button variant="success" loading={busy} disabled={issues.length > 0} onClick={() => decide('APPROVE')}>Approve & publish</Button>
          </>
        ) : offer.status === 'APPROVED' ? (
          <Button variant="secondary" loading={busy} onClick={() => call('setOfferPaused', { offerId: offer.id, paused: true }).then(() => { toast.success('Paused'); onClose(); }).catch((e) => toast.error(errorMessage(e)))}>Pause offer</Button>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-2 text-sm">
          <p className="font-display text-xl font-bold">{offer.title}</p>
          <p className="text-ink-600">{offer.summary}</p>
          <p className="text-ink-700">{offer.description}</p>
          <L t="Merchant" v={offer.merchantName} />
          <L t="Category" v={categoryById(offer.categoryId)?.name} />
          <L t="Pricing rule" v={PRICING_RULES[offer.pricingRule]?.label} />
          <L t="Failure policy" v={FAILURE_POLICIES[offer.failurePolicy]?.label} />
          <L t="Min / max group" v={`${offer.minGroupSize} / ${offer.maxGroupSize || '—'} · capacity ${offer.capacity} · ${offer.groupDurationHours}h`} />
          <L t="Options" v={offer.options.map((o) => `${o.label} (${o.capacity})`)} />
          <L t="Inclusions" v={offer.inclusions} />
          <L t="Exclusions" v={offer.exclusions} />
          <L t="Cancellation" v={offer.cancellationText} />
          <L t="Scope" v={offer.scope} />
          <L t="Instructor" v={offer.instructor} />
          <L t="Facilities" v={offer.facilities} />
          {issues.length > 0 && (
            <div className="rounded-xl bg-rose-50 p-3 text-rose-800">
              <p className="font-bold">Automatic checks failed</p>
              <ul className="list-disc pl-5">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          )}
          <Field label="Moderation note" hint="Required for reject / request changes" className="pt-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div>
          <TierLadder mrp={offer.mrp} tiers={offer.tiers} count={0} minGroupSize={offer.minGroupSize} />
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Check: genuine discount vs standard price, no misleading scarcity, provider verified, clear inclusions/exclusions and terms.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminOffers() {
  const { data: offers } = useQuery('offers', [], { sort: ['updatedAt', 'desc'] });
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [active, setActive] = useState(null);
  const list = offers.filter((o) => tab === 'ALL' || o.status === tab);
  return (
    <div>
      <PageHeader title="Offer moderation" subtitle="Approve offers only when pricing, scope and terms are clear and truthful." icon={Megaphone} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={['PENDING_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED', 'PAUSED', 'DRAFT', 'ALL'].map((s) => ({ value: s, label: s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase(), count: s === 'ALL' ? offers.length : offers.filter((o) => o.status === s).length }))} />
      {list.length ? (
        <div className="space-y-3">
          {list.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><Badge tone={TONE[o.status]}>{o.status.replace('_', ' ').toLowerCase()}</Badge><span className="text-xs text-ink-400">v{o.version} · {formatDate(o.updatedAt)}</span></div>
                <p className="mt-1 font-semibold">{o.title}</p>
                <p className="text-sm text-ink-500">{o.merchantName} · {categoryById(o.categoryId)?.name} · {o.stats?.joins || 0} joins</p>
              </div>
              <div className="flex gap-2">
                {o.status === 'APPROVED' && <Link to={`/deal/${o.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Live <ExternalLink className="h-3.5 w-3.5" /></Link>}
                <Button size="sm" variant="secondary" onClick={() => setActive(o)}>Review</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="Queue is empty" />
      )}
      {active && <Review offer={active} onClose={() => setActive(null)} />}
    </div>
  );
}
