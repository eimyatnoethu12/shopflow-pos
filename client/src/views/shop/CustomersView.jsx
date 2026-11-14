import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Phone, MapPin, Users } from 'lucide-react';

export function CustomersView() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCust, setEditingCust] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const loadCustomers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());

    api(`/customers?${params.toString()}`)
      .then(setCustomers)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenAdd = () => {
    setEditingCust(null);
    setForm({ name: '', phone: '', address: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCust(c);
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCust) {
        await api(`/customers/${editingCust.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form)
        });
      } else {
        await api('/customers', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      setModalOpen(false);
      loadCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('customers')}</h1>
          <p>Maintain customer profiles, phone numbers, delivery addresses, and spending histories</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="search-box" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Delivery Address</th>
                <th>Total Orders</th>
                <th>Total Spent (MMK)</th>
                <th>Joined Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.address || '—'}</td>
                  <td>
                    <span className="pill pill-trial">{c.ordersCount || 0} orders</span>
                  </td>
                  <td>
                    <b><Money value={c.totalSpent} /></b>
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(c)}>
                      <Edit2 size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCust ? 'Edit Customer' : 'Add New Customer'}
        maxWidth="440px"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Customer Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Daw Khin Myint"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              className="form-input"
              placeholder="e.g. 09 799 123 456"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Delivery Address</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="e.g. No. 12, Kamayut Township, Yangon"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
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
    </div>
  );
}
