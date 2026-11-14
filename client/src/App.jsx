import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, setToken, setActiveTenantId } from './api';
import { useI18n } from './i18n';

// Super Admin Layout & Views
import { SuperAdminLayout } from './views/superadmin/SuperAdminLayout';
import { OverviewView as SuperAdminOverview } from './views/superadmin/OverviewView';
import { TenantsView as SuperAdminTenants } from './views/superadmin/TenantsView';
import { SubscriptionsView as SuperAdminSubscriptions } from './views/superadmin/SubscriptionsView';
import { PlansView as SuperAdminPlans } from './views/superadmin/PlansView';
import { UsersView as SuperAdminUsers } from './views/superadmin/UsersView';

// Shop Admin Layout & Views
import { ShopLayout } from './views/shop/ShopLayout';
import { DashboardView } from './views/shop/DashboardView';
import { PosView } from './views/shop/PosView';
import { ProductsView } from './views/shop/ProductsView';
import { CategoriesView } from './views/shop/CategoriesView';
import { OrdersView } from './views/shop/OrdersView';
import { CustomersView } from './views/shop/CustomersView';
import { InventoryView } from './views/shop/InventoryView';
import { ExpensesView } from './views/shop/ExpensesView';
import { ReportsView } from './views/shop/ReportsView';
import { BranchesView } from './views/shop/BranchesView';
import { StaffView } from './views/shop/StaffView';
import { SubscriptionView } from './views/shop/SubscriptionView';

function Auth({ onLogin }) {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    shopName: '',
    email: 'owner@demo.shop',
    password: 'ShopFlow123!',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setToken(data.token);
      if (data.tenant?.id) {
        setActiveTenantId(data.tenant.id);
      }
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (type) => {
    if (type === 'superadmin') {
      setMode('login');
      setForm({ ...form, email: 'superadmin@shopflow.io', password: 'ShopFlow123!' });
    } else {
      setMode('login');
      setForm({ ...form, email: 'owner@demo.shop', password: 'ShopFlow123!' });
    }
  };

  return (
    <div className="auth-wrapper">
      <form className="auth-box" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div className="brand-logo-badge" style={{ width: '48px', height: '48px', fontSize: '22px' }}>
            SF
          </div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
          ShopFlow POS
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
          {mode === 'login' ? 'Sign in to your shop or admin console' : 'Register your shop on ShopFlow POS'}
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {mode === 'register' && (
          <>
            <div className="form-group">
              <label>{t('ownerName')} *</label>
              <input
                required
                className="form-input"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t('shopName')} *</label>
              <input
                required
                className="form-input"
                placeholder="e.g. Aung Online Store"
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t('phone')}</label>
              <input
                className="form-input"
                placeholder="09..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label>{t('email')} *</label>
          <input
            type="email"
            required
            className="form-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>{t('password')} *</label>
          <input
            type="password"
            required
            minLength={8}
            className="form-input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '14px', marginTop: '8px' }}
          disabled={loading}
        >
          {loading ? 'Please wait...' : mode === 'login' ? t('login') : t('createAccount')}
        </button>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '13px', fontWeight: 600 }}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create a new shop account' : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Quick Demo Shortcuts */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center' }}>
          <small style={{ color: '#64748b', display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 600 }}>
            QUICK DEMO LOGINS
          </small>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleFillDemo('shop')}
            >
              Shop Owner Demo
            </button>
            <button
              type="button"
              className="btn btn-super btn-sm"
              onClick={() => handleFillDemo('superadmin')}
            >
              Super Admin Demo
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const navigate = useNavigate();
  const { t } = useI18n();

  const loadSession = () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => {
        setSession(data);
        if (data.tenant?.id) {
          setActiveTenantId(data.tenant.id);
        }
      })
      .catch(() => {
        setToken(null);
        setActiveTenantId(null);
        setSession(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSession();
  }, []);

  const handleLogout = () => {
    setToken(null);
    setActiveTenantId(null);
    setSession(null);
    navigate('/');
  };

  const handleLoginSuccess = (loginData) => {
    setSession(loginData);
    if (loginData.user?.isPlatformAdmin && !loginData.tenant) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748b' }}>
        {t('loading')}
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={handleLoginSuccess} />;
  }

  const isSuperAdmin = Boolean(session.user?.isPlatformAdmin);

  return (
    <Routes>
      {/* Super Admin Routes */}
      {isSuperAdmin && (
        <Route
          path="/admin"
          element={
            <SuperAdminLayout
              session={session}
              onLogout={handleLogout}
              onSwitchToShop={() => navigate('/')}
            />
          }
        >
          <Route index element={<SuperAdminOverview />} />
          <Route path="tenants" element={<SuperAdminTenants />} />
          <Route path="subscriptions" element={<SuperAdminSubscriptions />} />
          <Route path="plans" element={<SuperAdminPlans />} />
          <Route path="users" element={<SuperAdminUsers session={session} />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Route>
      )}

      {/* Shop Admin Routes */}
      <Route
        path="/"
        element={
          session.tenant ? (
            <ShopLayout
              session={session}
              onLogout={handleLogout}
              onSwitchToSuperAdmin={() => navigate('/admin')}
            />
          ) : isSuperAdmin ? (
            <Navigate to="/admin" />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              No active shop assigned to this user.
            </div>
          )
        }
      >
        <Route index element={<DashboardView />} />
        <Route path="pos" element={<PosView />} />
        <Route path="products" element={<ProductsView />} />
        <Route path="categories" element={<CategoriesView />} />
        <Route path="orders" element={<OrdersView />} />
        <Route path="customers" element={<CustomersView />} />
        <Route path="inventory" element={<InventoryView />} />
        <Route path="expenses" element={<ExpensesView />} />
        <Route path="reports" element={<ReportsView />} />
        <Route path="branches" element={<BranchesView />} />
        <Route path="staff" element={<StaffView />} />
        <Route path="subscription" element={<SubscriptionView />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}
