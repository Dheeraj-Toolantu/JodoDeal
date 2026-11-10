import { Package, PackageCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { SHIPMENT_EVENTS } from '@shared/constants.js';
import { OrderStatusBadge } from '@/components/deal.jsx';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs } from '@/components/ui.jsx';
import { formatDateTime, formatINR } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

export default function Orders() {
  const { orders } = useMerchantData();
  const products = orders.filter((o) => o.kind === 'PRODUCT');
  const [tab, setTab] = useState('todo');
  const [ship, setShip] = useState(null);
  const [form, setForm] = useState({ carrier: 'Delhivery', awb: '' });
  const [event, setEvent] = useState(null);
  const [busy, setBusy] = useState(false);

  const filters = {
    todo: (o) => ['CONFIRMED', 'PROCESSING'].includes(o.status),
    shipped: (o) => o.status === 'SHIPPED',
    waiting: (o) => o.status === 'AWAITING_GROUP',
    done: (o) => ['DELIVERED', 'COMPLETED', 'RETURN_REQUESTED', 'REFUNDED', 'CANCELLED'].includes(o.status),
  };
  const list = products.filter(filters[tab]);

  const act = async (payload, msg) => {
    setBusy(true);
    try {
      await call('fulfilOrder', payload);
      toast.success(msg);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Consolidated demand per offer/variant for confirmed orders (BRD §7.3)
  const demand = products
    .filter((o) => ['CONFIRMED', 'PROCESSING'].includes(o.status))
    .reduce((m, o) => {
      const k = `${o.offerTitle} — ${o.optionLabel || 'Standard'}`;
      m[k] = (m[k] || 0) + o.quantity;
      return m;
    }, {});

  return (
    <div>
      <PageHeader title="Product orders" subtitle="Each customer has an individual order, parcel and tracking record." icon={Package} />
      {Object.keys(demand).length > 0 && (
        <Card className="mb-5 p-5">
          <p className="mb-3 font-display font-bold">Consolidated demand to pack</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(demand).map(([k, n]) => (
              <span key={k} className="rounded-xl bg-ink-50 px-3 py-2 text-sm"><b>{n}×</b> {k}</span>
            ))}
          </div>
        </Card>
      )}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todo', label: 'To ship', count: products.filter(filters.todo).length },
          { value: 'shipped', label: 'In transit', count: products.filter(filters.shipped).length },
          { value: 'waiting', label: 'Awaiting group', count: products.filter(filters.waiting).length },
          { value: 'done', label: 'Closed', count: products.filter(filters.done).length },
        ]}
      />
      {list.length ? (
        <div className="space-y-3">
          {list.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <span className="text-xs text-ink-400">#{o.id.slice(-8).toUpperCase()} · {formatDateTime(o.createdAt)}</span>
                </div>
                <p className="mt-1 font-semibold">{o.offerTitle} · {o.optionLabel} × {o.quantity}</p>
                {o.fulfilmentDetails?.address && (
                  <p className="text-sm text-ink-500">Ship to: {o.fulfilmentDetails.address.name}, {o.fulfilmentDetails.address.line1}, {o.fulfilmentDetails.address.city} {o.fulfilmentDetails.address.pincode} · {o.fulfilmentDetails.address.phone}</p>
                )}
              </div>
              <p className="font-display font-bold">{formatINR(o.amountPaid, true)}</p>
              <div className="flex gap-2">
                {o.status === 'CONFIRMED' && <Button size="sm" variant="secondary" loading={busy} onClick={() => act({ orderId: o.id, action: 'PROCESS' }, 'Marked as packing')}>Start packing</Button>}
                {['CONFIRMED', 'PROCESSING'].includes(o.status) && <Button size="sm" icon={Truck} onClick={() => setShip(o)}>Ship</Button>}
                {o.status === 'SHIPPED' && <Button size="sm" variant="secondary" icon={PackageCheck} onClick={() => setEvent({ order: o, value: 'DELIVERED' })}>Tracking update</Button>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="Nothing here" description="Orders appear once groups are confirmed." />
      )}

      <Modal
        open={!!ship}
        onClose={() => setShip(null)}
        title="Create shipment"
        footer={
          <Button loading={busy} disabled={!form.awb} onClick={async () => (await act({ orderId: ship.id, action: 'SHIP', ...form }, 'Shipment created')) && setShip(null)}>
            Mark shipped
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Courier">
            <Select value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}>
              {['Delhivery', 'Blue Dart', 'Ekart', 'XpressBees', 'Shadowfax', 'India Post'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="AWB / tracking number" required><Input value={form.awb} onChange={(e) => setForm((f) => ({ ...f, awb: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!event}
        onClose={() => setEvent(null)}
        title="Add tracking event"
        footer={<Button loading={busy} onClick={async () => (await act({ orderId: event.order.id, action: 'EVENT', event: event.value }, 'Tracking updated')) && setEvent(null)}>Save</Button>}
      >
        {event && (
          <Field label="Event">
            <Select value={event.value} onChange={(e) => setEvent((x) => ({ ...x, value: e.target.value }))}>
              {SHIPMENT_EVENTS.filter((e) => e !== 'LABEL_CREATED').map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ').toLowerCase()}</option>)}
            </Select>
          </Field>
        )}
      </Modal>
    </div>
  );
}
