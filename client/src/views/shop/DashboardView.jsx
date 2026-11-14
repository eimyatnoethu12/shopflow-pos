import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Users,
  Boxes,
  AlertTriangle,
  Receipt,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardView() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api('/dashboard')
      .then(setData)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>{t('loading')}</div>;
  }

  const m = data?.metrics || {};
  const maxSales = Math.max(...(data?.chartData || []).map((c) => c.sales), 1000);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('dashboard')}</h1>
          <p>Real-time shop sales, inventory performance, and financial metrics</p>
        </div>
        <Link to="/pos" className="btn btn-primary">
          Launch POS Terminal
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('todaySales')}</span>
            <div className="stat-card-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <strong><Money value={m.todaySales} /></strong>
          <small>Today's cash & digital sales</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('monthSales')}</span>
            <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <strong><Money value={m.monthSales} /></strong>
          <small>This calendar month</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('netProfit')}</span>
            <div className="stat-card-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <Receipt size={20} />
            </div>
          </div>
          <strong style={{ color: m.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
            <Money value={m.netProfit} />
          </strong>
          <small>Revenue - COGS - Expenses</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('totalOrders')}</span>
            <div className="stat-card-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <ShoppingBag size={20} />
            </div>
          </div>
          <strong>{m.totalOrders || 0}</strong>
          <small>All time orders</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('totalStock')}</span>
            <div className="stat-card-icon" style={{ background: '#f8fafc', color: '#475569' }}>
              <Boxes size={20} />
            </div>
          </div>
          <strong>{m.totalStock || 0} units</strong>
          <small>{m.totalProducts || 0} items in catalog</small>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">{t('lowStockAlert')}</span>
            <div className="stat-card-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <strong style={{ color: m.lowStock > 0 ? '#d97706' : '#0f172a' }}>
            {m.lowStock || 0}
          </strong>
          <small>Items with 5 or fewer in stock</small>
        </div>
      </div>

      {/* 7-Day Revenue Trend Chart */}
      <div className="panel">
        <div className="panel-head">
          <h3>{t('salesTrend')}</h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Daily revenue (MMK)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '140px', paddingTop: '20px' }}>
          {(data?.chartData || []).map((c) => {
            const heightPercent = Math.max((c.sales / maxSales) * 100, 6);
            return (
              <div key={c.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1', marginBottom: '6px' }}>
                  {c.sales > 0 ? `${Math.round(c.sales / 1000)}k` : '0'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: `${heightPercent}%`,
                    background: c.sales > 0 ? 'linear-gradient(180deg, #6366f1, #818cf8)' : '#e2e8f0',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.3s ease'
                  }}
                  title={`${c.date}: ${c.sales.toLocaleString()} MMK (${c.orders} orders)`}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  {c.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Low Stock Alert & Top Selling Products */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Low Stock Alerts */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <h3>{t('lowStockAlert')} ({m.lowStock || 0})</h3>
            <Link to="/inventory" className="btn btn-secondary btn-sm">
              Restock <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.lowStockProducts || []).map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td>{p.sku}</td>
                    <td><b style={{ color: '#dc2626' }}>{p.stock} units</b></td>
                    <td><span className="pill pill-stock-low">Restock Now</span></td>
                  </tr>
                ))}
                {(!data?.lowStockProducts || data.lowStockProducts.length === 0) && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#10b981', padding: '20px' }}>
                      All items have healthy inventory stock.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <h3>{t('topProducts')}</h3>
            <Link to="/reports" className="btn btn-secondary btn-sm">
              View Reports <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topProducts || []).map((tp, idx) => (
                  <tr key={tp.name}>
                    <td>
                      <span style={{ color: '#6366f1', fontWeight: 700, marginRight: '6px' }}>#{idx + 1}</span>
                      <b>{tp.name}</b>
                    </td>
                    <td>{tp.quantity} units</td>
                    <td><b><Money value={tp.totalSales} /></b></td>
                  </tr>
                ))}
                {(!data?.topProducts || data.topProducts.length === 0) && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                      No sales data recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="panel">
        <div className="panel-head">
          <h3>{t('recentOrders')}</h3>
          <Link to="/orders" className="btn btn-secondary btn-sm">
            All Orders <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Total Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrders || []).map((o) => (
                <tr key={o.id}>
                  <td><b>{o.orderNumber}</b></td>
                  <td>{o.customer?.name || 'Walk-in Customer'}</td>
                  <td>{o.items?.length || 0} items</td>
                  <td><b><Money value={o.total} /></b></td>
                  <td><span className="pill pill-active">{o.paymentMethod}</span></td>
                  <td>
                    <span className={`pill ${o.status === 'DELIVERED' ? 'pill-delivered' : o.status === 'CANCELLED' ? 'pill-cancelled' : 'pill-confirmed'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
