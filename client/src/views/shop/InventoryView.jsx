import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import { Boxes, ArrowUpDown, History, PlusCircle, MinusCircle } from 'lucide-react';

export function InventoryView() {
  const { t } = useI18n();
  const [data, setData] = useState({ products: [], movements: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stocks'); // 'stocks' | 'movements'
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'IN', quantity: 1, note: '' });

  const loadInventory = () => {
    setLoading(true);
    api('/inventory')
      .then(setData)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleOpenAdjust = (p) => {
    setAdjustModal(p);
    setAdjustForm({ type: 'IN', quantity: 5, note: 'Stock restock audit' });
  };

  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    if (!adjustModal.variantId) {
      alert('Product variant missing');
      return;
    }

    try {
      await api('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          variantId: adjustModal.variantId,
          type: adjustForm.type,
          quantity: Number(adjustForm.quantity),
          note: adjustForm.note
        })
      });
      setAdjustModal(null);
      loadInventory();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('inventory')}</h1>
          <p>Monitor warehouse quantities, restock levels, and audit physical inventory movements</p>
        </div>
      </div>

      <div className="tabs-bar">
        <button
          className={`tab-item ${activeTab === 'stocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          <Boxes size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Current Stock Levels
        </button>
        <button
          className={`tab-item ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          <History size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Movement History Logs ({data.movements?.length || 0})
        </button>
      </div>

      {activeTab === 'stocks' && (
        <div className="panel">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Threshold Alert</th>
                  <th>Inventory Status</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(data.products || []).map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td><code>{p.sku || '—'}</code></td>
                    <td><b style={{ fontSize: '14px' }}>{p.stock} units</b></td>
                    <td>≤ {p.lowStockAt} units</td>
                    <td>
                      <span className={`pill ${p.stock <= p.lowStockAt ? 'pill-stock-low' : 'pill-stock-ok'}`}>
                        {p.stock <= p.lowStockAt ? 'Low Stock Warning' : 'Optimal'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenAdjust(p)}>
                        <ArrowUpDown size={13} /> Adjust Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="panel">
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Movement Type</th>
                  <th>Quantity</th>
                  <th>Branch</th>
                  <th>Audit Note / Reason</th>
                </tr>
              </thead>
              <tbody>
                {(data.movements || []).map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td><b>{m.productName}</b></td>
                    <td>
                      <span className={`pill ${m.type === 'IN' ? 'pill-active' : 'pill-cancelled'}`}>
                        {m.type === 'IN' ? '+ Stock IN' : '- Stock OUT'}
                      </span>
                    </td>
                    <td><b>{m.quantity} units</b></td>
                    <td>{m.branch}</td>
                    <td>{m.note || '—'}</td>
                  </tr>
                ))}
                {(!data.movements || data.movements.length === 0) && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                      {t('noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={!!adjustModal}
        onClose={() => setAdjustModal(null)}
        title={`Adjust Stock — ${adjustModal?.name}`}
        maxWidth="440px"
      >
        {adjustModal && (
          <form onSubmit={handleSaveAdjust}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <div>Current Stock: <b>{adjustModal.stock} units</b></div>
            </div>

            <div className="form-group">
              <label>Adjustment Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn ${adjustForm.type === 'IN' ? 'btn-success' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'IN' })}
                >
                  <PlusCircle size={15} /> Increase (+IN)
                </button>
                <button
                  type="button"
                  className={`btn ${adjustForm.type === 'OUT' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setAdjustForm({ ...adjustForm, type: 'OUT' })}
                >
                  <MinusCircle size={15} /> Decrease (-OUT)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                required
                className="form-input"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Reason / Audit Note *</label>
              <input
                required
                className="form-input"
                placeholder="e.g. Supplier delivery, damaged items, stock audit"
                value={adjustForm.note}
                onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAdjustModal(null)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                Save Adjustment
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
