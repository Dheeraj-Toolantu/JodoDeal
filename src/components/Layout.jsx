import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  Compass,
  FlaskConical,
  Home,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Store,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '@shared/categories.js';
import { SUPPORT, TAGLINE } from '@shared/constants.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useQuery } from '@/hooks/useData.js';
import { cx, relativeTime } from '@/lib/format.js';
import { isDemoMode } from '@/lib/firebase.js';
import { call } from '@/services/api.js';
import Icon from './Icon.jsx';
import WelcomeTour from './WelcomeTour.jsx';

export function Logo({ light, className }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2', className)} aria-label="JodoDeal home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
        <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden>
          <circle cx="24" cy="25" r="7" fill="#fff" />
          <circle cx="40" cy="25" r="7" fill="#fff" fillOpacity=".8" />
          <path d="M12 48c1-8 6-12 12-12s9 2 10 5c1-3 4-5 8-5 6 0 10 4 11 12" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
        </svg>
      </span>
      <span className={cx('font-display text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-ink-900')}>
        Jodo<span className="text-brand-500">Deal</span>
      </span>
    </Link>
  );
}

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onClose]);
}

function NotificationBell({ uid }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const { data: items } = useQuery('notifications', [['uid', '==', uid]], { sort: ['createdAt', 'desc'] }, !!uid);
  const unread = items.filter((n) => !n.read).length;
  const navigate = useNavigate();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2.5 text-ink-600 hover:bg-ink-100" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-100 animate-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-display font-bold">Notifications</p>
            {unread > 0 && (
              <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => call('markNotificationsRead', {})}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-6 text-center text-sm text-ink-400">You're all caught up ✨</p>}
            {items.slice(0, 20).map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  if (!n.read) call('markNotificationsRead', { ids: [n.id] }).catch(() => {});
                  if (n.link) navigate(n.link);
                }}
                className={cx('flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50', !n.read && 'bg-brand-50/40')}
              >
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand-500')} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900">{n.title}</span>
                  <span className="line-clamp-2 block text-xs text-ink-500">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-400">{relativeTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
          <Link to="/account/notifications" onClick={() => setOpen(false)} className="block bg-ink-50 py-2.5 text-center text-xs font-semibold text-ink-600 hover:text-brand-600">
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { profile, user, signOut, isMerchant, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const name = profile?.displayName || user?.email || user?.phone || 'Account';
  const item = 'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-ink-100" aria-haspopup="menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-gradient text-sm font-bold text-white">{name.charAt(0).toUpperCase()}</span>
        <span className="hidden max-w-[120px] truncate text-sm font-semibold lg:block">{name.split(' ')[0]}</span>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 lg:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-ink-100 animate-pop" role="menu" onClick={() => setOpen(false)}>
          <div className="mb-1 border-b border-ink-100 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="text-xs capitalize text-ink-400">{profile?.role || 'customer'} account</p>
          </div>
          <Link to="/account" className={item}>
            <User className="h-4 w-4" /> My account
          </Link>
          <Link to="/account/orders" className={item}>
            <Package className="h-4 w-4" /> Orders & bookings
          </Link>
          {isMerchant ? (
            <Link to="/merchant" className={item}>
              <Store className="h-4 w-4" /> Merchant portal
            </Link>
          ) : (
            !isStaff && (
              <Link to="/merchant/register" className={item}>
                <BriefcaseBusiness className="h-4 w-4" /> Sell on JodoDeal
              </Link>
            )
          )}
          {isStaff && (
            <Link to="/admin" className={item}>
              <ShieldCheck className="h-4 w-4" /> Admin console
            </Link>
          )}
          <button onClick={signOut} className={cx(item, 'w-full text-rose-600 hover:bg-rose-50')}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function CategoriesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
        Categories <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 grid w-[560px] grid-cols-2 gap-1 rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink-100 animate-pop" onClick={() => setOpen(false)}>
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/deals?category=${c.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50">
              <span className={cx('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white', c.gradient)}>
                <Icon name={c.icon} className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{c.name}</span>
                <span className="line-clamp-1 block text-xs text-ink-400">{c.examples}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderSearch({ className }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/deals?q=${encodeURIComponent(q)}`);
      }}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search gyms, courses, interiors, earbuds…"
        className="h-11 w-full rounded-xl border-0 bg-ink-50 pl-10 pr-3 text-sm ring-1 ring-inset ring-ink-100 placeholder:text-ink-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
        aria-label="Search deals"
      />
    </form>
  );
}

function Header() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  const nav = ({ isActive }) => cx('rounded-xl px-3 py-2 text-sm font-semibold transition', isActive ? 'text-brand-600' : 'text-ink-700 hover:bg-ink-100');
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          <NavLink to="/deals" className={nav}>
            Explore deals
          </NavLink>
          <CategoriesMenu />
          <NavLink to="/how-it-works" className={nav}>
            How it works
          </NavLink>
        </nav>
        <HeaderSearch className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm" />
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {!loading && user ? (
            <>
              <NotificationBell uid={user.uid} />
              <AccountMenu />
            </>
          ) : (
            <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}
          <button className="rounded-xl p-2.5 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-ink-100 bg-white px-4 pb-4 pt-3 lg:hidden animate-fade-up">
          <HeaderSearch className="mb-3" />
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.slice(0, 8).map((c) => (
              <Link key={c.id} to={`/deals?category=${c.id}`} className="flex items-center gap-2 rounded-xl bg-ink-50 p-2.5 text-sm font-semibold">
                <Icon name={c.icon} className="h-4 w-4 text-brand-600" /> {c.name}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-col">
            <Link to="/how-it-works" className="rounded-xl px-3 py-2.5 font-semibold">How it works</Link>
            <Link to="/partner" className="rounded-xl px-3 py-2.5 font-semibold">For business</Link>
            <Link to="/help" className="rounded-xl px-3 py-2.5 font-semibold">Help & support</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileTabBar() {
  const { user } = useAuth();
  const tab = ({ isActive }) => cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-brand-600' : 'text-ink-400');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
      <NavLink to="/" end className={tab}>
        <Home className="h-5 w-5" /> Home
      </NavLink>
      <NavLink to="/deals" className={tab}>
        <Compass className="h-5 w-5" /> Explore
      </NavLink>
      <NavLink to="/account/orders" className={tab}>
        <Package className="h-5 w-5" /> My deals
      </NavLink>
      <NavLink to={user ? '/account' : '/login'} className={tab}>
        <User className="h-5 w-5" /> {user ? 'Account' : 'Sign in'}
      </NavLink>
    </nav>
  );
}

function DemoBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('jd-demo-banner') === '1';
    } catch {
      return false;
    }
  });
  if (!isDemoMode || hidden) return null;
  return (
    <div className="relative bg-ink-950 px-4 py-2 text-center text-xs text-ink-200">
      <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 text-brand-400" />
      <b className="text-white">Demo mode</b> — sample data stored in your browser; payments are simulated. Try the{' '}
      <Link to="/login" className="font-semibold text-brand-300 underline-offset-2 hover:underline">
        demo accounts
      </Link>
      .
      <button
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem('jd-demo-banner', '1');
          } catch {
            /* ignore */
          }
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-white/10"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Footer() {
  const col = 'space-y-2.5 text-sm text-ink-300';
  const a = 'hover:text-white transition';
  return (
    <footer className="mt-20 bg-ink-950 pb-24 text-ink-300 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-300">
            {TAGLINE} India's social group-buying marketplace for products and services — team up to unlock better prices with verified providers.
          </p>
          <div className="mt-5 space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-400" /> {SUPPORT.email}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-400" /> {SUPPORT.phone} · {SUPPORT.hours}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-4 font-display font-bold text-white">Explore</p>
          <ul className={col}>
            <li><Link className={a} to="/deals?category=gym-fitness">Gym & fitness</Link></li>
            <li><Link className={a} to="/deals?category=online-classes">Online classes</Link></li>
            <li><Link className={a} to="/deals?category=interior-home">Interior & home</Link></li>
            <li><Link className={a} to="/deals?category=electronics">Electronics</Link></li>
            <li><Link className={a} to="/how-it-works">How it works</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-display font-bold text-white">Company</p>
          <ul className={col}>
            <li><Link className={a} to="/about">About JodoDeal</Link></li>
            <li><Link className={a} to="/partner">Become a partner</Link></li>
            <li><Link className={a} to="/help">Help centre</Link></li>
            <li><Link className={a} to="/merchant">Merchant portal</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 font-display font-bold text-white">Policies</p>
          <ul className={col}>
            <li><Link className={a} to="/policies/terms">Terms of use</Link></li>
            <li><Link className={a} to="/policies/refunds">Refunds & cancellations</Link></li>
            <li><Link className={a} to="/policies/privacy">Privacy policy</Link></li>
            <li><Link className={a} to="/policies/grievance">Grievance redressal</Link></li>
            <li><Link className={a} to="/policies/sellers">Seller information</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} JodoDeal Technologies Pvt. Ltd. (marketplace intermediary). Merchants are responsible for fulfilment of their offers.</p>
          <p>
            Grievance Officer: <a className="hover:text-white" href={`mailto:${SUPPORT.grievanceEmail}`}>{SUPPORT.grievanceEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <DemoBanner />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <WelcomeTour />
    </div>
  );
}

export function PortalShell({ title, icon: IconCmp, links, children }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 hidden items-center gap-2 px-2 lg:flex">
            <IconCmp className="h-5 w-5 text-brand-600" />
            <p className="font-display font-bold">{title}</p>
          </div>
          <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-white text-brand-700 shadow-soft ring-1 ring-ink-100' : 'text-ink-600 hover:bg-white/70')
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
                {l.badge ? <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">{l.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}

