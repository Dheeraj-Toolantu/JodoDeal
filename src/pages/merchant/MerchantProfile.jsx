import { BadgeCheck, FileText, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, Field, Input, PageHeader, PageLoader, Textarea } from '@/components/ui.jsx';
import { useDoc } from '@/hooks/useData.js';
import { call, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

export default function MerchantProfile() {
  const { mid, merchant } = useMerchantData();
  const { data: priv } = useDoc(mid ? `merchantPrivate/${mid}` : null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (merchant && !f) setF({ tagline: merchant.tagline, description: merchant.description, address: merchant.address, supportPhone: merchant.supportPhone, contactEmail: merchant.contactEmail, serviceAreas: (merchant.serviceAreas || []).join(', ') });
  }, [merchant, f]);
  if (!merchant || !f) return <PageLoader />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      await call('updateMerchantProfile', { ...f, serviceAreas: f.serviceAreas.split(/[\s,]+/).filter(Boolean) });
      toast.success('Profile updated');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Business profile" icon={Settings} />
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="font-display text-xl font-bold">{merchant.name}</p>
          <Badge tone={merchant.status === 'VERIFIED' ? 'emerald' : 'amber'} icon={merchant.status === 'VERIFIED' ? BadgeCheck : undefined}>{merchant.status.replace('_', ' ').toLowerCase()}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline} onChange={set('tagline')} /></Field>
          <Field label="About" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
          <Field label="Support phone"><Input value={f.supportPhone} onChange={set('supportPhone')} /></Field>
          <Field label="Support email"><Input value={f.contactEmail} onChange={set('contactEmail')} /></Field>
          <Field label="Service PIN codes" className="sm:col-span-2"><Input value={f.serviceAreas} onChange={set('serviceAreas')} /></Field>
        </div>
        <Button className="mt-5" loading={busy} onClick={save}>Save profile</Button>
      </Card>
      {priv && (
        <Card className="p-5 sm:p-6">
          <p className="mb-3 font-display font-bold">Verification & settlement (private)</p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-ink-500">Legal name:</span> {priv.legalName}</p>
            <p><span className="text-ink-500">GSTIN:</span> {priv.gstin || '—'}</p>
            <p><span className="text-ink-500">PAN:</span> {priv.pan ? `${priv.pan.slice(0, 2)}•••••${priv.pan.slice(-3)}` : '—'}</p>
            <p><span className="text-ink-500">Bank:</span> {priv.bank?.accountName} · ••••{priv.bank?.accountLast4} · {priv.bank?.ifsc}</p>
          </div>
          <p className="mb-2 mt-4 text-sm font-semibold">Documents</p>
          <div className="flex flex-wrap gap-2">
            {(priv.documents || []).map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-50 px-3 py-2 text-sm"><FileText className="h-4 w-4 text-ink-400" /> {d.name}</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">To change KYC or bank details, contact partner support — changes require re-verification.</p>
        </Card>
      )}
    </div>
  );
}
