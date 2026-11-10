import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequireAuth, RequireRole } from './components/guards.jsx';
import { PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';

const Deals = lazy(() => import('./pages/Deals.jsx'));
const DealDetail = lazy(() => import('./pages/DealDetail.jsx'));
const GroupPage = lazy(() => import('./pages/GroupPage.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const PaymentGateway = lazy(() => import('./pages/PaymentGateway.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const HowItWorks = lazy(() => import('./pages/HowItWorks.jsx'));
const Partner = lazy(() => import('./pages/Partner.jsx'));
const Help = lazy(() => import('./pages/Help.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Policy = lazy(() => import('./pages/Policy.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const AccountRoutes = lazy(() => import('./pages/account/AccountRoutes.jsx'));
const MerchantRoutes = lazy(() => import('./pages/merchant/MerchantRoutes.jsx'));
const MerchantRegister = lazy(() => import('./pages/merchant/MerchantRegister.jsx'));
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes.jsx'));

function CategoryRedirect() {
  const { id } = useParams();
  return <Navigate to={`/deals?category=${id}`} replace />;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: '!rounded-2xl !font-semibold !text-sm', duration: 3500 }} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="deals" element={<Deals />} />
            <Route path="category/:id" element={<CategoryRedirect />} />
            <Route path="deal/:offerId" element={<DealDetail />} />
            <Route path="g/:groupId" element={<GroupPage />} />
            <Route path="checkout/:groupId" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="pay/:paymentId" element={<RequireAuth><PaymentGateway /></RequireAuth>} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Login mode="signup" />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="partner" element={<Partner />} />
            <Route path="help" element={<Help />} />
            <Route path="about" element={<About />} />
            <Route path="policies/:slug" element={<Policy />} />
            <Route path="account/*" element={<RequireAuth><AccountRoutes /></RequireAuth>} />
            <Route path="merchant/register" element={<RequireAuth><MerchantRegister /></RequireAuth>} />
            <Route path="merchant/*" element={<RequireRole roles={['merchant']} fallback={<Navigate to="/partner" replace />}><MerchantRoutes /></RequireRole>} />
            <Route path="admin/*" element={<RequireRole roles={['admin', 'support', 'operations']}><AdminRoutes /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
