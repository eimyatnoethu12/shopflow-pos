import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import { Search, Eye, Power, AlertTriangle, Store, ShieldAlert, CheckCircle } from 'lucide-react';

export function TenantsView() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTenants = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (statusFilter !== 'all') params.append('status', statusFilter);

    api(`/admin/tenants?${params.toString()}`)
      .then(setTenants)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTenants();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadTenants();
  };

  const handleToggleStatus = async (tenant) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active';
    const confirmMsg = nextStatus === 'suspended'
      ? `Are you sure you want to SUSPEND '${tenant.name}'? Users will be blocked from accessing the shop.`
      : `Activate '${tenant.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api(`/admin/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      loadTenants();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewDetails = async (tenantId) => {
    try {
      setDetailLoading(true);
      const data = await api(`/admin/tenants/${tenantId}`);
      setSelectedTenant(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('allShops')}</h1>
          <p>Inspect, activate, suspend, and view all registered tenant shops</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <form onSubmit={handleSearchSubmit} className="search-box">
            <Search size={16} />
            <input
              placeholder="Search by shop name, slug, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'active', 'suspended'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t('shopName')}</th>
                <th>Owner Details</th>
                <th>Phone</th>
                <th>Branches</th>
                <th>Catalog / Orders</th>
                <th>Subscription Plan</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((shop) => (
                <tr key={shop.id}>
                  <td>
                    <b>{shop.name}</b>
                    <small style={{ display: 'block', color: '#64748b' }}>/{shop.slug}</small>
                  </td>
                  <td>
                    <div>{shop.owner?.name || '—'}</div>
                    <small style={{ color: '#64748b' }}>{shop.owner?.email || '—'}</small>
                  </td>
                  <td>{shop.phone || '—'}</td>
                  <td>{shop.branchesCount}</td>
                  <td>
                    {shop.productsCount} products • {shop.ordersCount} orders
                  </td>
                  <td>
                    {shop.subscription ? (
                      <div>
                        <span className="pill pill-active">{shop.subscription.planName}</span>
                        <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>
                          {shop.subscription.daysLeft > 0
                            ? `${shop.subscription.daysLeft} days left`
                            : 'Expired'}
                        </small>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className={`pill ${shop.status === 'active' ? 'pill-active' : 'pill-suspended'}`}>
                      {shop.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetails(shop.id)}
                        title="View Shop Details"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        className={`btn btn-sm ${shop.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleStatus(shop)}
                        title={shop.status === 'active' ? 'Suspend Shop' : 'Activate Shop'}
                      >
                        <Power size={14} /> {shop.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shop Detail Modal */}
      <Modal
        isOpen={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        title={selectedTenant?.name || 'Shop Details'}
        maxWidth="640px"
      >
        {selectedTenant && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <small style={{ color: '#64748b' }}>SLUG</small>
                <div><b>{selectedTenant.slug}</b></div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <small style={{ color: '#64748b' }}>PHONE</small>
                <div><b>{selectedTenant.phone || '—'}</b></div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <small style={{ color: '#64748b' }}>STATUS</small>
                <div>
                  <span className={`pill ${selectedTenant.status === 'active' ? 'pill-active' : 'pill-suspended'}`}>
                    {selectedTenant.status}
                  </span>
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                <small style={{ color: '#64748b' }}>REGISTERED DATE</small>
                <div><b>{new Date(selectedTenant.createdAt).toLocaleDateString()}</b></div>
              </div>
            </div>

            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Branches ({selectedTenant.Branch?.length || 0})</h4>
            <div style={{ marginBottom: '16px' }}>
              {(selectedTenant.Branch || []).map((b) => (
                <div key={b.id} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '6px', fontSize: '13px' }}>
                  <b>{b.name}</b> {b.isMain && <span className="pill pill-active">Main Branch</span>}
                  <div style={{ color: '#64748b', fontSize: '12px' }}>{b.address || 'No address'} • {b.phone || 'No phone'}</div>
                </div>
              ))}
            </div>

            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Subscriptions & History</h4>
            <div style={{ marginBottom: '20px' }}>
              {(selectedTenant.Subscription || []).map((s) => (
                <div key={s.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <b>{s.Plan?.name} Plan</b>
                    <span className={`pill ${s.status === 'active' ? 'pill-active' : 'pill-trial'}`}>{s.status}</span>
                  </div>
                  <div style={{ color: '#64748b' }}>
                    Payment: {s.paymentStatus} • Expires: {new Date(s.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedTenant(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
