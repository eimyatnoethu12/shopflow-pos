import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle, Printer } from 'lucide-react';

export function PosView() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const loadData = () => {
    Promise.all([
      api('/products'),
      api('/categories'),
      api('/customers')
    ]).then(([prods, cats, custs]) => {
      setProducts(prods);
      setCategories(cats);
      setCustomers(custs);
    }).catch((err) => alert(err.message));
  };

  useEffect(() => {
    loadData();
  }, []);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert(`'${product.name}' is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Cannot add more than available stock (${product.stock} units)`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              alert(`Maximum available stock is ${item.product.stock}`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );
  const grandTotal = Math.max(0, subtotal - Number(discount || 0) + Number(deliveryFee || 0));

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please select products to sell.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: customerId || null,
        discount: Number(discount || 0),
        deliveryFee: Number(deliveryFee || 0),
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity
        }))
      };

      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setCompletedOrder(order);
      setCart([]);
      setDiscount(0);
      setDeliveryFee(0);
      setCustomerId('');
      loadData(); // refresh stock
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCat === 'all' || p.categoryId === selectedCat;
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="pos-container">
      {/* Product Catalog Side */}
      <div className="panel pos-catalog-panel">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={16} />
            <input
              placeholder="Search product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${selectedCat === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCat('all')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`btn btn-sm ${selectedCat === c.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCat(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pos-products-grid">
          {filteredProducts.map((p) => {
            const inCart = cart.find((c) => c.product.id === p.id);
            return (
              <div
                key={p.id}
                className={`pos-product-item ${p.stock <= 0 ? 'out-of-stock' : ''}`}
                onClick={() => addToCart(p)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <small style={{ color: '#64748b', fontSize: '10px' }}>{p.sku || 'SKU'}</small>
                    <span className={`pill ${p.stock <= p.lowStockAt ? 'pill-stock-low' : 'pill-stock-ok'}`} style={{ fontSize: '9px' }}>
                      {p.stock} left
                    </span>
                  </div>
                  <b>{p.name}</b>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '13px' }}>
                    <Money value={p.sellingPrice} />
                  </span>
                  {inCart && (
                    <span className="pill pill-active" style={{ fontSize: '10px' }}>
                      In Cart: {inCart.quantity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No products found matching search.
            </div>
          )}
        </div>
      </div>

      {/* POS Cart Register Side */}
      <div className="panel pos-cart-panel">
        <div className="panel-head" style={{ marginBottom: '12px' }}>
          <h3>Current Sale ({cart.reduce((s, i) => s + i.quantity, 0)} items)</h3>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Customer Select */}
        <div style={{ marginBottom: '12px' }}>
          <select
            className="form-select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Walk-in Customer (အထွေထွေဝယ်ယူသူ)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Cart Item Rows */}
        <div className="pos-cart-items">
          {cart.map((item) => (
            <div key={item.product.id} className="cart-item-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: '12px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.product.name}
                </b>
                <small style={{ color: '#64748b' }}>
                  <Money value={item.product.sellingPrice} /> × {item.quantity} = <b><Money value={item.product.sellingPrice * item.quantity} /></b>
                </small>
              </div>

              <div className="qty-control">
                <button className="qty-btn" onClick={() => updateQuantity(item.product.id, -1)}>
                  <Minus size={12} />
                </button>
                <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>
                  {item.quantity}
                </span>
                <button className="qty-btn" onClick={() => updateQuantity(item.product.id, 1)}>
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '4px' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
              <ShoppingCart size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <div>Cart is empty</div>
              <small>Click products on the left to add items</small>
            </div>
          )}
        </div>

        {/* Checkout Summary & Payment Options */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b' }}>{t('discount')} (MMK)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b' }}>{t('deliveryFee')} (MMK)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
              {t('paymentMethod')}
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['CASH', 'KBZPay', 'WavePay', 'AYA Pay', 'CB Pay'].map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMethod(pm)}
                  className={`btn btn-sm ${paymentMethod === pm ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '5px 4px', fontSize: '11px' }}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{t('total')}:</span>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
              <Money value={grandTotal} />
            </span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px' }}
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
          >
            {submitting ? 'Recording Sale...' : `${t('completeSale')} (${grandTotal.toLocaleString()} MMK)`}
          </button>
        </div>
      </div>

      {/* Sale Receipt Modal */}
      <Modal
        isOpen={!!completedOrder}
        onClose={() => setCompletedOrder(null)}
        title="Sale Completed Successfully!"
        maxWidth="440px"
      >
        {completedOrder && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
              <CheckCircle size={28} />
            </div>

            <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{completedOrder.orderNumber}</h3>
            <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '16px' }}>
              {new Date(completedOrder.createdAt).toLocaleString()}
            </p>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', textAlign: 'left', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                {(completedOrder.items || []).map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{item.productName} × {item.quantity}</span>
                    <b><Money value={item.total} /></b>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Subtotal:</span>
                <span><Money value={completedOrder.subtotal} /></span>
              </div>
              {completedOrder.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#10b981' }}>
                  <span>Discount:</span>
                  <span>-<Money value={completedOrder.discount} /></span>
                </div>
              )}
              {completedOrder.deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Delivery Fee:</span>
                  <span>+<Money value={completedOrder.deliveryFee} /></span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '6px', fontSize: '15px' }}>
                <b>Total:</b>
                <b style={{ color: '#6366f1' }}><Money value={completedOrder.total} /></b>
              </div>

              <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
                Payment: <b>{completedOrder.paymentMethod}</b> ({completedOrder.paymentStatus})
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                <Printer size={15} /> Print Receipt
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setCompletedOrder(null)}
              >
                Next Sale
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
