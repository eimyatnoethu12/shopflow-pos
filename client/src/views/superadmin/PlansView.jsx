import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Plus, Edit2, Layers, CheckCircle2 } from 'lucide-react';

export function PlansView() {
  const { t } = useI18n();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState({ name: '', price: 15000, durationDays: 30, isActive: true });

  const loadPlans = () => {
    setLoading(true);
    api('/admin/plans')
      .then(setPlans)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setForm({ name: '', price: 20000, durationDays: 30, isActive: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPlan(p);
    setForm({
      name: p.name,
      price: p.price,
      durationDays: p.durationDays,
      isActive: p.isActive
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan) {
        await api(`/admin/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form)
        });
      } else {
        await api('/admin/plans', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      setModalOpen(false);
      loadPlans();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('plansManagement')}</h1>
          <p>Configure SaaS tier prices, validity durations, and subscription packages</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} /> {t('addPlan')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {plans.map((p) => (
          <div key={p.id} className="panel" style={{ borderTop: p.name === 'Business' ? '4px solid #8b5cf6' : p.name === 'Standard' ? '4px solid #0284c7' : '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span className="pill pill-trial" style={{ marginBottom: '8px' }}>
                  {p.isActive ? 'Active Plan' : 'Disabled'}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{p.name}</h2>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(p)}>
                <Edit2 size={13} /> Edit
              </button>
            </div>

            <div style={{ margin: '18px 0' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                <Money value={p.price} />
              </div>
              <small style={{ color: '#64748b' }}>Billed every {p.durationDays} days</small>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px', fontSize: '13px', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>{p.subscriptionsCount || 0} subscriptions subscribed</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Standard {p.durationDays} days access</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Form Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? 'Edit Plan' : 'Create New Subscription Plan'}
        maxWidth="440px"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Plan Name</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Starter, Pro, Enterprise"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('planPrice')}</label>
            <input
              type="number"
              min="0"
              required
              className="form-input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t('planDuration')}</label>
            <input
              type="number"
              min="1"
              required
              className="form-input"
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="isActivePlan"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <label htmlFor="isActivePlan" style={{ margin: 0, cursor: 'pointer' }}>Active and Available for Shops</label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
