import { Compass } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui.jsx';

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState icon={Compass} title="Page not found" description="The page you're looking for doesn't exist or has moved." action={<Button to="/">Back to home</Button>} />
    </div>
  );
}
