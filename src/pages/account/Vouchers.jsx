import { Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyState, PageHeader } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDate } from '@/lib/format.js';

const KIND = { MEMBERSHIP_ACTIVATION: 'Membership', APPOINTMENT: 'Appointment package', VOUCHER: 'Voucher' };

export default function Vouchers() {
  const { user } = useAuth();
  const { data: vouchers } = useQuery('vouchers', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  return (
    <div>
      <PageHeader title="Vouchers & passes" subtitle="Show the QR code or tell the provider your code to redeem." icon={Ticket} />
      {vouchers.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {vouchers.map((v) => (
            <Link key={v.id} to={`/account/orders/${v.orderId}`} className="relative flex gap-4 overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-100 transition hover:shadow-lift">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50 ring-1 ring-ink-100" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50 ring-1 ring-ink-100" />
              <div className="rounded-xl bg-white p-1 ring-1 ring-ink-100">
                <QRCodeSVG value={`JODODEAL:${v.code}`} size={92} className={v.status === 'VOID' ? 'opacity-20' : ''} />
              </div>
              <div className="min-w-0 border-l-2 border-dashed border-ink-100 pl-4">
                <Badge tone={v.status === 'ISSUED' ? 'emerald' : v.status === 'VOID' ? 'rose' : 'slate'}>{v.status.replace('_', ' ').toLowerCase()}</Badge>
                <p className="mt-1.5 line-clamp-2 font-semibold">{v.offerTitle}</p>
                <p className="text-xs text-ink-500">{KIND[v.kind]} · {v.optionLabel}</p>
                <p className="mt-2 font-display text-lg font-extrabold tracking-[0.15em]">{v.code}</p>
                <p className="text-xs text-ink-400">
                  Used {v.redemptions?.length || 0}/{v.maxRedemptions} · valid till {formatDate(v.validTo)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Ticket} title="No vouchers yet" description="Membership codes and service vouchers appear here once your group is confirmed." action={<Button to="/deals?category=gym-fitness">Find a gym deal</Button>} />
      )}
    </div>
  );
}
