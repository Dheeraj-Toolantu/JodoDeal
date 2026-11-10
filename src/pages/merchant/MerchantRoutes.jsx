import { BarChart3, ClipboardList, FileWarning, Megaphone, Package, QrCode, Settings, Store, Wallet } from 'lucide-react';
import { Route, Routes } from 'react-router-dom';
import { PortalShell } from '@/components/Layout.jsx';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import Bookings from './Bookings.jsx';
import Cases from './Cases.jsx';
import Dashboard from './Dashboard.jsx';
import OfferEditor from './OfferEditor.jsx';
import Offers from './Offers.jsx';
import Orders from './Orders.jsx';
import MerchantProfile from './MerchantProfile.jsx';
import Redeem from './Redeem.jsx';
import Settlements from './Settlements.jsx';

export default function MerchantRoutes() {
  const { profile } = useAuth();
  const mid = profile.merchantId;
  const { data: cases } = useQuery('cases', [['merchantId', '==', mid], ['status', '==', 'OPEN']]);
  const links = [
    { to: '/merchant', end: true, label: 'Dashboard', icon: BarChart3 },
    { to: '/merchant/offers', label: 'Offers & campaigns', icon: Megaphone },
    { to: '/merchant/orders', label: 'Product orders', icon: Package },
    { to: '/merchant/bookings', label: 'Bookings & projects', icon: ClipboardList },
    { to: '/merchant/redeem', label: 'Redeem codes', icon: QrCode },
    { to: '/merchant/requests', label: 'Customer requests', icon: FileWarning, badge: cases.length || null },
    { to: '/merchant/settlements', label: 'Settlements', icon: Wallet },
    { to: '/merchant/profile', label: 'Business profile', icon: Settings },
  ];
  return (
    <PortalShell title="Merchant portal" icon={Store} links={links}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/new" element={<OfferEditor />} />
        <Route path="offers/:offerId/edit" element={<OfferEditor />} />
        <Route path="orders" element={<Orders />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="redeem" element={<Redeem />} />
        <Route path="requests" element={<Cases />} />
        <Route path="settlements" element={<Settlements />} />
        <Route path="profile" element={<MerchantProfile />} />
      </Routes>
    </PortalShell>
  );
}
