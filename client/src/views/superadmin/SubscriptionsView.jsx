import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { CheckCircle2, XCircle, Calendar, ExternalLink, Filter } from 'lucide-react';

export function SubscriptionsView() {
  const { t } = useI18n();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [slipModal, setSlipModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ status: 'active', expiresAt: '' });

  const loadSubscriptions = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (paymentFilter !== 'all') params.append('paymentStatus', paymentFilter);

    api(`/admin/subscriptions?${params.toString()}`)
      .then(setSubs)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSubscriptions();
  }, [paymentFilter]);

  const handleApprove = async (subId) => {
    if (!window.confirm('Approve this subscription and activate plan?')) return;
    try {
      await api(`/admin/subscriptions/${subId}/approve`, { method: 'POST', body: JSON.stringify({}) });
      loadSubscriptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (subId) => {
    if (!window.confirm('Reject this payment request?')) return;
    try {
      await api(`/admin/subscriptions/${subId}/reject`, { method: 'POST', body: JSON.stringify({}) });
      loadSubscriptions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (sub) => {
    setEditModal(sub);
    setEditForm({
      status: sub.status,
      expiresAt: sub.expiresAt ? sub.expiresAt.slice(0, 10) : ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/subscriptions/${editModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editForm.status,
          expiresAt: new Date(editForm.expiresAt).toISOString()
        })
      });
      setEditModal(null);
      loadSubscriptions();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('subscriptionsAndSlips')}</h1>
          <p>Verify bank transfer slips, approve renewals, and adjust subscription durations</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Payment Status:</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'pending', 'paid', 'rejected'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${paymentFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentFilter(st)}
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
                <th>Shop Name</th>
                <th>Plan</th>
                <th>Amount Due / Paid</th>
                <th>Payment Method</th>
                <th>Payment Slip</th>
                <th>Payment Status</th>
                <th>Sub Status</th>
                <th>Expires Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.Tenant?.name}</b>
                    <small style={{ display: 'block', color: '#64748b' }}>{s.Tenant?.slug}</small>
                  </td>
                  <td>
                    <span className="pill pill-trial">{s.plan?.name || 'Starter'}</span>
                  </td>
                  <td>
                    <div>Due: <Money value={s.amountDue} /></div>
                    <small style={{ color: '#059669' }}>Paid: <Money value={s.amountPaid} /></small>
                  </td>
                  <td>
                    <span className="pill pill-active">{s.paymentMethod || 'Manual'}</span>
                  </td>
                  <td>
                    {s.paymentSlipUrl ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSlipModal(s)}
                        style={{ color: '#0284c7' }}
                      >
                        <ExternalLink size={13} /> View Slip
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>None</span>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${s.paymentStatus === 'paid' ? 'pill-paid' : s.paymentStatus === 'pending' ? 'pill-pending' : 'pill-rejected'}`}>
                      {s.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${s.status === 'active' ? 'pill-active' : s.status === 'trial' ? 'pill-trial' : 'pill-suspended'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>{new Date(s.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {s.paymentStatus === 'pending' && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(s.id)}
                            title="Approve Payment"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(s.id)}
                            title="Reject Payment"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Subscription / Expiry Date"
                      >
                        <Calendar size={13} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {subs.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      <Modal
        isOpen={!!slipModal}
        onClose={() => setSlipModal(null)}
        title={`Payment Slip — ${slipModal?.Tenant?.name}`}
        maxWidth="500px"
      >
        {slipModal && (
          <div>
            <div style={{ marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', minHeight: '200px' }}>
              <img
                src={slipModal.paymentSlipUrl}
                alt="Payment Slip"
                style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '13px' }}>
              <div><b>Plan:</b> {slipModal.plan?.name}</div>
              <div><b>Amount:</b> <Money value={slipModal.amountDue} /></div>
              <div><b>Method:</b> {slipModal.paymentMethod}</div>
              <div><b>Status:</b> {slipModal.paymentStatus}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {slipModal.paymentStatus === 'pending' && (
                <>
                  <button className="btn btn-success" onClick={() => { handleApprove(slipModal.id); setSlipModal(null); }}>
                    Approve Payment
                  </button>
                  <button className="btn btn-danger" onClick={() => { handleReject(slipModal.id); setSlipModal(null); }}>
                    Reject
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setSlipModal(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Expiry Modal */}
      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title="Edit Subscription Details"
        maxWidth="440px"
      >
        {editModal && (
          <form onSubmit={handleSaveEdit}>
            <div className="form-group">
              <label>Subscription Status</label>
              <select
                className="form-select"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="form-group">
              <label>Expiration Date</label>
              <input
                type="date"
                required
                className="form-input"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
