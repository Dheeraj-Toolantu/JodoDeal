import { ArrowRight, CheckCircle2, Gift, History, PartyPopper, ShieldCheck, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { GROUP_STATE_META, PRICING_RULES, FAILURE_POLICIES } from '@shared/constants.js';
import { discountPct } from '@shared/pricing.js';
import { CategoryArt, GroupProgressCard, GroupStateBadge, ShareBar, TierLadder, VerifiedBadge } from '@/components/deal.jsx';
import { Button, Card, EmptyState, PageLoader } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDoc } from '@/hooks/useData.js';
import { formatDateTime, formatINR } from '@/lib/format.js';

export default function GroupPage() {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const { data: group, loading } = useDoc(`groups/${groupId}`);
  const { data: offer } = useDoc(group ? `offers/${group.offerId}` : null);
  const { data: membership } = useDoc(user && group ? `groups/${groupId}/members/${user.uid}` : null);

  useEffect(() => {
    const ref = params.get('ref');
    if (ref) {
      try {
        sessionStorage.setItem(`jd-ref-${groupId}`, ref);
      } catch {
        /* ignore */
      }
    }
  }, [params, groupId]);

  if (loading) return <PageLoader />;
  if (!group) return <div className="container-page py-16"><EmptyState icon={Users} title="Group not found" action={<Button to="/deals">Explore deals</Button>} /></div>;

  const joinable = ['OPEN', 'TARGET_REACHED', 'CONFIRMED'].includes(group.state) && new Date(group.deadline) > new Date() && offer?.status === 'APPROVED';
  const isMember = membership?.status === 'ACTIVE';
  const isNew = params.get('new') === '1';

  return (
    <div className="container-page max-w-5xl py-8">
      {isNew && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 animate-fade-up">
          <PartyPopper className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-emerald-900">Your group is live!</p>
            <p className="text-sm text-emerald-800">Join it yourself first, then share the link on WhatsApp. Only paid members count towards the target.</p>
          </div>
        </div>
      )}
      {params.get('ref') && !isMember && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <Gift className="h-6 w-6 shrink-0 text-brand-600" />
          <p className="text-sm text-brand-900">
            <b>You've been invited!</b> Join this group to help everyone unlock a better price.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CategoryArt categoryId={group.categoryId} image={offer?.images?.[0]} className="h-48" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <GroupStateBadge state={group.state} />
                <span className="text-sm text-ink-500">{group.hostName === 'JodoDeal' ? 'Featured group' : `Started by ${group.hostName}`}</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-extrabold">{group.offerTitle}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
                {group.merchantName} {offer?.merchantVerified && <VerifiedBadge />}
              </p>
              <p className="mt-3 text-sm text-ink-600">{GROUP_STATE_META[group.state]?.meaning}</p>
              <div className="mt-6">
                <GroupProgressCard group={group} offer={offer} />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                {isMember ? (
                  <Button variant="success" size="lg" icon={CheckCircle2} to={`/account/orders/${membership.orderId}`} className="flex-1">
                    You're in — view your booking
                  </Button>
                ) : joinable ? (
                  <Button size="lg" to={`/checkout/${group.id}`} className="flex-1">
                    Join for {formatINR(group.nextJoinPrice)} <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" to={`/deal/${group.offerId}`} className="flex-1">
                    This group is closed — see the deal
                  </Button>
                )}
                <Button variant="secondary" size="lg" to={`/deal/${group.offerId}`}>
                  Full deal details
                </Button>
              </div>
            </div>
          </Card>

          {offer && joinable && (
            <Card className="p-6">
              <p className="mb-1 font-display text-lg font-bold">Invite friends to unlock faster</p>
              <p className="mb-4 text-sm text-ink-500">Share with the people who'd actually want this — your society, office or college group.</p>
              <ShareBar offer={offer} group={group} referralCode={profile?.referralCode} />
              <p className="mt-3 text-xs text-ink-400">{group.shares || 0} shares so far · Members never see each other's phone numbers or addresses.</p>
            </Card>
          )}

          <Card className="p-6">
            <p className="mb-4 flex items-center gap-2 font-display font-bold">
              <History className="h-5 w-5 text-ink-400" /> Group timeline
            </p>
            <ol className="relative space-y-4 border-l-2 border-ink-100 pl-5">
              {(group.stateHistory || []).map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-brand-100" />
                  <p className="text-sm font-semibold">{GROUP_STATE_META[h.status]?.label || h.status}</p>
                  <p className="text-sm text-ink-500">{h.note}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="mb-3 font-display font-bold">Price tiers</p>
            <TierLadder mrp={group.mrp} tiers={group.tiers} count={group.paidCount} minGroupSize={group.minGroupSize} />
            <p className="mt-3 text-xs text-ink-500">Current group price saves {discountPct(group.mrp, group.achievedPrice)}% vs standard.</p>
          </Card>
          <Card className="space-y-3 p-5 text-sm">
            <p className="flex items-center gap-2 font-display font-bold">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Group rules
            </p>
            <p>
              <b>Pricing:</b> {PRICING_RULES[group.pricingRule]?.description}
            </p>
            <p>
              <b>If the target is missed:</b> {FAILURE_POLICIES[group.failurePolicy]?.description}
            </p>
            <p>
              <b>Deadline:</b> {formatDateTime(group.deadline)}
            </p>
            {group.maxMembers && (
              <p>
                <b>Maximum members:</b> {group.maxMembers}
              </p>
            )}
            <Link to="/how-it-works" className="inline-block font-semibold text-brand-600 hover:underline">
              How group buying works →
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
