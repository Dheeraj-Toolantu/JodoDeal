import { Edit3, Eye, Megaphone, Pause, Play, Plus, Send, Share2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { categoryById } from '@shared/categories.js';
import { sortTiers } from '@shared/pricing.js';
import { CategoryArt } from '@/components/deal.jsx';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui.jsx';
import { formatDate, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

const OFFER_TONE = { DRAFT: 'slate', PENDING_APPROVAL: 'amber', CHANGES_REQUESTED: 'rose', APPROVED: 'emerald', REJECTED: 'rose', PAUSED: 'slate' };
const OFFER_LABEL = { DRAFT: 'Draft', PENDING_APPROVAL: 'Pending approval', CHANGES_REQUESTED: 'Changes requested', APPROVED: 'Live', REJECTED: 'Rejected', PAUSED: 'Paused' };

export default function Offers() {
  const { offers, groups } = useMerchantData();
  const act = async (name, payload, msg) => {
    try {
      await call(name, payload);
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div>
      <PageHeader title="Offers & campaigns" subtitle="Create offers, set tiers and capacity, and submit for JodoDeal approval." icon={Megaphone} actions={<Button icon={Plus} to="/merchant/offers/new">New offer</Button>} />
      {offers.length ? (
        <div className="space-y-4">
          {offers.map((o) => {
            const og = groups.filter((g) => g.offerId === o.id);
            const best = sortTiers(o.tiers).at(-1);
            return (
              <Card key={o.id} className="overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  <CategoryArt categoryId={o.categoryId} image={o.images?.[0]} className="h-28 w-full shrink-0 rounded-xl sm:w-40" iconClass="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={OFFER_TONE[o.status]}>{OFFER_LABEL[o.status]}</Badge>
                      <span className="text-xs text-ink-400">{categoryById(o.categoryId)?.name} · v{o.version} · updated {formatDate(o.updatedAt)}</span>
                    </div>
                    <p className="mt-1 font-display text-lg font-bold">{o.title}</p>
                    <p className="text-sm text-ink-500">
                      {formatINR(o.mrp)} → {formatINR(best?.price)} at {best?.minMembers}+ · min group {o.minGroupSize} · capacity {o.used || 0}/{o.capacity}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-ink-600">
                      <span><Eye className="mr-1 inline h-3.5 w-3.5" />{o.stats?.views || 0} views</span>
                      <span><Share2 className="mr-1 inline h-3.5 w-3.5" />{o.stats?.shares || 0} shares</span>
                      <span><Users className="mr-1 inline h-3.5 w-3.5" />{o.stats?.joins || 0} joins · {og.length} groups</span>
                    </div>
                    {o.moderationNote && ['CHANGES_REQUESTED', 'REJECTED', 'PAUSED'].includes(o.status) && (
                      <p className="mt-2 rounded-xl bg-rose-50 p-2.5 text-sm text-rose-700"><b>Moderation feedback:</b> {o.moderationNote}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:flex-col">
                    <Button size="sm" variant="secondary" icon={Edit3} to={`/merchant/offers/${o.id}/edit`}>Edit</Button>
                    {['DRAFT', 'CHANGES_REQUESTED', 'REJECTED'].includes(o.status) && (
                      <Button size="sm" icon={Send} onClick={() => act('submitOffer', { offerId: o.id }, 'Submitted for approval')}>Submit</Button>
                    )}
                    {o.status === 'APPROVED' && (
                      <>
                        <Button size="sm" variant="ghost" icon={Pause} onClick={() => act('setOfferPaused', { offerId: o.id, paused: true }, 'Offer paused')}>Pause</Button>
                        <Link to={`/deal/${o.id}`} className="text-sm font-semibold text-brand-600 hover:underline">View live</Link>
                      </>
                    )}
                    {o.status === 'PAUSED' && <Button size="sm" variant="ghost" icon={Play} onClick={() => act('setOfferPaused', { offerId: o.id, paused: false }, 'Offer resumed')}>Resume</Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="No offers yet" description="Create your first group offer with clear tiers, capacity and terms." action={<Button icon={Plus} to="/merchant/offers/new">Create offer</Button>} />
      )}
    </div>
  );
}
