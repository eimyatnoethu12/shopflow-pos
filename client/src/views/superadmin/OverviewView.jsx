import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Store, Users, DollarSign, Clock, ShieldCheck, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function OverviewView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const loadData = () => {
    setLoading(true);
    api('/admin/overview')
      .then(setData)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (subId) => {
    if (!window.confirm('Approve this payment slip and activate subscription?')) return;
    try {
      setActionLoading(subId);
      await api(`/admin/subscriptions/${subId}/approve`, { method: 'POST', body: JSON.stringify({}) });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (subId) => {
    if (!window.confirm('Reject this payment request?')) return;
    try {
      setActionLoading(subId);
      await api(`/admin/subscriptions/${subId}/reject`, { method: 'POST', body: JSON.stringify({}) });
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  };

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>{t('loading')}</div>;
  }

  const m = data?.metrics || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('dashboard')}</h1>
          <p>Global SaaS metrics, revenues, and pending payment approvals</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('totalPlatformRevenue')}</span>
            <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <strong><Money value={m.totalRevenue} /></strong>
          <small>Approved subscriptions</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('totalShops')}</span>
            <div className="stat-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <Store size={20} />
            </div>
          </div>
          <strong>{m.totalTenants || 0}</strong>
          <small>{m.activeTenants || 0} Active • {m.suspendedTenants || 0} Suspended</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('platformUsers')}</span>
            <div className="stat-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Users size={20} />
            </div>
          </div>
          <strong>{m.totalUsers || 0}</strong>
          <small>Registered across all shops</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('pendingPaymentSlips')}</span>
            <div className="stat-card-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <Clock size={20} />
            </div>
          </div>
          <strong style={{ color: m.pendingSlipsCount > 0 ? '#d97706' : '#0f172a' }}>
            {m.pendingSlipsCount || 0}
          </strong>
          <small>Awaiting Super Admin approval</small>
        </div>
      </div>

      {/* Pending Payment Slips */}
      <div className="panel">
        <div className="panel-head">
          <h3>{t('pendingPaymentSlips')}</h3>
          <Link to="/admin/subscriptions" className="btn btn-secondary btn-sm">
            View All <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Shop Name</th>
                <th>Plan Requested</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Payment Slip</th>
                <th>Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentSubscriptions || []).map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <b>{sub.Tenant?.name}</b>
                    <small style={{ display: 'block', color: '#64748b' }}>{sub.Tenant?.slug}</small>
                  </td>
                  <td><span className="pill pill-trial">{sub.Plan?.name}</span></td>
                  <td><Money value={sub.amountDue} /></td>
                  <td><span className="pill pill-active">{sub.paymentMethod || 'Manual'}</span></td>
                  <td>
                    {sub.paymentSlipUrl ? (
                      <a href={sub.paymentSlipUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 600 }}>
                        View Slip ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={actionLoading === sub.id}
                        onClick={() => handleApprove(sub.id)}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionLoading === sub.id}
                        onClick={() => handleReject(sub.id)}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.recentSubscriptions || data.recentSubscriptions.length === 0) && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                    No pending payment slips waiting for approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Shops */}
      <div className="panel">
        <div className="panel-head">
          <h3>Newly Registered Shops</h3>
          <Link to="/admin/tenants" className="btn btn-secondary btn-sm">
            Manage All Shops <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t('shopName')}</th>
                <th>{t('ownerName')}</th>
                <th>{t('phone')}</th>
                <th>Plan</th>
                <th>{t('status')}</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentTenants || []).map((shop) => (
                <tr key={shop.id}>
                  <td>
                    <b>{shop.name}</b>
                    <small style={{ display: 'block', color: '#64748b' }}>{shop.slug}</small>
                  </td>
                  <td>{shop.owner?.name || '—'}</td>
                  <td>{shop.phone || '—'}</td>
                  <td>
                    <span className="pill pill-active">{shop.currentPlan}</span>
                  </td>
                  <td>
                    <span className={`pill ${shop.status === 'active' ? 'pill-active' : 'pill-suspended'}`}>
                      {shop.status}
                    </span>
                  </td>
                  <td>{new Date(shop.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
