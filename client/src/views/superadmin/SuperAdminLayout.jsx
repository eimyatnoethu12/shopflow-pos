import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  CreditCard,
  Layers,
  Users,
  LogOut,
  Languages,
  ArrowRightLeft,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import { useI18n } from '../../i18n';

export function SuperAdminLayout({ session, onLogout, onSwitchToShop }) {
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar super-admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-logo-area">
            <div className="brand-logo-badge super-badge">SF</div>
            <div className="brand-text">
              <b>ShopFlow</b>
              <small>SUPER ADMIN</small>
            </div>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="shop-profile-box" style={{ borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <div className="shop-avatar" style={{ background: '#0284c7' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="shop-info-meta">
            <b>{session.user?.name || 'Super Admin'}</b>
            <small style={{ color: '#38bdf8' }}>{t('platformOwner')}</small>
          </div>
        </div>

        <nav>
          <NavLink
            end
            to="/admin"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={18} />
            <span>{t('dashboard')}</span>
          </NavLink>

          <NavLink
            to="/admin/tenants"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            <Store size={18} />
            <span>{t('allShops')}</span>
          </NavLink>

          <NavLink
            to="/admin/subscriptions"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            <CreditCard size={18} />
            <span>{t('subscriptionsAndSlips')}</span>
          </NavLink>

          <NavLink
            to="/admin/plans"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            <Layers size={18} />
            <span>{t('plansManagement')}</span>
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            <Users size={18} />
            <span>{t('platformUsers')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <button
            className="sidebar-btn switch-panel-btn"
            onClick={onSwitchToShop}
          >
            <ArrowRightLeft size={17} />
            <span>{t('switchToShopAdmin')}</span>
          </button>

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
              <span className="pill pill-active" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                SUPER ADMIN
              </span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>/ Platform Control Center</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className="lang-toggle-btn"
              onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
            >
              <Languages size={15} />
              <span>{lang === 'my' ? 'English' : 'မြန်မာ'}</span>
            </button>

            <div className="user-badge-chip">
              <span className="user-avatar" style={{ background: '#0284c7' }}>
                {session.user?.name?.[0] || 'A'}
              </span>
              <span>{session.user?.name || 'Admin'}</span>
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
