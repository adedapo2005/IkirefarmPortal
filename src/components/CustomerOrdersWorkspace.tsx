import React, { useState } from 'react';
import { 
  BadgePercent, Plus, Search, Filter, ArrowUpRight, 
  CheckCircle2, Clock, Truck, ShieldCheck, DollarSign,
  FileText, User, ChevronRight, AlertCircle, Calendar
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

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

  // New Order Form State
  const [customerName, setCustomerName] = useState<string>('');
  const [crates, setCrates] = useState<number>(100);
  const [unitPrice, setUnitPrice] = useState<number>(3500);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || order.paymentStatus.toLowerCase().includes(statusFilter);
    return matchesSearch && matchesFilter;
  });

  const handleCreateOrder = (e: React.FormEvent) => {
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
    setCustomerName('');
    setFeedbackToast(`Order ${newOrder.orderNumber} for ${customerName} recorded successfully!`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Commerce & Orders</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Customer Orders</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BadgePercent className="w-6 h-6 text-[#008751]" />
            Wholesale Customer Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Wholesale egg orders, stock allocation, Providus/Monnify payment verification, and digital gate exit passes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingOrder(true)}
          className="btn-primary-glow px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4 icon-react" />
          Create Customer Order
        </button>
      </div>

      {feedbackToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{feedbackToast}</span>
        </div>
      )}

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Orders</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">14 Orders</span>
            <span className="text-[11px] text-emerald-600 font-bold">1,690 Crates</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Collections</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatNaira(5909000)}</span>
            <span className="text-[10px] text-slate-400 font-sans">Bank Verified</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Loading & Dispatch</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">6 Vehicles</span>
            <span className="text-[10px] text-blue-600 font-sans">Bay Active</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pending Verification</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-amber-600">₦1.22M</span>
            <span className="text-[10px] text-amber-600 font-sans">Awaiting Credit</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter orders by customer or order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid & Verified</option>
            <option value="pending">Pending Verification</option>
          </select>
        </div>
      </div>

      {/* Customer Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer & Account</th>
                <th className="py-3 px-4 text-right">Quantity (Crates)</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-center">Fulfillment</th>
                <th className="py-3 px-4 text-center">Gate Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {order.orderNumber}
                    <span className="block text-[10px] font-normal text-slate-400 font-sans mt-0.5">{order.orderDateWAT}</span>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="font-bold text-slate-900 block">{order.customerName}</span>
                    <span className="text-[10px] text-slate-500">{order.customerType}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCount(order.cratesOrdered)} Crates
                    <span className="block text-[10px] text-slate-400 font-normal">({formatCount(order.cratesOrdered * 30)} eggs)</span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {formatNaira(order.unitPrice)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#008751]">
                    {formatNaira(order.totalAmount)}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      order.paymentStatus === 'Paid & Verified'
                        ? 'bg-emerald-100 text-[#005A36]'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {order.paymentStatus === 'Paid & Verified' && <CheckCircle2 className="w-3 h-3" />}
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {order.fulfillmentStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-mono text-xs font-bold text-slate-700 px-2 py-0.5 bg-slate-100 rounded">
                      {order.gatePassId}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guided Create Customer Order Modal */}
      {isCreatingOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fade-in font-sans">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create Wholesale Customer Order</h2>
            <p className="text-xs text-slate-500 mb-4">Draft customer order with automatic 30-egg crate calculation and pricing</p>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer / Off-taker Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Adeleke Egg Distribution"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-[#008751] focus:ring-1 focus:ring-[#008751] outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity (Crated Trays) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={crates}
                    onChange={(e) => setCrates(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">= {formatCount(crates * 30)} loose eggs</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Price per Crate (₦) *</label>
                  <input
                    type="number"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers font-bold"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[#005A36] flex items-center justify-between font-mono-numbers">
                <span className="font-sans text-xs font-semibold">Total Order Payable:</span>
                <strong className="text-base font-bold">{formatNaira(crates * unitPrice)}</strong>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingOrder(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-glow px-5 py-2 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  Confirm & Reserve Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
