import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Plus, Trash2, Receipt } from 'lucide-react';

export function ExpensesView() {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', description: '', createdAt: '' });

  const loadExpenses = () => {
    setLoading(true);
    api('/expenses')
      .then(setExpenses)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleOpenAdd = () => {
    setForm({
      title: '',
      amount: '',
      description: '',
      createdAt: new Date().toISOString().slice(0, 10)
    });
    setModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          amount: Number(form.amount),
          description: form.description,
          createdAt: form.createdAt ? new Date(form.createdAt).toISOString() : undefined
        })
      });
      setModalOpen(false);
      loadExpenses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete expense record '${title}'?`)) return;
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' });
      loadExpenses();
    } catch (err) {
      alert(err.message);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('expenses')}</h1>
          <p>Track store operational costs, utility bills, packaging, and employee allowances</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="panel" style={{ background: '#f8fafc', borderLeft: '4px solid #6366f1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>TOTAL RECORDED EXPENSES</span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
              <Money value={totalExpenseAmount} />
            </h2>
          </div>
          <span className="pill pill-trial">{expenses.length} Records</span>
        </div>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Expense Title</th>
                <th>Amount (MMK)</th>
                <th>Description / Notes</th>
                <th>Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.title}</b></td>
                  <td><b style={{ color: '#ef4444' }}><Money value={e.amount} /></b></td>
                  <td>{e.description || '—'}</td>
                  <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(e.id, e.title)}>
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
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
        title="Record Store Expense"
        maxWidth="440px"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Expense Title *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Shop Electricity Bill, Packaging tape"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Amount (MMK) *</label>
            <input
              type="number"
              min="1"
              required
              className="form-input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              className="form-input"
              value={form.createdAt}
              onChange={(e) => setForm({ ...form, createdAt: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Description / Notes</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="Optional invoice number, supplier details..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
