import { useMemo } from 'react';
import { JOINABLE_GROUP_STATES } from '@shared/constants.js';
import { useQuery } from './useData.js';

/** Live approved offers with their most relevant joinable group. */
export function useLiveDeals() {
  const offers = useQuery('offers', [['status', '==', 'APPROVED']]);
  const groups = useQuery('groups', [['state', 'in', JOINABLE_GROUP_STATES]]);
  return useMemo(() => {
    const now = new Date();
    const live = groups.data.filter((g) => new Date(g.deadline) > now);
    const byOffer = {};
    for (const g of live) {
      (byOffer[g.offerId] = byOffer[g.offerId] || []).push(g);
    }
    // Prefer the open group closest to target, then confirmed groups.
    const pick = (list = []) =>
      [...list].sort((a, b) => {
        const ao = a.state === 'OPEN' ? 0 : 1;
        const bo = b.state === 'OPEN' ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return b.paidCount / b.minGroupSize - a.paidCount / a.minGroupSize;
      })[0] || null;
    const deals = offers.data.map((o) => ({ offer: o, group: pick(byOffer[o.id]), groups: byOffer[o.id] || [] }));
    return { deals, groups: live, loading: offers.loading || groups.loading };
  }, [offers.data, groups.data, offers.loading, groups.loading]);
}
