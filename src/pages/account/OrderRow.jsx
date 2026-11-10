import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FULFILMENT_META } from '@shared/constants.js';
import { CategoryArt, OrderStatusBadge } from '@/components/deal.jsx';
import { formatDate, formatINR } from '@/lib/format.js';

export default function OrderRow({ order, to }) {
  return (
    <Link to={to || `/account/orders/${order.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100 transition hover:shadow-lift">
      <CategoryArt categoryId={order.categoryId} className="h-16 w-16 shrink-0 rounded-xl" iconClass="h-6 w-6" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-xs text-ink-400">{FULFILMENT_META[order.kind]?.record} · {formatDate(order.createdAt)}</span>
        </div>
        <p className="mt-1 truncate font-semibold">{order.offerTitle}</p>
        <p className="truncate text-sm text-ink-500">{[order.optionLabel, order.merchantName].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="text-right">
        <p className="font-display font-bold">{formatINR(order.amountPaid, true)}</p>
        <ChevronRight className="ml-auto mt-1 h-5 w-5 text-ink-300" />
      </div>
    </Link>
  );
}
