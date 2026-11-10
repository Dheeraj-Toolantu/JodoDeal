import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Info,
  Layers,
  MapPin,
  MessageSquareQuote,
  Package,
  PlusCircle,
  ReceiptIndianRupee,
  RefreshCcw,
  ShieldCheck,
  Star,
  Store,
  Truck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { categoryById } from '@shared/categories.js';
import { ACTIVATION_RULES, DEAL_FORMATS, FAILURE_POLICIES, FULFILMENT_META, PRICING_RULES, PROJECT_MILESTONES } from '@shared/constants.js';
import { discountPct, groupProgress, optionAvailability, sortTiers } from '@shared/pricing.js';
import { CategoryArt, Countdown, DealExplainer, GroupProgressCard, GroupStateBadge, Rating, ShareBar, TierLadder, VerifiedBadge } from '@/components/deal.jsx';
import { Badge, Button, Card, EmptyState, PageLoader, ProgressBar, Tabs } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useDoc, useQuery } from '@/hooks/useData.js';
import { cx, formatDate, formatINR, relativeTime } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

function List({ items, icon: IconCmp = CheckCircle2, tone = 'text-emerald-600' }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i} className="flex gap-2.5 text-sm text-ink-700">
          <IconCmp className={cx('mt-0.5 h-4 w-4 shrink-0', tone)} /> {i}
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ icon: IconCmp, label, children }) {
  if (!children) return null;
  return (
    <div className="flex gap-3 rounded-2xl bg-ink-50/70 p-4">
      <IconCmp className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <div className="mt-0.5 text-sm text-ink-800">{children}</div>
      </div>
    </div>
  );
}

function TypeDetails({ offer }) {
  const options = offer.options || [];
  const optionLabel = FULFILMENT_META[offer.fulfilment]?.optionLabel || 'Option';
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-display font-bold">Available {optionLabel.toLowerCase()}s</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const left = optionAvailability(o);
            return (
              <div key={o.id} className="rounded-2xl p-4 ring-1 ring-ink-100">
                <p className="font-semibold">{o.label}</p>
                {o.description && <p className="text-sm text-ink-500">{o.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {o.startDate && <Badge tone="violet" icon={CalendarDays}>Starts {formatDate(o.startDate)}</Badge>}
                  {o.schedule && <Badge tone="blue" icon={Clock}>{o.schedule}</Badge>}
                  {o.durationDays && <Badge tone="slate">{o.durationDays} days validity</Badge>}
                  {o.sessions && <Badge tone="slate">{o.sessions} sessions</Badge>}
                  {o.priceDelta ? <Badge tone="amber">+{formatINR(o.priceDelta)}</Badge> : null}
                  <Badge tone={left > 5 ? 'emerald' : left > 0 ? 'amber' : 'rose'}>{left > 0 ? `${left} left` : 'Sold out'}</Badge>
                </div>
                {o.address && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-ink-500">
                    <MapPin className="h-3.5 w-3.5" /> {o.address}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {offer.fulfilment === 'MEMBERSHIP' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={CalendarDays} label="Activation">{ACTIVATION_RULES[offer.activationRule]}</InfoRow>
          <InfoRow icon={Clock} label="Access hours">{offer.operatingHours}</InfoRow>
          <InfoRow icon={XCircle} label="Blackout dates">{offer.blackoutDates}</InfoRow>
          <InfoRow icon={ShieldCheck} label="Health & safety">{offer.healthSafety}</InfoRow>
          {offer.facilities?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Verified facilities</p>
              <div className="flex flex-wrap gap-2">
                {offer.facilities.map((f) => (
                  <Badge key={f} tone="emerald" icon={BadgeCheck}>{f}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {offer.fulfilment === 'COURSE' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={UserCheck} label="Instructor">{offer.instructor}</InfoRow>
            <InfoRow icon={GraduationCap} label="Platform & language">{[offer.platform, offer.language].filter(Boolean).join(' · ')}</InfoRow>
            <InfoRow icon={Info} label="Prerequisites">{offer.prerequisites}</InfoRow>
            <InfoRow icon={Clock} label="Recorded content & access">{offer.accessDuration}</InfoRow>
            <InfoRow icon={BadgeCheck} label="Certificate">{offer.certificatePolicy}</InfoRow>
            <InfoRow icon={CalendarDays} label="Late joining">{offer.lateJoinPolicy}</InfoRow>
          </div>
          {offer.syllabus?.length > 0 && (
            <div>
              <h3 className="mb-3 font-display font-bold">Syllabus & learning outcomes</h3>
              <ol className="space-y-2">
                {offer.syllabus.map((s, i) => (
                  <li key={s} className="flex gap-3 rounded-xl bg-ink-50/70 p-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {offer.fulfilment === 'PROJECT' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Layers} label="Package scope">{offer.scope}</InfoRow>
            <InfoRow icon={MapPin} label="Service area (PIN codes)">
              {offer.remoteSupported ? 'Remote consultation available across India. ' : ''}
              {(offer.serviceAreas || []).map((p) => (p.length < 6 ? `${p}xx` : p)).join(', ')}
            </InfoRow>
            <InfoRow icon={ShieldCheck} label="Warranty / after-sales">{offer.warranty}</InfoRow>
            <InfoRow icon={ReceiptIndianRupee} label="Visit charges">{offer.visitFee ? formatINR(offer.visitFee) : 'No visit charge'}</InfoRow>
          </div>
          <div>
            <h3 className="mb-3 font-display font-bold">How your project progresses</h3>
            <ol className="relative space-y-3 border-l-2 border-dashed border-ink-200 pl-6">
              {PROJECT_MILESTONES.filter((m) => (offer.projectMilestones || []).includes(m.key)).map((m) => (
                <li key={m.key} className="relative text-sm">
                  <span className="absolute -left-[31px] top-0.5 h-4 w-4 rounded-full bg-white ring-4 ring-amber-200" />
                  {m.label}
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Custom work and materials are quoted separately with an itemised quotation (included work, optional upgrades, materials, taxes). You can accept or decline — no open-ended "starting from" pricing.
            </p>
          </div>
        </>
      )}

      {offer.fulfilment === 'PRODUCT' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={Truck} label="Delivery">{offer.deliveryEstimate} · {offer.deliveryFee ? `${formatINR(offer.deliveryFee)} delivery` : 'Free delivery'}</InfoRow>
          <InfoRow icon={RefreshCcw} label="Returns">{offer.returnWindowDays}-day return for damaged, defective or wrong items</InfoRow>
          <InfoRow icon={Package} label="Fulfilment">Each buyer receives a separate parcel with their own tracking</InfoRow>
        </div>
      )}

      {['APPOINTMENT', 'VOUCHER'].includes(offer.fulfilment) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={CalendarDays} label="Booking">Book your own slots after the group is confirmed. Free rescheduling as per terms.</InfoRow>
          <InfoRow icon={Clock} label="Validity">{offer.voucherValidityDays} days from confirmation</InfoRow>
          <InfoRow icon={Clock} label="Hours">{offer.operatingHours}</InfoRow>
        </div>
      )}
    </div>
  );
}

function Terms({ offer }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
          <p className="flex items-center gap-2 font-bold text-emerald-900">
            <ReceiptIndianRupee className="h-5 w-5" /> Pricing rule: {PRICING_RULES[offer.pricingRule]?.label}
          </p>
          <p className="mt-1 text-sm text-emerald-900/80">{PRICING_RULES[offer.pricingRule]?.description}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <p className="flex items-center gap-2 font-bold text-sky-900">
            <RefreshCcw className="h-5 w-5" /> If the group fails: {FAILURE_POLICIES[offer.failurePolicy]?.label}
          </p>
          <p className="mt-1 text-sm text-sky-900/80">{FAILURE_POLICIES[offer.failurePolicy]?.description}</p>
        </div>
      </div>
      <div className="rounded-2xl p-4 ring-1 ring-ink-100">
        <p className="mb-1 font-bold">Cancellation & refunds</p>
        <p className="text-sm text-ink-600">{offer.cancellationText}</p>
      </div>
      {offer.eligibility && (
        <div className="rounded-2xl p-4 ring-1 ring-ink-100">
          <p className="mb-1 font-bold">Eligibility</p>
          <p className="text-sm text-ink-600">{offer.eligibility}</p>
        </div>
      )}
      <div className="rounded-2xl p-4 ring-1 ring-ink-100 text-sm text-ink-600">
        <p className="mb-1 font-bold text-ink-900">Charges shown before payment</p>
        Price per member as per the tier for your position · GST {offer.gstRate}% · Platform fee {formatINR(offer.platformFee)}
        {offer.deliveryFee ? ` · Delivery ${formatINR(offer.deliveryFee)}` : ''}
        {offer.visitFee ? ` · Visit fee ${formatINR(offer.visitFee)}` : ''}. Max {offer.maxPerCustomer || 1} per customer. Terms version {offer.version}.
      </div>
    </div>
  );
}

function Reviews({ offerId }) {
  const { data: reviews } = useQuery('reviews', [['offerId', '==', offerId]], { sort: ['createdAt', 'desc'] });
  if (!reviews.length) return <EmptyState icon={MessageSquareQuote} title="No reviews yet" description="Only customers with a confirmed purchase can review. Be the first!" />;
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl p-4 ring-1 ring-ink-100">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-sm font-bold">{r.authorName?.[0]}</span>
              {r.authorName}
              {r.verifiedPurchase && <Badge tone="emerald" icon={BadgeCheck}>Verified purchase</Badge>}
            </p>
            <span className="text-xs text-ink-400">{relativeTime(r.createdAt)}</span>
          </div>
          <div className="mt-2 flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={cx('h-4 w-4', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
            ))}
          </div>
          {r.comment && <p className="mt-2 text-sm text-ink-700">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

function Provider({ merchantId }) {
  const { data: m } = useDoc(`merchants/${merchantId}`);
  if (!m) return null;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink-gradient font-display text-2xl font-bold text-white">{m.name[0]}</div>
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
          {m.name} {m.verified && <VerifiedBadge />}
        </p>
        <p className="text-sm text-ink-500">{m.tagline}</p>
        <p className="text-sm text-ink-700">{m.description}</p>
        <div className="flex flex-wrap gap-4 text-sm text-ink-600">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {m.address}
          </span>
          <Rating value={m.rating} count={m.ratingCount} />
        </div>
        <p className="text-xs text-ink-400">
          Seller details: {m.name}, {m.city}. Support: {m.supportPhone || '—'} · {m.contactEmail || '—'}
        </p>
      </div>
    </div>
  );
}

export default function DealDetail() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: offer, loading } = useDoc(`offers/${offerId}`);
  const { data: allGroups } = useQuery('groups', [['offerId', '==', offerId]]);
  const [tab, setTab] = useState('overview');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const key = `jd-viewed-${offerId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    call('trackView', { offerId }).catch(() => {});
  }, [offerId]);

  const groups = useMemo(() => {
    const now = new Date();
    return allGroups
      .filter((g) => ['OPEN', 'TARGET_REACHED', 'CONFIRMED'].includes(g.state) && new Date(g.deadline) > now)
      .sort((a, b) => (a.state === 'OPEN' ? -1 : 1) - (b.state === 'OPEN' ? -1 : 1) || b.paidCount - a.paidCount);
  }, [allGroups]);
  const group = groups.find((g) => g.id === selected) || groups[0];

  if (loading) return <PageLoader />;
  if (!offer || !['APPROVED', 'PAUSED'].includes(offer.status)) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={Package} title="Deal not available" description="This offer is not live right now." action={<Button to="/deals">Explore deals</Button>} />
      </div>
    );
  }
  const cat = categoryById(offer.categoryId);
  const best = sortTiers(offer.tiers).at(-1);

  const startGroup = async () => {
    if (!user) return navigate(`/login?next=/deal/${offerId}`);
    setCreating(true);
    try {
      const { groupId } = await call('createGroup', { offerId });
      toast.success('Your group is ready — invite friends!');
      navigate(`/g/${groupId}?new=1`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container-page py-6 pb-28 lg:pb-10">
      <nav className="mb-4 flex items-center gap-1 text-sm text-ink-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink-900">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/deals?category=${cat?.id}`} className="hover:text-ink-900">{cat?.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="truncate text-ink-900">{offer.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          <CategoryArt categoryId={offer.categoryId} image={offer.images?.[0]} className="aspect-[16/8] rounded-3xl" iconClass="h-20 w-20">
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold shadow">{DEAL_FORMATS[offer.format]?.label}</span>
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">Save up to {discountPct(offer.mrp, best.price)}%</span>
            </div>
          </CategoryArt>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
              <Link to={`/deals?provider=${offer.merchantId}`} className="flex items-center gap-1 font-semibold text-ink-700 hover:text-brand-600">
                <Store className="h-4 w-4" /> {offer.merchantName}
              </Link>
              {offer.merchantVerified && <VerifiedBadge />}
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {offer.city}
              </span>
              <span>·</span>
              <Rating value={offer.rating} count={offer.ratingCount} />
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{offer.title}</h1>
            <p className="mt-2 text-ink-600">{offer.summary}</p>
            {offer.highlights?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {offer.highlights.map((h) => (
                  <Badge key={h} tone="brand">{h}</Badge>
                ))}
              </div>
            )}
            {offer.status === 'PAUSED' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This offer is temporarily paused by the provider. New joins are disabled.</p>}
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview', icon: FileText },
              { value: 'details', label: FULFILMENT_META[offer.fulfilment]?.label, icon: Layers },
              { value: 'terms', label: 'Terms & refunds', icon: ShieldCheck },
              { value: 'provider', label: 'Provider', icon: Building2 },
              { value: 'reviews', label: 'Reviews', icon: Star, count: offer.ratingCount || 0 },
            ]}
          />
          <Card className="p-5 sm:p-6">
            {tab === 'overview' && (
              <div className="space-y-6">
                <p className="leading-relaxed text-ink-700">{offer.description}</p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-3 font-display font-bold">What's included</h3>
                    <List items={offer.inclusions || []} />
                  </div>
                  <div>
                    <h3 className="mb-3 font-display font-bold">Not included</h3>
                    <List items={offer.exclusions || []} icon={XCircle} tone="text-rose-500" />
                  </div>
                </div>
              </div>
            )}
            {tab === 'details' && <TypeDetails offer={offer} />}
            {tab === 'terms' && <Terms offer={offer} />}
            {tab === 'provider' && <Provider merchantId={offer.merchantId} />}
            {tab === 'reviews' && <Reviews offerId={offer.id} />}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-500">{group ? `Price for member #${(group.paidCount || 0) + 1}` : 'Group price from'}</p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-3xl font-extrabold">{formatINR(group ? group.nextJoinPrice : best.price)}</span>
                  <span className="pb-1 text-ink-400 line-through">{formatINR(offer.mrp)}</span>
                </div>
              </div>
              <Badge tone="emerald">-{discountPct(offer.mrp, group ? group.nextJoinPrice : best.price)}%</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-400">+ GST {offer.gstRate}% & fees, shown in full before payment</p>
            <div className="mt-4">
              <DealExplainer offer={offer} group={group} />
            </div>
            {group && (
              <Button size="lg" to={`/checkout/${group.id}`} disabled={offer.status !== 'APPROVED'} className="mt-4 w-full">
                Join this group · {formatINR(group.nextJoinPrice)}
              </Button>
            )}
            <p className="mb-2 mt-5 text-sm font-bold">Price drops as more people join</p>
            <div>
              <TierLadder mrp={offer.mrp} tiers={offer.tiers} count={group?.paidCount || 0} minGroupSize={offer.minGroupSize} />
            </div>
          </Card>

          <Card className="p-5">
            {group ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-display font-bold">
                    <Users className="mr-1.5 inline h-5 w-5 text-brand-500" />
                    {group.hostName === 'JodoDeal' ? 'Featured group' : `${group.hostName}'s group`}
                  </p>
                  <GroupStateBadge state={group.state} />
                </div>
                <GroupProgressCard group={group} offer={offer} />
                <p className="mb-2 mt-5 text-sm font-semibold text-ink-700">Invite friends to unlock it faster</p>
                <div className="grid gap-2">
                  <ShareBar offer={offer} group={group} referralCode={profile?.referralCode} />
                </div>
              </>
            ) : (
              <div className="text-center">
                <Users className="mx-auto h-10 w-10 text-brand-500" />
                <p className="mt-2 font-display font-bold">No open group right now</p>
                <p className="text-sm text-ink-500">Start one and invite your friends to unlock the price.</p>
              </div>
            )}
            <button onClick={startGroup} disabled={creating || offer.status !== 'APPROVED'} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
              <PlusCircle className="h-4 w-4" /> Start your own group
            </button>
          </Card>

          {groups.length > 1 && (
            <Card className="p-5">
              <p className="mb-3 font-display font-bold">Other active groups ({groups.length})</p>
              <div className="space-y-2">
                {groups.map((g) => {
                  const p = groupProgress(g);
                  return (
                    <button key={g.id} onClick={() => setSelected(g.id)} className={cx('w-full rounded-xl p-3 text-left ring-1 transition', g.id === group?.id ? 'bg-brand-50 ring-brand-300' : 'ring-ink-100 hover:bg-ink-50')}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{g.hostName === 'JodoDeal' ? 'Featured group' : `${g.hostName}'s group`}</span>
                        <Countdown deadline={g.deadline} compact />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <ProgressBar value={p.pct} size="sm" tone={p.remaining ? 'brand' : 'emerald'} />
                        <span className="shrink-0 font-semibold">{g.paidCount}/{g.minGroupSize}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-ink-600">
            {[
              [ShieldCheck, 'Verified provider'],
              [RefreshCcw, 'Refund if group fails'],
              [BadgeCheck, 'Your own booking'],
            ].map(([I, l]) => (
              <div key={l} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-ink-100">
                <I className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
                {l}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {group && offer.status === 'APPROVED' && (
        <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-ink-100 bg-white/95 p-3 backdrop-blur md:bottom-0 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold leading-none">{formatINR(group.nextJoinPrice)}</p>
              <p className="truncate text-xs text-ink-500">{groupProgress(group).remaining ? `${groupProgress(group).remaining} more to unlock` : 'Group unlocked'}</p>
            </div>
            <Button to={`/checkout/${group.id}`} className="ml-auto flex-1">
              Join group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
