import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Modal } from '../../components/Modal';
import { Plus, Trash2, Layers } from 'lucide-react';

export function CategoriesView() {
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  const loadCategories = () => {
    setLoading(true);
    api('/categories')
      .then(setCategories)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      });
      setName('');
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, catName) => {
    if (!window.confirm(`Delete category '${catName}'?`)) return;
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('categories')}</h1>
          <p>Organize products into functional catalog groups for POS cashier search</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Products Count</th>
                <th>Created Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} color="#6366f1" />
                      <b>{c.name}</b>
                    </div>
                  </td>
                  <td>
                    <span className="pill pill-active">{c.productsCount || 0} products</span>
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDelete(c.id, c.name)}
                    >
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
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
        title="Add Product Category"
        maxWidth="400px"
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Category Name</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Beverages, Bakery, Cosmetics"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
