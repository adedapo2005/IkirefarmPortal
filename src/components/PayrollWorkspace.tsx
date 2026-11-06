import React, { useState } from 'react';
import { 
  Users, DollarSign, Clock, ShieldCheck, CheckCircle2, 
  FileText, Download, Plus, Search, Calendar, ChevronRight, AlertCircle
} from 'lucide-react';
import { formatDualTime, formatNaira, formatCount } from '../lib/temporal.ts';

interface EmployeePayrollItem {
  id: string;
  staffId: string;
  fullName: string;
  department: string;
  roleTitle: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  grossPay: number;
  payeTax: number;
  pensionEmployee: number; // 8%
  nhfDeduction: number;    // 2.5%
  netPay: number;
  paymentBank: string;
  accountNumber: string;
  status: 'Approved & Signed' | 'Pending HR Verification' | 'Hold';
}

const INITIAL_STAFF_PAYROLL: EmployeePayrollItem[] = [
  {
    id: 'pr-01',
    staffId: 'DF-IK-001',
    fullName: 'Glory Mercy',
    department: 'Farm Operations',
    roleTitle: 'General Farm Manager',
    basicSalary: 350000,
    housingAllowance: 150000,
    transportAllowance: 100000,
    grossPay: 600000,
    payeTax: 78500,
    pensionEmployee: 48000,
    nhfDeduction: 8750,
    netPay: 464750,
    paymentBank: 'Zenith Bank',
    accountNumber: '2081928374',
    status: 'Approved & Signed',
  },
  {
    id: 'pr-02',
    staffId: 'DF-IK-004',
    fullName: 'Dr. Segun Adewale',
    department: 'Veterinary & Health',
    roleTitle: 'Chief Resident Veterinarian',
    basicSalary: 280000,
    housingAllowance: 120000,
    transportAllowance: 80000,
    grossPay: 480000,
    payeTax: 58200,
    pensionEmployee: 38400,
    nhfDeduction: 7000,
    netPay: 376400,
    paymentBank: 'GTBank',
    accountNumber: '0192837461',
    status: 'Approved & Signed',
  },
  {
    id: 'pr-03',
    staffId: 'DF-IK-012',
    fullName: 'Idris Oladele',
    department: 'Feed & Milling',
    roleTitle: 'Feed Mill Supervisor',
    basicSalary: 180000,
    housingAllowance: 70000,
    transportAllowance: 50000,
    grossPay: 300000,
    payeTax: 28400,
    pensionEmployee: 24000,
    nhfDeduction: 4500,
    netPay: 243100,
    paymentBank: 'Access Bank',
    accountNumber: '1482910482',
    status: 'Approved & Signed',
  },
  {
    id: 'pr-04',
    staffId: 'DF-IK-018',
    fullName: 'Babatunde Alamu',
    department: 'Flock Management',
    roleTitle: 'Senior House 1 Attendant',
    basicSalary: 110000,
    housingAllowance: 45000,
    transportAllowance: 35000,
    grossPay: 190000,
    payeTax: 12800,
    pensionEmployee: 15200,
    nhfDeduction: 2750,
    netPay: 159250,
    paymentBank: 'First Bank',
    accountNumber: '3092817456',
    status: 'Pending HR Verification',
  },
];

export const PayrollWorkspace: React.FC = () => {
  const [payrollList, setPayrollList] = useState<EmployeePayrollItem[]>(INITIAL_STAFF_PAYROLL);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalGross = payrollList.reduce((sum, item) => sum + item.grossPay, 0);
  const totalTax = payrollList.reduce((sum, item) => sum + item.payeTax, 0);
  const totalPension = payrollList.reduce((sum, item) => sum + item.pensionEmployee, 0);
  const totalNet = payrollList.reduce((sum, item) => sum + item.netPay, 0);

  const handleApprovePayroll = () => {
    setPayrollList(payrollList.map(item => ({ ...item, status: 'Approved & Signed' })));
    setToastMessage('November 2026 Payroll Cycle approved and locked! Ready for Providus NIP batch transfer.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredStaff = payrollList.filter(item => {
    const matchesSearch = item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.staffId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || item.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Human Resources</span>
            <span>&gt;</span>
            <span className="text-slate-900 font-semibold">Payroll Platform</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#008751]" />
            Enterprise Workforce Payroll & Statutory Remittances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Balogun-Ikire operational staff compensation, biometric attendance integration, Nigerian PAYE graded brackets, 8% Pension, and NIP direct payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleApprovePayroll}
            className="btn-primary-glow px-4 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            Lock & Sign November Payroll
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-[#005A36] text-xs rounded-xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 4 Summary Kpis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Net Disbursement</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-[#008751]">{formatNaira(totalNet)}</span>
            <span className="text-[11px] text-slate-500 font-sans">{payrollList.length} Active Staff</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Gross Salary</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-slate-900">{formatNaira(totalGross)}</span>
            <span className="text-[10px] text-slate-400 font-sans">Inc. Allowances</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">State PAYE Tax (Osun IRS)</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-blue-600">{formatNaira(totalTax)}</span>
            <span className="text-[10px] text-blue-600 font-sans">Statutory Graded</span>
          </div>
        </div>

        <div className="premium-card p-4 rounded-xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pension Fund (PFA 8%)</span>
          <div className="flex items-baseline justify-between font-mono-numbers">
            <span className="text-xl font-bold text-purple-600">{formatNaira(totalPension)}</span>
            <span className="text-[10px] text-purple-600 font-sans">PenCom Compliant</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-800">Monthly Compensation Ledger (November 2026):</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-hidden w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-hidden font-medium"
            >
              <option value="all">All Departments</option>
              <option value="Farm Operations">Farm Operations</option>
              <option value="Veterinary & Health">Veterinary & Health</option>
              <option value="Feed & Milling">Feed & Milling</option>
              <option value="Flock Management">Flock Management</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Staff ID & Name</th>
                <th className="py-3 px-4">Role & Department</th>
                <th className="py-3 px-4 text-right">Gross Pay</th>
                <th className="py-3 px-4 text-right">PAYE Tax</th>
                <th className="py-3 px-4 text-right">Pension (8%)</th>
                <th className="py-3 px-4 text-right">NHF (2.5%)</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Net Pay</th>
                <th className="py-3 px-4">Bank Disbursement</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-numbers">
              {filteredStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block font-sans">{staff.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{staff.staffId}</span>
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="text-slate-800 font-semibold block">{staff.roleTitle}</span>
                    <span className="text-[10px] text-slate-500">{staff.department}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {formatNaira(staff.grossPay)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-600">
                    -{formatNaira(staff.payeTax)}
                  </td>
                  <td className="py-3 px-4 text-right text-purple-600">
                    -{formatNaira(staff.pensionEmployee)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    -{formatNaira(staff.nhfDeduction)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#008751] text-sm">
                    {formatNaira(staff.netPay)}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className="font-semibold text-slate-800 block text-xs">{staff.paymentBank}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{staff.accountNumber}</span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    {staff.status === 'Approved & Signed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#005A36]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Signed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
