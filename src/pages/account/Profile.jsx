import { Home, MapPin, Plus, Trash2, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PILOT_CITIES } from '@shared/constants.js';
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { call, errorMessage } from '@/services/api.js';

const EMPTY = { label: 'Home', name: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '', kind: 'DELIVERY' };

export default function Profile() {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({ displayName: '', phone: '', city: '' });
  const [addresses, setAddresses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({ displayName: profile.displayName || '', phone: profile.phone || '', city: profile.city || '' });
      setAddresses(profile.addresses || []);
    }
  }, [profile]);

  const save = async (patch, msg = 'Saved') => {
    setBusy(true);
    try {
      await call('updateProfile', patch);
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setAddr = (i, k, v) => setAddresses((list) => list.map((a, j) => (i === j ? { ...a, [k]: v } : a)));

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & addresses" icon={UserCircle} />
      <Card className="p-5 sm:p-6">
        <p className="mb-4 font-display font-bold">Personal details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} /></Field>
          <Field label="Email" hint="Used for sign-in"><Input value={user.email || '—'} disabled /></Field>
          <Field label="Mobile number"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" /></Field>
          <Field label="City">
            <Select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
              <option value="">Select city</option>
              {PILOT_CITIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Button className="mt-5" loading={busy} onClick={() => save(form, 'Profile updated')}>Save details</Button>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display font-bold">Saved addresses & service locations</p>
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAddresses((l) => [...l, { ...EMPTY }])}>Add</Button>
        </div>
        <div className="space-y-4">
          {addresses.map((a, i) => (
            <div key={a.id || i} className="rounded-2xl p-4 ring-1 ring-ink-100">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold">{a.kind === 'SERVICE' ? <MapPin className="h-4 w-4" /> : <Home className="h-4 w-4" />} {a.label || 'Address'}</p>
                <button className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" onClick={() => setAddresses((l) => l.filter((_, j) => j !== i))} aria-label="Remove address">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Label"><Input value={a.label} onChange={(e) => setAddr(i, 'label', e.target.value)} /></Field>
                <Field label="Type">
                  <Select value={a.kind} onChange={(e) => setAddr(i, 'kind', e.target.value)}>
                    <option value="DELIVERY">Delivery address</option>
                    <option value="SERVICE">Service location</option>
                  </Select>
                </Field>
                <Field label="Name"><Input value={a.name} onChange={(e) => setAddr(i, 'name', e.target.value)} /></Field>
                <Field label="Address line 1" className="sm:col-span-2"><Input value={a.line1} onChange={(e) => setAddr(i, 'line1', e.target.value)} /></Field>
                <Field label="Phone"><Input value={a.phone} onChange={(e) => setAddr(i, 'phone', e.target.value)} /></Field>
                <Field label="Area / landmark"><Input value={a.line2} onChange={(e) => setAddr(i, 'line2', e.target.value)} /></Field>
                <Field label="City"><Input value={a.city} onChange={(e) => setAddr(i, 'city', e.target.value)} /></Field>
                <Field label="PIN code"><Input value={a.pincode} onChange={(e) => setAddr(i, 'pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" /></Field>
              </div>
            </div>
          ))}
          {!addresses.length && <p className="text-sm text-ink-500">No saved addresses yet.</p>}
        </div>
        <Button className="mt-5" loading={busy} onClick={() => save({ addresses }, 'Addresses saved')}>Save addresses</Button>
      </Card>
    </div>
  );
}
