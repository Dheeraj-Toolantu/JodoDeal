import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Card, Input, PageHeader, Select } from '@/components/ui.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { formatDate } from '@/lib/format.js';
import { call, errorMessage } from '@/services/api.js';

export default function AdminUsers() {
  const { profile } = useAuth();
  const { data: users } = useQuery('users', [], { sort: ['createdAt', 'desc'] });
  const [q, setQ] = useState('');
  const list = users.filter((u) => !u.synthetic && `${u.displayName} ${u.email} ${u.phone} ${u.role}`.toLowerCase().includes(q.toLowerCase()));
  const isAdmin = profile?.role === 'admin';
  const update = async (uid, patch) => {
    try {
      await call('setUserRole', { uid, ...patch });
      toast.success('User updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div>
      <PageHeader title="Users & roles" subtitle="Role-based access with least privilege. All changes are audit-logged." icon={Users} />
      <Input icon={Search} className="mb-4" placeholder="Search name, email, phone, role" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>{['User', 'Contact', 'Joined', 'Role', 'Status'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((u) => (
              <tr key={u.uid}>
                <td className="px-4 py-3 font-semibold">{u.displayName}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{u.email || '—'}<br />{u.phone || ''}</td>
                <td className="px-4 py-3 text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  {isAdmin && u.uid !== profile.uid ? (
                    <Select className="!w-36 !py-1.5" value={u.role} onChange={(e) => update(u.uid, { role: e.target.value })}>
                      {['customer', 'merchant', 'support', 'operations', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  ) : (
                    <Badge>{u.role}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isAdmin && u.uid !== profile.uid ? (
                    <Select className="!w-32 !py-1.5" value={u.status || 'ACTIVE'} onChange={(e) => update(u.uid, { status: e.target.value })}>
                      <option value="ACTIVE">active</option>
                      <option value="SUSPENDED">suspended</option>
                    </Select>
                  ) : (
                    <Badge tone={u.status === 'SUSPENDED' ? 'rose' : 'emerald'}>{(u.status || 'ACTIVE').toLowerCase()}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
