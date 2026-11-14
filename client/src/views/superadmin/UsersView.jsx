import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import {
  Shield,
  ShieldAlert,
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  Lock,
  UserCheck,
  Check
} from 'lucide-react';

export function UsersView({ session }) {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    isPlatformAdmin: false
  });

  const currentUserId = session?.user?.id;

  const loadUsers = () => {
    setLoading(true);
    api('/admin/users')
      .then(setUsers)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm({
      name: '',
      email: '',
      password: '',
      isPlatformAdmin: false
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '', // Blank unless super admin wishes to overwrite
      isPlatformAdmin: Boolean(u.isPlatformAdmin)
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload = {
          name: form.name,
          email: form.email,
          isPlatformAdmin: form.isPlatformAdmin
        };
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }
        await api(`/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await api('/admin/users', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickReset = async (e) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api(`/admin/users/${resetModal.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword })
      });
      alert(`Password for ${resetModal.name} has been reset successfully!`);
      setResetModal(null);
      setResetPassword('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u) => {
    if (u.id === currentUserId) {
      alert('You cannot delete your own Super Admin account.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user '${u.name}' (${u.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      await api(`/admin/users/${u.id}`, {
        method: 'DELETE'
      });
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAdmin = async (u) => {
    if (u.id === currentUserId && u.isPlatformAdmin) {
      if (!window.confirm('Warning: Revoking Super Admin from your own active session will log you out of Super Admin! Proceed?')) {
        return;
      }
    }
    const nextAdmin = !u.isPlatformAdmin;
    const confirmMsg = nextAdmin
      ? `Promote '${u.name}' (${u.email}) to Platform Super Admin?`
      : `Remove Super Admin privileges from '${u.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPlatformAdmin: nextAdmin })
      });
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.shops && u.shops.some((s) => s.name?.toLowerCase().includes(q)))
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('platformUsers')}</h1>
          <p>Global directory of registered accounts, tenant affiliations, roles, and password management</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-super" onClick={handleOpenAdd}>
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="panel" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={18} color="#94a3b8" />
          <input
            className="form-input"
            style={{ maxWidth: '380px' }}
            placeholder="Search by user name, email, or shop name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSearch('')}
            >
              Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
            Total Users: <b>{filteredUsers.length}</b>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User Details</th>
                <th>Platform Role</th>
                <th>Associated Shops</th>
                <th>Joined Date</th>
                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <b>{u.name}</b>
                          {isSelf && (
                            <span
                              className="pill pill-active"
                              style={{ marginLeft: '6px', fontSize: '10px', background: '#dbeafe', color: '#1d4ed8' }}
                            >
                              You
                            </span>
                          )}
                          <small style={{ display: 'block', color: '#64748b' }}>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.isPlatformAdmin ? (
                        <span className="pill pill-active" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                          <Shield size={12} /> Super Admin
                        </span>
                      ) : (
                        <span className="pill pill-trial">Shop User</span>
                      )}
                    </td>
                    <td>
                      {u.shops && u.shops.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {u.shops.map((s) => (
                            <span key={s.tenantId} className="pill pill-active" style={{ fontSize: '10px' }}>
                              <Store size={10} /> {s.name} ({s.role})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>None</span>
                      )}
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Quick Password Reset */}
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Reset User Password"
                          onClick={() => {
                            setResetModal(u);
                            setResetPassword('');
                          }}
                        >
                          <KeyRound size={14} /> Password
                        </button>

                        {/* Edit User details */}
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Edit User Profile"
                          onClick={() => handleOpenEdit(u)}
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Toggle Super Admin */}
                        <button
                          className={`btn btn-sm ${u.isPlatformAdmin ? 'btn-secondary' : 'btn-super'}`}
                          title={u.isPlatformAdmin ? 'Revoke Super Admin' : 'Make Super Admin'}
                          onClick={() => handleToggleAdmin(u)}
                        >
                          {u.isPlatformAdmin ? 'Revoke SA' : 'Make SA'}
                        </button>

                        {/* Delete User */}
                        {!isSelf && (
                          <button
                            className="btn btn-sm btn-danger"
                            title="Delete User"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    {search ? 'No users matching your search.' : t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Ko Aung"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>
              {editingUser ? 'New Password (leave blank to keep unchanged)' : 'Initial Password *'}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={editingUser ? '••••••••' : 'Minimum 6 characters'}
              required={!editingUser}
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {editingUser && (
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                Only enter a password if you want to reset this user's password directly.
              </small>
            )}
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isPlatformAdmin}
                onChange={(e) => setForm({ ...form, isPlatformAdmin: e.target.checked })}
              />
              <span style={{ fontWeight: 600, color: '#0369a1' }}>
                Grant Platform Super Admin Privileges
              </span>
            </label>
            <small style={{ color: '#64748b', marginLeft: '24px', display: 'block', fontSize: '12px' }}>
              Super Admins have full control over all shops, subscriptions, plans, and platform settings.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-super"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Password Reset Modal */}
      <Modal
        title={`Reset Password: ${resetModal?.name}`}
        isOpen={!!resetModal}
        onClose={() => setResetModal(null)}
        maxWidth="440px"
      >
        <form onSubmit={handleQuickReset}>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', color: '#475569' }}>
              User Account: <b>{resetModal?.name}</b>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Email: <b>{resetModal?.email}</b>
            </div>
          </div>

          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              className="form-input"
              placeholder="Enter new password (min 6 chars)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoFocus
            />
            <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              The user can immediately log in with this new password.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setResetModal(null)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-super"
              disabled={submitting}
            >
              <KeyRound size={14} /> {submitting ? 'Resetting...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}