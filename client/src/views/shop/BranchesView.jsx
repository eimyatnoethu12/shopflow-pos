import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import { Plus, GitBranch, MapPin, Phone, Building } from 'lucide-react';

export function BranchesView() {
  const { t } = useI18n();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', isMain: false });

  const loadBranches = () => {
    setLoading(true);
    api('/branches')
      .then(setBranches)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api('/branches', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ name: '', address: '', phone: '', isMain: false });
      setModalOpen(false);
      loadBranches();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('branches')}</h1>
          <p>Multi-location branch management and store locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Branch
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {branches.map((b) => (
          <div key={b.id} className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eef2ff', color: '#6366f1', display: 'grid', placeItems: 'center' }}>
                  <Building size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', margin: 0 }}>{b.name}</h3>
                  {b.isMain && <span className="pill pill-active" style={{ fontSize: '10px' }}>Main Headquarters</span>}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px', margin: '14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} color="#94a3b8" />
                <span>{b.address || 'No address registered'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#94a3b8" />
                <span>{b.phone || 'No phone registered'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '12px', color: '#64748b' }}>
              {b._count?.Order || 0} orders processed • {b._count?.TenantUser || 0} assigned staff
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Store Branch"
        maxWidth="440px"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Branch Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Mandalay 78th St Branch"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <input
              className="form-input"
              placeholder="e.g. 78th St, Chan Aye Thar Zan"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Contact Phone</label>
            <input
              className="form-input"
              placeholder="e.g. 09 420 000 111"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="isMainBranch"
              checked={form.isMain}
              onChange={(e) => setForm({ ...form, isMain: e.target.checked })}
            />
            <label htmlFor="isMainBranch" style={{ margin: 0, cursor: 'pointer' }}>Mark as Main Branch</label>
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
