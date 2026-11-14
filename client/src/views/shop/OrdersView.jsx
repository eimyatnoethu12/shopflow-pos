import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { Money } from '../../components/Money';
import { Modal } from '../../components/Modal';
import { Search, Eye, Filter, ShoppingBag } from 'lucide-react';

export function OrdersView() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (search.trim()) params.append('search', search.trim());

    api(`/orders?${params.toString()}`)
      .then(setOrders)
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (newStatus === 'CANCELLED') {
      if (!window.confirm('Cancelling this order will automatically RESTOCK all item quantities back to inventory. Continue?')) {
        return;
      }
    }

    try {
      await api(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('orders')}</h1>
          <p>Track customer orders, delivery fulfillment statuses, and payment records</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div className="search-box" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input
              placeholder="Search by order # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'CONFIRMED', 'PENDING', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Total (MMK)</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.orderNumber}</b></td>
                  <td>{o.customer?.name || 'Walk-in Customer'}</td>
                  <td>{o.items?.length || 0} items</td>
                  <td><b><Money value={o.total} /></b></td>
                  <td>
                    <span className="pill pill-active">{o.paymentMethod}</span>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '11px', width: 'auto' }}
                      value={o.status}
                      disabled={o.status === 'CANCELLED' || o.status === 'DELIVERED'}
                      onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                    >
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="PACKING">PACKING</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && (
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

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details — ${selectedOrder?.orderNumber}`}
        maxWidth="520px"
      >
        {selectedOrder && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
              <div>
                <small style={{ color: '#64748b' }}>CUSTOMER</small>
                <div><b>{selectedOrder.customer?.name || 'Walk-in Customer'}</b></div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>{selectedOrder.customer?.phone || 'No phone'}</div>
              </div>

              <div>
                <small style={{ color: '#64748b' }}>PAYMENT</small>
                <div><b>{selectedOrder.paymentMethod}</b> ({selectedOrder.paymentStatus})</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>Date: {new Date(selectedOrder.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Order Items</h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.productName}</b></td>
                      <td>{item.quantity}</td>
                      <td><Money value={item.unitPrice} /></td>
                      <td><b><Money value={item.total} /></b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Subtotal:</span>
                <span><Money value={selectedOrder.subtotal} /></span>
              </div>
              {selectedOrder.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                  <span>Discount:</span>
                  <span>-<Money value={selectedOrder.discount} /></span>
                </div>
              )}
              {selectedOrder.deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Delivery Fee:</span>
                  <span>+<Money value={selectedOrder.deliveryFee} /></span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                <span>Total:</span>
                <span style={{ color: '#6366f1' }}><Money value={selectedOrder.total} /></span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
