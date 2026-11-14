import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { CreditCard, CheckCircle2, ShieldCheck, Clock, Send, Upload } from 'lucide-react';

export function SubscriptionView() {
  const { t } = useI18n();
  const [current, setCurrent] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    planId: '',
    paymentMethod: 'KBZPay',
    paymentSlipUrl: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/subscriptions/current'),
      api('/subscriptions/plans')
    ]).then(([cur, pls]) => {
      setCurrent(cur);
      setPlans(pls);
      if (pls.length > 0 && !form.planId) {
        setForm((prev) => ({ ...prev, planId: pls[0].id }));
      }
    }).catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenUpgrade = (planId) => {
    setForm({
      planId: planId || (plans[0]?.id || ''),
      paymentMethod: 'KBZPay',
      paymentSlipUrl: ''
    });
    setModalOpen(true);
  };

  const handleUpgradeSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api('/subscriptions/request', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      alert('Subscription renewal/upgrade request submitted! Super Admin will verify your payment slip.');
      setModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('subscription')}</h1>
          <p>View your active SaaS license, days remaining, and renew plans</p>
        </div>
      </div>

      {/* Current Subscription Card */}
      <div className="panel" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: 'white', border: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="pill pill-active" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
                {current?.status || 'TRIAL'}
              </span>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>CURRENT ACTIVE PLAN</span>
            </div>

            <h2 style={{ fontSize: '28px', fontWeight: 800 }}>
              {current?.plan?.name || 'Starter'} Plan
            </h2>

            <p style={{ opacity: 0.85, fontSize: '13px', marginTop: '4px' }}>
              Expires on {current?.expiresAt ? new Date(current.expiresAt).toLocaleDateString() : '—'}
              {' '}(<b>{current?.daysLeft > 0 ? `${current.daysLeft} days remaining` : 'Expired'}</b>)
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 800 }}>
              <Money value={current?.plan?.priceMonthly || 15000} />
            </div>
            <small style={{ opacity: 0.7 }}>Billed every 30 days</small>
            <div style={{ marginTop: '12px' }}>
              <button
                className="btn btn-primary"
                style={{ background: '#6366f1', color: 'white' }}
                onClick={() => handleOpenUpgrade(current?.planId)}
              >
                Renew or Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <div className="page-header" style={{ marginTop: '30px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Available SaaS Plans</h2>
          <p>Choose the right scale for your growing shop</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {plans.map((p) => {
          const isCurrentPlan = current?.planId === p.id;
          return (
            <div key={p.id} className="panel" style={{ border: isCurrentPlan ? '2px solid #6366f1' : '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{p.name}</h3>
                {isCurrentPlan && <span className="pill pill-active">Current Plan</span>}
              </div>

              <div style={{ margin: '14px 0' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                  <Money value={p.priceMonthly} />
                </span>
                <span style={{ color: '#64748b', fontSize: '12px' }}> / {p.durationDays} days</span>
              </div>

              <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Up to {p.maxProducts.toLocaleString()} Products catalog</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Up to {p.maxStaff} Staff & Cashier accounts</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Multi-branch inventory synchronization</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Sales & Profit & Loss reports</span>
                </div>
              </div>

              <button
                className={`btn ${isCurrentPlan ? 'btn-secondary' : 'btn-primary'}`}
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => handleOpenUpgrade(p.id)}
              >
                {isCurrentPlan ? 'Renew Current Plan' : `Upgrade to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Upgrade / Payment Slip Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Submit Subscription Payment Proof"
        maxWidth="480px"
      >
        <form onSubmit={handleUpgradeSubmit}>
          <div className="form-group">
            <label>Select Plan</label>
            <select
              className="form-select"
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceMonthly.toLocaleString()} MMK ({p.durationDays} days)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Payment Method (KBZPay / WavePay)</label>
            <select
              className="form-select"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              <option value="KBZPay">KBZPay (09 799 000 123)</option>
              <option value="WavePay">WavePay (09 799 000 123)</option>
              <option value="AYA Pay">AYA Pay (09 799 000 123)</option>
              <option value="CB Pay">CB Pay (09 799 000 123)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Payment Slip Image URL / Transaction Ref *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Transaction ID or Screenshot URL"
              value={form.paymentSlipUrl}
              onChange={(e) => setForm({ ...form, paymentSlipUrl: e.target.value })}
            />
            <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
              Transfer the plan fee and provide the transaction reference or image link for Super Admin approval.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Payment Proof'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
