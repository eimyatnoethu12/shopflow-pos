import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { BarChart3, TrendingUp, DollarSign, Receipt, PieChart, ShoppingCart } from 'lucide-react';

export function ReportsView() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'pnl'
  const [range, setRange] = useState('30days'); // 'today' | '7days' | '30days' | 'thisMonth' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesData, setSalesData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReports = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (range !== 'custom') {
      params.append('range', range);
    } else if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }

    Promise.all([
      api(`/reports/sales?${params.toString()}`),
      api(`/reports/profit-loss?${params.toString()}`)
    ]).then(([sales, pnl]) => {
      setSalesData(sales);
      setPnlData(pnl);
    }).catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, [range]);

  const handleCustomFilterSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    loadReports();
  };

  const s = salesData?.summary || {};
  const p = pnlData?.pnl || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('reports')}</h1>
          <p>Financial statements, sales performance analytics, and profit & loss calculations</p>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            ['today', 'Today'],
            ['7days', 'Last 7 Days'],
            ['30days', 'Last 30 Days'],
            ['thisMonth', 'This Month'],
            ['custom', 'Custom Range']
          ].map(([val, label]) => (
            <button
              key={val}
              className={`btn btn-sm ${range === val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRange(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <form onSubmit={handleCustomFilterSubmit} className="panel" style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#64748b' }}>Start Date</label>
            <input
              type="date"
              required
              className="form-input"
              style={{ padding: '5px 8px', fontSize: '12px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#64748b' }}>End Date</label>
            <input
              type="date"
              required
              className="form-input"
              style={{ padding: '5px 8px', fontSize: '12px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            Apply Date Filter
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="tabs-bar">
        <button
          className={`tab-item ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <BarChart3 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Sales Report
        </button>
        <button
          className={`tab-item ${activeTab === 'pnl' ? 'active' : ''}`}
          onClick={() => setActiveTab('pnl')}
        >
          <Receipt size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Profit & Loss Statement (P&L)
        </button>
      </div>

      {/* Tab 1: Sales Report */}
      {activeTab === 'sales' && (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-card-label">Total Revenue</span>
              <strong><Money value={s.totalRevenue} /></strong>
              <small>{s.totalOrders || 0} completed orders</small>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Total Discounts Given</span>
              <strong style={{ color: '#f59e0b' }}><Money value={s.totalDiscount} /></strong>
              <small>Applied order discounts</small>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Total Delivery Fees</span>
              <strong><Money value={s.totalDeliveryFee} /></strong>
              <small>Shipping charges collected</small>
            </div>

            <div className="stat-card">
              <span className="stat-card-label">Average Order Value</span>
              <strong><Money value={s.averageOrderValue} /></strong>
              <small>Revenue / Orders</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Payment Method Breakdown */}
            <div className="panel">
              <div className="panel-head">
                <h3>Payment Methods Summary</h3>
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Total Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesData?.paymentMethods || []).map((pm) => (
                      <tr key={pm.method}>
                        <td>
                          <span className="pill pill-active">{pm.method}</span>
                        </td>
                        <td><b><Money value={pm.amount} /></b></td>
                      </tr>
                    ))}
                    {(!salesData?.paymentMethods || salesData.paymentMethods.length === 0) && (
                      <tr>
                        <td colSpan="2" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
                          No sales in selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Best Selling Products */}
            <div className="panel">
              <div className="panel-head">
                <h3>Best Selling Products</h3>
              </div>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units Sold</th>
                      <th>Total Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesData?.bestSellingProducts || []).map((bp, idx) => (
                      <tr key={bp.name}>
                        <td>
                          <span style={{ color: '#6366f1', fontWeight: 700, marginRight: '6px' }}>#{idx + 1}</span>
                          <b>{bp.name}</b>
                        </td>
                        <td>{bp.quantity} units</td>
                        <td><b><Money value={bp.sales} /></b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Profit & Loss Report */}
      {activeTab === 'pnl' && (
        <div>
          <div className="panel" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            <div className="panel-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <h2>Income & Profit Statement</h2>
                <small style={{ color: '#64748b' }}>
                  {pnlData?.period?.start ? new Date(pnlData.period.start).toLocaleDateString() : ''} — {pnlData?.period?.end ? new Date(pnlData.period.end).toLocaleDateString() : ''}
                </small>
              </div>
              <span className={`pill ${p.netProfit >= 0 ? 'pill-active' : 'pill-suspended'}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
                Net Profit: <Money value={p.netProfit} />
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>1. Total Sales Revenue</span>
                <b style={{ fontSize: '16px', color: '#0f172a' }}><Money value={p.totalRevenue} /></b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px', color: '#ef4444' }}>
                <span>Less: Cost of Goods Sold (COGS)</span>
                <b>-<Money value={p.costOfGoodsSold} /></b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '10px 0', background: '#f8fafc', fontWeight: 700 }}>
                <span>2. Gross Profit (Margin: {p.grossMargin}%)</span>
                <span style={{ color: p.grossProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  <Money value={p.grossProfit} />
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px', color: '#ef4444' }}>
                <span>Less: Total Operating Expenses</span>
                <b>-<Money value={p.operatingExpenses} /></b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0f172a', paddingTop: '14px', marginTop: '6px', fontSize: '18px', fontWeight: 800 }}>
                <span>3. Net Profit (Margin: {p.netMargin}%)</span>
                <span style={{ color: p.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  <Money value={p.netProfit} />
                </span>
              </div>
            </div>
          </div>

          {/* Operating Expenses Breakdown Table */}
          <div className="panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="panel-head">
              <h3>Operating Expenses Included in this Period</h3>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(pnlData?.expensesBreakdown || []).map((exp) => (
                    <tr key={exp.id}>
                      <td>{exp.title}</td>
                      <td><b><Money value={exp.amount} /></b></td>
                      <td>{new Date(exp.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!pnlData?.expensesBreakdown || pnlData.expensesBreakdown.length === 0) && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8', padding: '18px' }}>
                        No expenses recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
