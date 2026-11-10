import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Toggle } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { cx, relativeTime } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

export default function Notifications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: items } = useQuery('notifications', [['uid', '==', user.uid]], { sort: ['createdAt', 'desc'] });
  const [prefs, setPrefs] = useState(profile?.notificationPrefs || {});
  const [saving, setSaving] = useState(false);

  const save = async (next) => {
    setPrefs(next);
    setSaving(true);
    try {
      await call('updateProfile', { notificationPrefs: next });
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" icon={Bell} actions={<Button variant="secondary" size="sm" icon={CheckCheck} onClick={() => call('markNotificationsRead', {})}>Mark all read</Button>} />
      <Card className="p-5">
        <p className="font-display font-bold">Communication preferences</p>
        <p className="mb-2 text-sm text-ink-500">Transactional updates only. We never spam, and you can change this any time.{saving && ' Saving…'}</p>
        <div className="divide-y divide-ink-50">
          <Toggle checked label="In-site notifications" description="Always on for order, payment and refund updates" onChange={() => {}} />
          <Toggle checked={!!prefs.email} label="Email" description="Payment receipts, group success/failure, refunds" onChange={(v) => save({ ...prefs, email: v })} />
          <Toggle checked={!!prefs.whatsapp} label="WhatsApp" description="Group progress, booking reminders & delivery updates (requires consent)" onChange={(v) => save({ ...prefs, whatsapp: v })} />
          <Toggle checked={!!prefs.sms} label="SMS" description="Critical alerts like OTPs and booking reminders" onChange={(v) => save({ ...prefs, sms: v })} />
          <Toggle checked={!!prefs.marketing} label="Offers & new deals" description="Occasional curated deals near you" onChange={(v) => save({ ...prefs, marketing: v })} />
        </div>
      </Card>
      {items.length ? (
        <Card className="divide-y divide-ink-50 overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) call('markNotificationsRead', { ids: [n.id] }).catch(() => {});
                if (n.link) navigate(n.link);
              }}
              className={cx('flex w-full gap-3 p-4 text-left hover:bg-ink-50', !n.read && 'bg-brand-50/40')}
            >
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-ink-200' : 'bg-brand-500')} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{n.title}</span>
                <span className="block text-sm text-ink-500">{n.body}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-400">{relativeTime(n.createdAt)}</span>
            </button>
          ))}
        </Card>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" />
      )}
    </div>
  );
}
