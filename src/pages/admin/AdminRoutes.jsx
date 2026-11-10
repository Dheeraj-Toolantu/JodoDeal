import { BadgeCheck, FileWarning, Gauge, History, LayoutGrid, LifeBuoy, Megaphone, ReceiptIndianRupee, ShieldCheck, Users, UsersRound } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { PortalShell } from '@/components/Layout.jsx';
import { useQuery } from '@/hooks/useData.js';
import AdminAudit from './AdminAudit.jsx';
import AdminCategories from './AdminCategories.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminDisputes from './AdminDisputes.jsx';
import AdminGroups from './AdminGroups.jsx';
import AdminMerchants from './AdminMerchants.jsx';
import AdminOffers from './AdminOffers.jsx';
import AdminRefunds from './AdminRefunds.jsx';
import AdminTickets from './AdminTickets.jsx';
import AdminUsers from './AdminUsers.jsx';

export default function AdminRoutes() {
  const { data: pendingM } = useQuery('merchants', [['status', '==', 'PENDING_VERIFICATION']]);
  const { data: pendingO } = useQuery('offers', [['status', '==', 'PENDING_APPROVAL']]);
  const { data: refunds } = useQuery('refunds', [['status', '==', 'INITIATED']]);
  const { data: tickets } = useQuery('tickets', [['status', '==', 'OPEN']]);
  const links = [
    { to: '/admin', end: true, label: 'Overview', icon: Gauge },
    { to: '/admin/merchants', label: 'Merchants', icon: BadgeCheck, badge: pendingM.length || null },
    { to: '/admin/offers', label: 'Offer moderation', icon: Megaphone, badge: pendingO.length || null },
    { to: '/admin/groups', label: 'Groups', icon: UsersRound },
    { to: '/admin/refunds', label: 'Refunds', icon: ReceiptIndianRupee, badge: refunds.length || null },
    { to: '/admin/disputes', label: 'Disputes & requests', icon: FileWarning },
    { to: '/admin/tickets', label: 'Support tickets', icon: LifeBuoy, badge: tickets.length || null },
    { to: '/admin/categories', label: 'Categories & fees', icon: LayoutGrid },
    { to: '/admin/users', label: 'Users & roles', icon: Users },
    { to: '/admin/audit', label: 'Audit log', icon: History },
  ];
  return (
    <PortalShell title="Admin console" icon={ShieldCheck} links={links}>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="merchants" element={<AdminMerchants />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="groups" element={<AdminGroups />} />
        <Route path="refunds" element={<AdminRefunds />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="audit" element={<AdminAudit />} />
      </Routes>
    </PortalShell>
  );
}
