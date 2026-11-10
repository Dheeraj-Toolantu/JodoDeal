import { FileWarning } from 'lucide-react';
import { PageHeader } from '@/components/ui.jsx';
import { CaseList } from '../merchant/Cases.jsx';

export default function AdminDisputes() {
  return (
    <div>
      <PageHeader title="Disputes & requests" subtitle="All cancellation and return cases across providers. Staff can override refund amounts as a remedy." icon={FileWarning} />
      <CaseList wheres={[]} staff />
    </div>
  );
}
