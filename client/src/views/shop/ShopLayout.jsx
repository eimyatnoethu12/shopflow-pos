import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Boxes,
  Receipt,
  BarChart3,
  GitBranch,
  UserCheck,
  CreditCard,
  LogOut,
  Languages,
  ArrowRightLeft,
  Menu,
  X
} from 'lucide-react';
import { useI18n } from '../../i18n';

export function ShopLayout({ session, onLogout, onSwitchToSuperAdmin }) {
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isSuperAdmin = Boolean(session.user?.isPlatformAdmin);

  const links = [
    ['/', 'dashboard', LayoutDashboard],
    ['/pos', 'posSales', ShoppingCart],
    ['/products', 'products', Package],
    ['/categories', 'categories', Layers],
    ['/orders', 'orders', ShoppingBag],
    ['/customers', 'customers', Users],
    ['/inventory', 'inventory', Boxes],
    ['/expenses', 'expenses', Receipt],
    ['/reports', 'reports', BarChart3],
    ['/branches', 'branches', GitBranch],
    ['/staff', 'staff', UserCheck],
    ['/subscription', 'subscription', CreditCard]
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-logo-area">
            <div className="brand-logo-badge">SF</div>
            <div className="brand-text">
              <b>ShopFlow</b>
              <small>POS SAAS</small>
            </div>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="shop-profile-box">
          <div className="shop-avatar">
            {session.tenant?.name?.[0] || 'S'}
          </div>
          <div className="shop-info-meta">
            <b>{session.tenant?.name || 'My Shop'}</b>
            <small>{session.branch?.name || 'Main Branch'}</small>
          </div>
        </div>

        <nav>
          {links.map(([url, key, Icon]) => (
            <NavLink
              end={url === '/'}
              to={url}
              key={url}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {isSuperAdmin && (
            <button
              className="sidebar-btn switch-panel-btn"
              onClick={onSwitchToSuperAdmin}
            >
              <ArrowRightLeft size={17} />
              <span>{t('switchToSuperAdmin')}</span>
            </button>
          )}

          <button
            className="sidebar-btn"
            onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
          >
            <Languages size={17} />
            <span>{lang === 'my' ? 'English' : 'မြန်မာ'}</span>
          </button>

          <button className="sidebar-btn" onClick={onLogout}>
            <LogOut size={17} />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pill pill-active">Active Shop</span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                <b>{session.tenant?.name}</b> • {session.branch?.name || 'Main Branch'}
              </span>
            </div>
          </div>

          <div className="topbar-right">
            <NavLink to="/pos" className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
              <ShoppingCart size={15} />
              <span>Open POS</span>
            </NavLink>

            <button
              className="lang-toggle-btn"
              onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
            >
              <Languages size={15} />
              <span>{lang === 'my' ? 'English' : 'မြန်မာ'}</span>
            </button>

            <div className="user-badge-chip">
              <span className="user-avatar">
                {session.user?.name?.[0] || 'U'}
              </span>
              <span>{session.user?.name}</span>
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
