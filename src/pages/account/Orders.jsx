import { Package } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, PageHeader, Skeleton, Tabs } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import OrderRow from './OrderRow.jsx';

const FILTERS = {
  all: () => true,
  waiting: (o) => o.status === 'AWAITING_GROUP',
  active: (o) => ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'ACTIVE', 'CANCELLATION_REQUESTED', 'RETURN_REQUESTED'].includes(o.status),
  done: (o) => ['DELIVERED', 'COMPLETED'].includes(o.status),
  closed: (o) => ['CANCELLED', 'REFUNDED'].includes(o.status),
};

export default function Orders() {
  const { user } = useAuth();
  const { data: orders, loading } = useQuery('orders', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  const [tab, setTab] = useState('all');
  const list = orders.filter(FILTERS[tab]);
  const count = (k) => orders.filter(FILTERS[k]).length;
  return (
    <div>
      <PageHeader title="Orders & bookings" subtitle="Every purchase is your own record — separate from other group members." icon={Package} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: count('all') },
          { value: 'waiting', label: 'Waiting for group', count: count('waiting') },
          { value: 'active', label: 'Active', count: count('active') },
          { value: 'done', label: 'Completed', count: count('done') },
          { value: 'closed', label: 'Cancelled / refunded', count: count('closed') },
        ]}
      />
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : list.length ? (
        <div className="space-y-3">
          {list.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="Nothing here yet" action={<Button to="/deals">Explore deals</Button>} />
      )}
    </div>
  );
}
