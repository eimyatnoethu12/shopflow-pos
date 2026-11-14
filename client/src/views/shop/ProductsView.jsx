import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Plus, Search, Edit2, Trash2, Layers, AlertCircle } from 'lucide-react';

export function ProductsView() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    description: '',
    costPrice: 0,
    sellingPrice: 0,
    stock: 0
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/products'),
      api('/categories')
    ]).then(([prods, cats]) => {
      setProducts(prods);
      setCategories(cats);
    }).catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      sku: '',
      categoryId: categories[0]?.id || '',
      description: '',
      costPrice: 0,
      sellingPrice: 0,
      stock: 0
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      categoryId: p.categoryId || '',
      description: p.description || '',
      costPrice: p.costPrice || 0,
      sellingPrice: p.sellingPrice || 0,
      stock: p.stock || 0
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api(`/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form)
        });
      } else {
        await api('/products', {
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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Archive product '${name}'? It will no longer appear in POS sales.`)) return;
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = catFilter === 'all' || p.categoryId === catFilter;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('products')}</h1>
          <p>Manage product catalog, pricing, cost, barcodes, and inventory levels</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> {t('addProduct')}
        </button>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="search-box" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t('productName')}</th>
                <th>{t('sku')}</th>
                <th>{t('category')}</th>
                <th>{t('costPrice')}</th>
                <th>{t('sellingPrice')}</th>
                <th>{t('initialStock')}</th>
                <th>Margin</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const margin = p.sellingPrice > 0 ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0) : 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      {p.description && (
                        <small style={{ display: 'block', color: '#64748b' }}>{p.description}</small>
                      )}
                    </td>
                    <td><code>{p.sku || '—'}</code></td>
                    <td>
                      <span className="pill pill-trial">{p.category?.name || 'Uncategorized'}</span>
                    </td>
                    <td><Money value={p.costPrice} /></td>
                    <td><b style={{ color: '#0f172a' }}><Money value={p.sellingPrice} /></b></td>
                    <td>
                      <span className={`pill ${p.stock <= p.lowStockAt ? 'pill-stock-low' : 'pill-stock-ok'}`}>
                        {p.stock} units
                      </span>
                    </td>
                    <td>
                      <span style={{ color: margin > 20 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                        {margin}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(p)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(p.id, p.name)}>
                          <Trash2 size={13} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? t('editProduct') : t('addProduct')}
        maxWidth="540px"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('productName')} *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Royal Myanmar Teamix 30s"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>{t('sku')} (Unique Barcode)</label>
              <input
                className="form-input"
                placeholder="Leave blank to auto-generate"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t('category')}</label>
              <select
                className="form-select"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>{t('costPrice')} (MMK)</label>
              <input
                type="number"
                min="0"
                required
                className="form-input"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t('sellingPrice')} (MMK) *</label>
              <input
                type="number"
                min="0"
                required
                className="form-input"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{t('initialStock')} Units</label>
              <input
                type="number"
                min="0"
                required
                className="form-input"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('description')}</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="Optional notes or details..."
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
