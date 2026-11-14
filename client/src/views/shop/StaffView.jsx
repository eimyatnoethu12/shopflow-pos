import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import { Plus, UserCheck, Shield, Trash2, Edit2, KeyRound, Check } from 'lucide-react';

export function StaffView() {
  const { t } = useI18n();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
    branchId: '',
    permissions: {
      pos: true,
      inventory: false,
      orders: true,
      customers: false,
      reports: false,
      manageStaff: false
    }
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/staff'),
      api('/branches')
    ]).then(([st, br]) => {
      setStaff(st);
      setBranches(br);
    }).catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'cashier',
      branchId: branches[0]?.id || '',
      permissions: {
        pos: true,
        inventory: false,
        orders: true,
        customers: false,
        reports: false,
        manageStaff: false
      }
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (s) => {
    setEditingStaff(s);
    setForm({
      name: s.User?.name || '',
      email: s.User?.email || '',
      password: '', // blank unless changing
      role: s.role,
      branchId: s.branchId || '',
      permissions: s.permissions || {
        pos: true,
        inventory: false,
        orders: true,
        customers: false,
        reports: false,
        manageStaff: false
      }
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStaff) {
        const payload = {
          name: form.name,
          role: form.role,
          branchId: form.branchId || null,
          permissions: form.permissions
        };
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }

        await api(`/staff/${editingStaff.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await api('/staff', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenReset = (s) => {
    setResetModal(s);
    setResetPassword('');
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setResetLoading(true);
      const res = await api(`/staff/${resetModal.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword })
      });
      alert(res.message || 'Password reset successfully!');
      setResetModal(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove staff member '${name}' from shop?`)) return;
    try {
      await api(`/staff/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('staff')}</h1>
          <p>Cashier accounts, manager permissions, and branch assignments</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Staff Account
        </button>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Assigned Branch</th>
                <th>Granular Permissions</th>
                <th>Joined Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.User?.name}</b>
                    <small style={{ display: 'block', color: '#64748b' }}>{s.User?.email}</small>
                  </td>
                  <td>
                    <span className={`pill ${s.role === 'owner' ? 'pill-active' : 'pill-trial'}`}>
                      {s.role.toUpperCase()}
                    </span>
                  </td>
                  <td>{s.Branch?.name || 'All Branches'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {Object.entries(s.permissions || {}).map(([k, v]) =>
                        v ? (
                          <span key={k} className="pill pill-active" style={{ fontSize: '10px' }}>
                            {k}
                          </span>
                        ) : null
                      )}
                    </div>
                  </td>
                  <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenReset(s)}
                        title="Reset Staff Password"
                        style={{ color: '#d97706' }}
                      >
                        <KeyRound size={13} /> Password
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Details & Permissions"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                      {s.role !== 'owner' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(s.id, s.User?.name)}
                          title="Remove Staff"
                        >
                          <Trash2 size={13} color="#ef4444" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStaff ? `Edit Staff — ${editingStaff.User?.name}` : 'Create Staff Member'}
        maxWidth="500px"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Ko Min Thu"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {!editingStaff ? (
            <>
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  placeholder="staff@mybusiness.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="form-input"
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Reset Password (Optional)</label>
              <input
                type="password"
                minLength={6}
                className="form-input"
                placeholder="Leave blank to keep existing password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                Enter a new password if you want to reset this staff member's login credentials.
              </small>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Role</label>
              <select
                className="form-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
                {editingStaff?.role === 'owner' && <option value="owner">Owner</option>}
              </select>
            </div>

            <div className="form-group">
              <label>Assigned Branch</label>
              <select
                className="form-select"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label style={{ marginBottom: '8px' }}>Feature Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
              {[
                ['pos', 'POS Cashier Access'],
                ['orders', 'Manage Orders'],
                ['inventory', 'Manage Products & Stock'],
                ['customers', 'Customer Directory'],
                ['reports', 'Financial Reports'],
                ['manageStaff', 'Manage Staff & Roles']
              ].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    id={`perm_${key}`}
                    checked={form.permissions[key] || false}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        permissions: { ...form.permissions, [key]: e.target.checked }
                      })
                    }
                  />
                  <label htmlFor={`perm_${key}`} style={{ margin: 0, fontSize: '12px', cursor: 'pointer' }}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Password Reset Modal */}
      <Modal
        isOpen={!!resetModal}
        onClose={() => setResetModal(null)}
        title={`Reset Password — ${resetModal?.User?.name}`}
        maxWidth="420px"
      >
        {resetModal && (
          <form onSubmit={handleResetSubmit}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div>Staff Account: <b>{resetModal.User?.name}</b></div>
              <small style={{ color: '#64748b' }}>{resetModal.User?.email}</small>
            </div>

            <div className="form-group">
              <label>New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                className="form-input"
                placeholder="Enter new password (min. 6 chars)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setResetModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                {resetLoading ? 'Saving...' : 'Set New Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
