import { BadgeCheck, Building2, FileUp, Landmark, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@shared/categories.js';
import { PILOT_CITIES } from '@shared/constants.js';
import Icon from '@/components/Icon.jsx';
import { Button, Card, Checkbox, Field, Input, PageHeader, Select, Textarea } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { cx } from '@/lib/format.js';
import { call, data, errorMessage } from '@/services/api.js';

export default function MerchantRegister() {
  const { isMerchant, isStaff } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({
    businessName: '',
    legalName: '',
    businessType: 'Proprietorship',
    tagline: '',
    description: '',
    categoryIds: [],
    city: 'Pune',
    address: '',
    serviceAreas: '',
    contactEmail: '',
    supportPhone: '',
    gstin: '',
    pan: '',
    bankAccountName: '',
    bankAccountNumber: '',
    ifsc: '',
    documents: [],
    acceptAgreement: false,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  if (isMerchant) return <Navigate to="/merchant" replace />;
  if (isStaff) return <Navigate to="/admin" replace />;

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggleCat = (id) => setF((x) => ({ ...x, categoryIds: x.categoryIds.includes(id) ? x.categoryIds.filter((c) => c !== id) : [...x.categoryIds, id] }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await data.uploadFile(file, 'merchant-docs');
      setF((x) => ({ ...x, documents: [...x.documents, { name: file.name, url, type: 'KYC' }] }));
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('registerMerchant', { ...f, serviceAreas: f.serviceAreas.split(/[\s,]+/).filter(Boolean) });
      toast.success('Registration submitted! Our team will verify your business.');
      navigate('/merchant');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader title="Register your business" subtitle="Verification usually takes 1–2 working days. Only verified providers can publish offers." icon={Store} />
      <form onSubmit={submit} className="space-y-5">
        <Card className="p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 font-display font-bold"><Building2 className="h-5 w-5 text-brand-500" /> Business profile</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business / brand name" required><Input value={f.businessName} onChange={set('businessName')} required /></Field>
            <Field label="Registered legal name"><Input value={f.legalName} onChange={set('legalName')} /></Field>
            <Field label="Business type">
              <Select value={f.businessType} onChange={set('businessType')}>
                {['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Individual professional'].map((x) => <option key={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="City" required>
              <Select value={f.city} onChange={set('city')}>
                {PILOT_CITIES.map((x) => <option key={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline} onChange={set('tagline')} placeholder="e.g. Strength & conditioning gyms in Pune" /></Field>
            <Field label="About your business" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} /></Field>
            <Field label="Address / branch" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} /></Field>
            <Field label="Service PIN codes" hint="Comma separated, e.g. 411045, 411007 (for local services)" className="sm:col-span-2"><Input value={f.serviceAreas} onChange={set('serviceAreas')} /></Field>
            <Field label="Customer support email"><Input type="email" value={f.contactEmail} onChange={set('contactEmail')} /></Field>
            <Field label="Customer support phone"><Input value={f.supportPhone} onChange={set('supportPhone')} /></Field>
          </div>
          <p className="mb-2 mt-5 text-sm font-semibold">Categories <span className="text-brand-600">*</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} onClick={() => toggleCat(c.id)} className={cx('flex items-center gap-2 rounded-xl p-2.5 text-left text-sm font-semibold ring-2 transition', f.categoryIds.includes(c.id) ? 'bg-brand-50 ring-brand-500' : 'ring-ink-100 hover:ring-ink-200')}>
                <Icon name={c.icon} className="h-4 w-4 text-brand-600" /> {c.name}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 font-display font-bold"><Landmark className="h-5 w-5 text-brand-500" /> KYC & settlement</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GSTIN" hint="15 characters"><Input value={f.gstin} onChange={(e) => setF((x) => ({ ...x, gstin: e.target.value.toUpperCase() }))} maxLength={15} /></Field>
            <Field label="PAN"><Input value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} maxLength={10} /></Field>
            <Field label="Bank account holder name"><Input value={f.bankAccountName} onChange={set('bankAccountName')} /></Field>
            <Field label="Bank account number" hint="Only the last 4 digits are stored"><Input value={f.bankAccountNumber} onChange={set('bankAccountNumber')} inputMode="numeric" /></Field>
            <Field label="IFSC"><Input value={f.ifsc} onChange={(e) => setF((x) => ({ ...x, ifsc: e.target.value.toUpperCase() }))} maxLength={11} /></Field>
          </div>
          <p className="mb-2 mt-5 text-sm font-semibold">Supporting documents</p>
          <p className="mb-3 text-xs text-ink-500">GST certificate, shop & establishment licence, trainer certifications, insurance, portfolio — whatever applies to your category.</p>
          <div className="space-y-2">
            {f.documents.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-600" /> {d.name}</span>
                <button type="button" onClick={() => setF((x) => ({ ...x, documents: x.documents.filter((_, j) => j !== i) }))} aria-label="Remove"><Trash2 className="h-4 w-4 text-rose-500" /></button>
              </div>
            ))}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 p-4 text-sm font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-600">
              <FileUp className="h-5 w-5" /> {uploading ? 'Uploading…' : 'Upload document (PDF / image)'}
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={upload} disabled={uploading} />
            </label>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <Checkbox checked={f.acceptAgreement} onChange={(e) => setF((x) => ({ ...x, acceptAgreement: e.target.checked }))} label="I confirm the information is accurate and I accept the JodoDeal merchant agreement, including fulfilment responsibility, customer-protection obligations, and category commission." />
          <Button type="submit" size="lg" className="mt-5" loading={busy} disabled={!f.acceptAgreement || !f.businessName || !f.categoryIds.length}>Submit for verification</Button>
        </Card>
      </form>
    </div>
  );
}
