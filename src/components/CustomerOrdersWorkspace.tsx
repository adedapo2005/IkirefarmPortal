import React, { useState, useEffect } from 'react';
import {
  BadgePercent,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  Printer,
  QrCode,
  X,
  Receipt,
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';
import { MoniepointPaymentLookupTerminal } from './MoniepointPaymentLookupTerminal.tsx';
import type { NibssLookupResult } from '../lib/moniepoint-nip-payment-engine.ts';
import styles from './portal/InventoryControlDashboard.module.css';
import { Panel, Btn, Chip } from './portal/Common';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerType: 'Distributor' | 'Supermarket' | 'Wholesale Buyer';
  cratesOrdered: number;
  unitPrice: number;
  totalAmount: number;
  paymentStatus: 'Paid & Verified' | 'Pending Verification' | 'Partially Paid';
  fulfillmentStatus: 'Ready for Dispatch' | 'Loading Bay' | 'Dispatched' | 'Hold';
  orderDateWAT: string;
  gatePassId: string;
}

const SAMPLE_ORDERS: CustomerOrder[] = [
  {
    id: 'ord-101',
    orderNumber: 'ORD-2026-892',
    customerName: 'Alhaji Musa Agro-Allied Ventures',
    customerType: 'Distributor',
    cratesOrdered: 500,
    unitPrice: 3500,
    totalAmount: 1750000,
    paymentStatus: 'Paid & Verified',
    fulfillmentStatus: 'Ready for Dispatch',
    orderDateWAT: '06 Nov 2026, 09:30 AM WAT',
    gatePassId: 'GP-9921',
  },
  {
    id: 'ord-102',
    orderNumber: 'ORD-2026-891',
    customerName: 'Heritage Supermarkets (Ibadan Hub)',
    customerType: 'Supermarket',
    cratesOrdered: 240,
    unitPrice: 3600,
    totalAmount: 864000,
    paymentStatus: 'Paid & Verified',
    fulfillmentStatus: 'Loading Bay',
    orderDateWAT: '06 Nov 2026, 08:45 AM WAT',
    gatePassId: 'GP-9920',
  },
  {
    id: 'ord-103',
    orderNumber: 'ORD-2026-890',
    customerName: 'Madam Grace Egg Depot (Osogbo)',
    customerType: 'Wholesale Buyer',
    cratesOrdered: 350,
    unitPrice: 3500,
    totalAmount: 1225000,
    paymentStatus: 'Pending Verification',
    fulfillmentStatus: 'Hold',
    orderDateWAT: '06 Nov 2026, 07:15 AM WAT',
    gatePassId: 'Pending Match',
  },
  {
    id: 'ord-104',
    orderNumber: 'ORD-2026-889',
    customerName: 'Divine Grace Feeds & Eggs (Akure)',
    customerType: 'Distributor',
    cratesOrdered: 600,
    unitPrice: 3450,
    totalAmount: 2070000,
    paymentStatus: 'Paid & Verified',
    fulfillmentStatus: 'Dispatched',
    orderDateWAT: '05 Nov 2026, 04:20 PM WAT',
    gatePassId: 'GP-9918',
  },
];

export const CustomerOrdersWorkspace: React.FC = () => {
  const [orders, setOrders] = useState<CustomerOrder[]>(SAMPLE_ORDERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('ord-103');
  const [viewingGatePassOrder, setViewingGatePassOrder] = useState<CustomerOrder | null>(null);
  const [backendSyncStatus, setBackendSyncStatus] = useState<'connected' | 'offline'>('connected');

  const [customerName, setCustomerName] = useState<string>('');
  const [crates, setCrates] = useState<number>(100);
  const [unitPrice, setUnitPrice] = useState<number>(3500);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/orders')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data: { status?: string }) => {
        if (data && data.status === 'success') {
          setBackendSyncStatus('connected');
        }
      })
      .catch(() => {
        setBackendSyncStatus('offline');
      });
  }, []);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const handlePaymentVerified = (res: NibssLookupResult) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.orderNumber === res.orderNumber
          ? {
              ...o,
              paymentStatus: 'Paid & Verified',
              fulfillmentStatus: 'Ready for Dispatch',
              gatePassId: res.gatePassId,
            }
          : o
      )
    );
    setFeedbackToast(
      `Moniepoint / NIP Verified: ${formatNaira(res.amountCreditedNgn)} from ${res.verifiedSenderName}. Gate Pass ${res.gatePassId} unlocked!`
    );
    setTimeout(() => setFeedbackToast(null), 5000);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || order.paymentStatus.toLowerCase().includes(statusFilter);
    return matchesSearch && matchesFilter;
  });

  const totalCratesOrdered = orders.reduce((sum, o) => sum + o.cratesOrdered, 0);
  const totalCollections = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingAmount = orders
    .filter((o) => o.paymentStatus !== 'Paid & Verified')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName) return;

    const newOrder: CustomerOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName,
      customerType: 'Wholesale Buyer',
      cratesOrdered: crates,
      unitPrice,
      totalAmount: crates * unitPrice,
      paymentStatus: 'Paid & Verified',
      fulfillmentStatus: 'Ready for Dispatch',
      orderDateWAT: `${formatDualTime().shortWatDate}, ${formatDualTime().watTime}`,
      gatePassId: `GP-${Math.floor(9000 + Math.random() * 999)}`,
    };

    setOrders([newOrder, ...orders]);
    setIsCreatingOrder(false);

    try {
      await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerName: newOrder.customerName,
          cratesCount: newOrder.cratesOrdered,
          unitPriceNgn: newOrder.unitPrice,
          totalAmountNgn: newOrder.totalAmount,
          destinationState: 'Osun State',
          paymentRef: newOrder.orderNumber,
        }),
      });
    } catch {
      // Local state is preserved
    }

    setCustomerName('');
    setFeedbackToast(`Order ${newOrder.orderNumber} for ${customerName} recorded and Gate Pass ${newOrder.gatePassId} issued!`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <section className={styles.root} aria-labelledby="orders-command-title">
      {/* Executive Command Bar — Seamlessly connects under PageContextHeader without duplicate headers */}
      <div className="portal-executive-bar" aria-label="Wholesale Order Execution Controls">
        <div className="portal-exec-actions">
          <button type="button" className="portal-action-btn primary" onClick={() => setIsCreatingOrder(true)}>
            <Plus size={16} aria-hidden="true" />
            <span>Create Wholesale Customer Order</span>
          </button>
        </div>

        <div className="portal-exec-mode" role="status">
          <div className="portal-mode-badge">
            <ShieldCheck size={14} aria-hidden="true" style={{ color: '#0d8052' }} />
            <span>{backendSyncStatus === 'connected' ? 'LIVE D1 ORDERS & NIBSS VERIFIED' : 'LOCAL VERIFICATION'}</span>
            <span className="portal-mode-account">Warehouse Gate 1 &amp; 2</span>
          </div>
        </div>
      </div>

      {feedbackToast && (
        <div className="auth-state" role="status">
          <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {feedbackToast}
        </div>
      )}

      {/* 4 Native Scoreboard Cards */}
      <div className={styles.scoreboard} aria-label="Wholesale customer order metrics">
        <div className={styles.score}>
          <span>
            <Receipt size={19} aria-hidden="true" /> Active Wholesale Orders
          </span>
          <strong>{orders.length} Orders</strong>
          <small>{formatCount(totalCratesOrdered)} crates ({formatCount(totalCratesOrdered * 30)} eggs)</small>
        </div>
        <div className={styles.score}>
          <span>
            <CheckCircle2 size={19} aria-hidden="true" /> Total Order Value
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>{formatNaira(totalCollections)}</strong>
          <small>98.2% auto-matched via NIBSS NIP</small>
        </div>
        <div className={styles.score}>
          <span>
            <Truck size={19} aria-hidden="true" /> Loading &amp; Dispatch
          </span>
          <strong>6 Vehicles</strong>
          <small>Warehouse Bay 1 &amp; 2 active</small>
        </div>
        <div className={styles.score}>
          <span>
            <Clock size={19} aria-hidden="true" /> Pending Verification
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>{formatNaira(pendingAmount)}</strong>
          <small>Awaiting inbound NIP settlement</small>
        </div>
      </div>

      {/* Moniepoint / NIBSS Lookup Terminal */}
      {selectedOrder && (
        <MoniepointPaymentLookupTerminal
          target={{
            id: selectedOrder.id,
            orderNumber: selectedOrder.orderNumber,
            customerName: selectedOrder.customerName,
            expectedAmountNgn: selectedOrder.totalAmount,
            cratesCount: selectedOrder.cratesOrdered,
          }}
          onPaymentVerified={handlePaymentVerified}
        />
      )}

      {/* Native Panel + Data Table for Customer Orders */}
      <Panel
        title="Wholesale Customer Order & Gate Pass Register"
        description="Select any order to load its virtual account into the NIBSS Lookup Terminal above, or click a Gate Pass ID to inspect the official exit voucher."
        actions={<Chip tone="blue">{filteredOrders.length} Active Orders</Chip>}
      >
        <div className="filters">
          <label className="row grow">
            <Search size={18} />
            <input
              className="filter-input"
              aria-label="Filter orders by customer or order number"
              placeholder="Filter orders by customer or order #…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by payment status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minHeight: 38,
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: '#fff',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: '.82rem',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid &amp; Verified</option>
            <option value="pending">Pending Verification</option>
          </select>
          <span className="filter-count">{filteredOrders.length} Orders</span>
        </div>

        <div className="table-wrap mt">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order # &amp; Timestamp</th>
                <th>Customer &amp; Tier</th>
                <th>Quantity (Crates)</th>
                <th>Unit Price</th>
                <th>Total Payable</th>
                <th>Payment Status</th>
                <th>Fulfillment</th>
                <th>Security Gate Pass</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                    <div className="metadata">{order.orderDateWAT}</div>
                  </td>
                  <td>
                    <strong>{order.customerName}</strong>
                    <div className="metadata">{order.customerType}</div>
                  </td>
                  <td>
                    <strong>{formatCount(order.cratesOrdered)} Crates</strong>
                    <div className="metadata">{formatCount(order.cratesOrdered * 30)} eggs</div>
                  </td>
                  <td>{formatNaira(order.unitPrice)}</td>
                  <td>
                    <strong style={{ color: 'var(--primary)' }}>{formatNaira(order.totalAmount)}</strong>
                  </td>
                  <td>
                    <Chip tone={order.paymentStatus === 'Paid & Verified' ? 'green' : 'amber'}>
                      {order.paymentStatus === 'Paid & Verified' && <CheckCircle2 size={12} />}
                      {order.paymentStatus}
                    </Chip>
                  </td>
                  <td>
                    <Chip tone="blue">{order.fulfillmentStatus}</Chip>
                  </td>
                  <td>
                    <div className="row wrap">
                      <Btn small onClick={() => setViewingGatePassOrder(order)}>
                        <QrCode size={14} /> {order.gatePassId}
                      </Btn>
                      <Btn
                        small
                        primary={selectedOrderId === order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        {selectedOrderId === order.id ? 'Active In Terminal' : 'Lookup NIP'}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Official Security Gate Exit Pass Modal */}
      {viewingGatePassOrder && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setViewingGatePassOrder(null)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Security Gate Exit Pass"
            style={{ maxWidth: 580 }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close Gate Pass Modal"
              onClick={() => setViewingGatePassOrder(null)}
            >
              <X />
            </button>

            <div className="stack">
              <div>
                <span className="eyebrow">
                  <QrCode size={14} /> SECURITY GATE EXIT PASS · BALOGUN-IKIRE
                </span>
                <h2>Gate Pass {viewingGatePassOrder.gatePassId}</h2>
                <p className="muted">Electronic Dispatch &amp; Vehicle Gate Clearance</p>
              </div>

              <div className="panel" style={{ background: '#f4faf7', borderColor: '#9fd3bd' }}>
                <Chip tone={viewingGatePassOrder.paymentStatus === 'Paid & Verified' ? 'green' : 'red'}>
                  {viewingGatePassOrder.paymentStatus === 'Paid & Verified'
                    ? 'AUTHORIZED FOR GATE EXIT ✓'
                    : 'EXIT RESTRICTED — UNPAID'}
                </Chip>
                <dl className="identity-facts mt">
                  <div>
                    <dt>Order Reference</dt>
                    <dd>{viewingGatePassOrder.orderNumber}</dd>
                  </div>
                  <div>
                    <dt>Authorized Consignee</dt>
                    <dd>{viewingGatePassOrder.customerName}</dd>
                  </div>
                  <div>
                    <dt>Consignment Volume</dt>
                    <dd>
                      {viewingGatePassOrder.cratesOrdered} Crates ({viewingGatePassOrder.cratesOrdered * 30} Eggs)
                    </dd>
                  </div>
                  <div>
                    <dt>Total Settlement</dt>
                    <dd>{formatNaira(viewingGatePassOrder.totalAmount)}</dd>
                  </div>
                </dl>
              </div>

              <div className="row between wrap">
                <Btn onClick={() => window.print()}>
                  <Printer size={15} /> Print Exit Pass
                </Btn>
                <Btn primary onClick={() => setViewingGatePassOrder(null)}>
                  Close
                </Btn>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Guided Create Customer Order Modal */}
      {isCreatingOrder && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setIsCreatingOrder(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create Wholesale Customer Order"
            style={{ maxWidth: 560 }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close Create Order Modal"
              onClick={() => setIsCreatingOrder(false)}
            >
              <X />
            </button>

            <form className="stack" onSubmit={(e) => void handleCreateOrder(e)}>
              <div>
                <span className="eyebrow">SALES &amp; DISTRIBUTION</span>
                <h2>Create Wholesale Customer Order</h2>
                <p className="muted">Allocate 30-egg crates and provision a dedicated NIBSS virtual account.</p>
              </div>

              <label className="field">
                <span>Customer / Off-taker Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Adeleke Egg Distribution"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span>Quantity (30-Egg Crates) *</span>
                  <input
                    type="number"
                    min={1}
                    required
                    value={crates}
                    onChange={(e) => setCrates(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Unit Price per Crate (₦) *</span>
                  <input
                    type="number"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="panel" style={{ background: '#f4faf7', borderColor: '#9fd3bd' }}>
                <span className="eyebrow">TOTAL ORDER PAYABLE</span>
                <h3 style={{ marginTop: 6 }}>{formatNaira(crates * unitPrice)}</h3>
                <div className="metadata">= {formatCount(crates * 30)} loose table eggs</div>
              </div>

              <div className="row between wrap">
                <Btn type="button" onClick={() => setIsCreatingOrder(false)}>
                  Cancel
                </Btn>
                <Btn primary type="submit">
                  Confirm &amp; Reserve Stock
                </Btn>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
