import { useAuth } from '@/context/AuthContext.jsx';
import { useDoc, useQuery } from '@/hooks/useData.js';

export function useMerchantData() {
  const { profile } = useAuth();
  const mid = profile?.merchantId;
  const merchant = useDoc(mid ? `merchants/${mid}` : null);
  const offers = useQuery('offers', [['merchantId', '==', mid]], { sort: ['updatedAt', 'desc'] }, !!mid);
  const groups = useQuery('groups', [['merchantId', '==', mid]], { sort: ['createdAt', 'desc'] }, !!mid);
  const orders = useQuery('orders', [['merchantId', '==', mid]], { sort: ['createdAt', 'desc'] }, !!mid);
  return { mid, merchant: merchant.data, offers: offers.data, groups: groups.data, orders: orders.data, loading: merchant.loading || offers.loading };
}
