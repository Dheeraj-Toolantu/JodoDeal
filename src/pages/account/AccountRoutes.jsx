import { Bell, LayoutGrid, LifeBuoy, Package, ReceiptIndianRupee, Ticket, UserCircle } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { PortalShell } from '@/components/Layout.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import AccountHome from './AccountHome.jsx';
import Notifications from './Notifications.jsx';
import OrderDetail from './OrderDetail.jsx';
import Orders from './Orders.jsx';
import Profile from './Profile.jsx';
import Refunds from './Refunds.jsx';
import Support from './Support.jsx';
import Vouchers from './Vouchers.jsx';

export default function AccountRoutes() {
  const { user } = useAuth();
  const { data: notes } = useQuery('notifications', [['uid', '==', user.uid], ['read', '==', false]]);
  const links = [
    { to: '/account', end: true, label: 'Overview', icon: LayoutGrid },
    { to: '/account/orders', label: 'Orders & bookings', icon: Package },
    { to: '/account/vouchers', label: 'Vouchers & passes', icon: Ticket },
    { to: '/account/refunds', label: 'Refunds', icon: ReceiptIndianRupee },
    { to: '/account/support', label: 'Support', icon: LifeBuoy },
    { to: '/account/notifications', label: 'Notifications', icon: Bell, badge: notes.length || null },
    { to: '/account/profile', label: 'Profile & addresses', icon: UserCircle },
  ];
  return (
    <PortalShell title="My account" icon={UserCircle} links={links}>
      <Routes>
        <Route index element={<AccountHome />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:orderId" element={<OrderDetail />} />
        <Route path="vouchers" element={<Vouchers />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="support" element={<Support />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
    </PortalShell>
  );
}
