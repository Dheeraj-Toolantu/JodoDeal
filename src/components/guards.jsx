import { ShieldAlert } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { Button, EmptyState, PageLoader } from './ui.jsx';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export function RequireRole({ roles, children, fallback }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  if (user && !profile && !loading) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={ShieldAlert} title="We couldn't load your account" description="The JodoDeal server is not reachable right now. Please try again in a few minutes." action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
      </div>
    );
  }
  if (loading || (user && !profile)) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!roles.includes(profile.role)) {
    return (
      fallback || (
        <div className="container-page py-16">
          <EmptyState icon={ShieldAlert} title="Access restricted" description="Your account does not have access to this area." action={<Button to="/">Back to home</Button>} />
        </div>
      )
    );
  }
  return children;
}
