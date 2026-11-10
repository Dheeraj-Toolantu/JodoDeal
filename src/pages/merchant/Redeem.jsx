import { Camera, CheckCircle2, QrCode, ScanLine, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDateTime } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';
import { useMerchantData } from './useMerchant.js';

function Scanner({ onCode, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let stream;
    let timer;
    let active = true;
    (async () => {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (!active) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const raw = codes[0]?.rawValue;
          if (raw) onCode(raw.replace(/^JODODEAL:/, ''));
          else timer = setTimeout(tick, 300);
        };
        tick();
      } catch {
        setError('Camera scanning is not available on this device. Enter the code manually.');
      }
    })();
    return () => {
      active = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-ink-950">
      {error ? <p className="p-6 text-center text-sm text-ink-200">{error}</p> : <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />}
      <button onClick={onClose} className="w-full bg-ink-900 py-2 text-sm font-semibold text-white">Close camera</button>
    </div>
  );
}

export default function Redeem() {
  const { mid } = useMerchantData();
  const { data: vouchers } = useQuery('vouchers', [['merchantId', '==', mid]], {}, !!mid);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const redeem = async (value = code) => {
    if (!value.trim()) return;
    setBusy(true);
    setScanning(false);
    try {
      const r = await call('redeemVoucher', { code: value });
      setResult({ ok: true, voucher: r.voucher });
      setCode('');
    } catch (e) {
      setResult({ ok: false, message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const recent = vouchers.flatMap((v) => (v.redemptions || []).map((r) => ({ ...r, v }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Redeem codes" subtitle="Validate membership activations, appointment sessions and vouchers. Duplicate use is blocked." icon={QrCode} />
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            redeem();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input icon={ScanLine} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter customer code e.g. 7KD3MX2PQA" className="font-display text-lg tracking-widest" aria-label="Voucher code" />
          <Button type="submit" size="lg" loading={busy} className="sm:!h-12">Validate & redeem</Button>
          {canScan && <Button type="button" variant="secondary" size="lg" icon={Camera} className="sm:!h-12" onClick={() => setScanning((s) => !s)}>Scan QR</Button>}
        </form>
        {scanning && <Scanner onCode={redeem} onClose={() => setScanning(false)} />}
        {result && (
          <div className={`mt-5 flex items-start gap-3 rounded-2xl p-4 ring-1 animate-pop ${result.ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
            {result.ok ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" /> : <XCircle className="h-7 w-7 shrink-0 text-rose-600" />}
            <div>
              {result.ok ? (
                <>
                  <p className="font-bold text-emerald-900">Valid — redeemed for {result.voucher.customerName}</p>
                  <p className="text-sm text-emerald-800">{result.voucher.offerTitle} · {result.voucher.optionLabel}</p>
                  <p className="text-sm text-emerald-800">Redemption {result.voucher.redemptions.length} of {result.voucher.maxRedemptions}</p>
                </>
              ) : (
                <p className="font-semibold text-rose-800">{result.message}</p>
              )}
            </div>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <p className="mb-3 font-display font-bold">Recent redemptions</p>
        {recent.length ? (
          <div className="divide-y divide-ink-50">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <b>{r.v.customerName}</b> · {r.v.offerTitle}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-500">
                  <Badge tone="emerald">{r.v.code}</Badge> {formatDateTime(r.at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500">No redemptions yet. Issued codes: {vouchers.length}</p>
        )}
      </Card>
    </div>
  );
}
