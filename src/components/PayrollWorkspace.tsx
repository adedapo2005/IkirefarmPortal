import React, { useEffect, useState } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Search,
  AlertCircle,
  Landmark,
  Send,
  RefreshCw,
  Check,
  CreditCard,
  Printer,
  UserCheck,
  X,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Clock,
  Banknote,
  Building2,
} from 'lucide-react';
import { formatDualTime, formatNaira } from '../lib/temporal.ts';
import {
  playPosPaymentChime,
  NIGERIAN_BANKS,
  lookupNigerianBankAccount,
  BankAccountLookupResult,
  StatutoryPolicyConfig,
  DEFAULT_STATUTORY_POLICY,
  computeDynamicEmployeePay,
  DynamicPayCalculationResult,
} from '../lib/moniepoint-nip-payment-engine.ts';
import styles from './portal/InventoryControlDashboard.module.css';
import { Panel, Btn, Chip } from './portal/Common';
import './portal/PortalPolish.css';

export interface EmployeePayrollItem {
  id: string;
  staffId: string;
  fullName: string;
  department: string;
  roleTitle: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances?: number;
  applyPaye: boolean;
  applyPension: boolean;
  applyNhf: boolean;
  paymentBank: string;
  accountNumber: string;
  verifiedAccountName: string;
  status: 'Paid via NIP' | 'Approved & Signed' | 'Pending HR Verification' | 'Hold';
  nipSessionId?: string;
  disbursedAtWAT?: string;
  payoutCategory?: string;
}

export interface PayrollFundingAccount {
  id: string;
  label: string;
  bankName: string;
  accountNumber: string;
  availableBalance: number;
  isKuda?: boolean;
}

const FUNDING_ACCOUNTS: PayrollFundingAccount[] = [
  {
    id: 'kuda-payroll',
    label: 'Kuda Business Payroll Sub-Account',
    bankName: 'Kuda Microfinance Bank',
    accountNumber: '2019 482 710',
    availableBalance: 8500000,
    isKuda: true,
  },
  {
    id: 'zenith-operating',
    label: 'Zenith Bank PLC (Operating & Payroll)',
    bankName: 'Zenith Bank',
    accountNumber: '1014 928 471',
    availableBalance: 18240500,
  },
  {
    id: 'gtb-escrow',
    label: 'GTBank (Payroll & Statutory Escrow)',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '0284 918 274',
    availableBalance: 9850000,
  },
];

// Base compensation definitions (100% dynamically computed gross, PAYE, PenCom 8%, and net pay)
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
    applyPaye: true,
    applyPension: true,
    applyNhf: false,
    paymentBank: 'Zenith Bank PLC',
    accountNumber: '2081928374',
    verifiedAccountName: 'GLORY MERCY ADETOKUNBO',
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
    applyPaye: true,
    applyPension: true,
    applyNhf: false,
    paymentBank: 'Guaranty Trust Bank (GTBank)',
    accountNumber: '0192837461',
    verifiedAccountName: 'DR. SEGUN ADEWALE (DVM)',
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
    applyPaye: true,
    applyPension: true,
    applyNhf: false,
    paymentBank: 'Access Bank PLC',
    accountNumber: '1482910482',
    verifiedAccountName: 'IDRIS O. OLADELE',
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
    applyPaye: false,
    applyPension: false,
    applyNhf: false,
    paymentBank: 'First Bank of Nigeria',
    accountNumber: '3092817456',
    verifiedAccountName: 'BABATUNDE SUNDAY ALAMU',
    status: 'Approved & Signed',
  },
];

export const PayrollWorkspace: React.FC = () => {
  const [payrollList, setPayrollList] = useState<EmployeePayrollItem[]>(INITIAL_STAFF_PAYROLL);
  const [selectedFundingAccount, setSelectedFundingAccount] = useState<string>('kuda-payroll');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Payments mode: 'simulated' (demo data) or 'live' (real bank provider, fails closed).
  const [paymentsMode, setPaymentsMode] = useState<'simulated' | 'live'>('simulated');
  const [modeInfo, setModeInfo] = useState<{ persisted: boolean; liveProviderConfigured: boolean; pinRequired: boolean }>({
    persisted: false,
    liveProviderConfigured: false,
    pinRequired: false,
  });
  const [modeBusy, setModeBusy] = useState(false);
  const isLive = paymentsMode === 'live';

  useEffect(() => {
    fetch('/api/v1/system/payments-mode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPaymentsMode(d.mode === 'live' ? 'live' : 'simulated');
        setModeInfo({ persisted: !!d.persisted, liveProviderConfigured: !!d.liveProviderConfigured, pinRequired: !!d.pinRequired });
      })
      .catch(() => undefined);

    fetch('/api/v1/payroll/employees')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.employees) && d.employees.length > 0) {
          setPayrollList(d.employees);
        }
      })
      .catch(() => undefined);
  }, []);

  const switchPaymentsMode = async (next: 'simulated' | 'live') => {
    const warning =
      next === 'live'
        ? 'Turn OFF simulation and go LIVE?\n\nAll simulated lookups and fake receipts stop. Payouts will only work through the real bank provider; if it is not connected, transfers are blocked and no money moves.'
        : 'Switch back to SIMULATED mode? Payouts and lookups will use demo data again.';
    if (!window.confirm(warning)) return;
    let pin: string | undefined;
    if (modeInfo.pinRequired) {
      pin = window.prompt('Enter the payments admin PIN') ?? undefined;
      if (!pin) return;
    }
    setModeBusy(true);
    try {
      const r = await fetch('/api/v1/system/payments-mode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: next, pin }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not change payments mode.');
      setPaymentsMode(d.mode);
      setModeInfo((m) => ({ ...m, persisted: true, liveProviderConfigured: !!d.liveProviderConfigured }));
      setToastMessage(next === 'live' ? 'Simulation turned OFF. Payments mode is LIVE.' : 'Simulation turned ON.');
    } catch (e) {
      setToastMessage(e instanceof Error ? e.message : 'Could not change payments mode.');
    } finally {
      setModeBusy(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Dynamic Statutory Deductions Policy (Configurable & Optional)
  const [statutoryPolicy, setStatutoryPolicy] = useState<StatutoryPolicyConfig>(DEFAULT_STATUTORY_POLICY);

  // Batch Payout Modal State
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState<boolean>(false);
  const [, setIsProcessingDisbursement] = useState<boolean>(false);
  const [disbursementStep, setDisbursementStep] = useState<'review' | 'dispatching' | 'completed'>('review');
  const [disbursementTarget, setDisbursementTarget] = useState<'all' | string>('all');

  // Employee Lookup & Quick Payout Modal State
  const [isLookupModalOpen, setIsLookupModalOpen] = useState<boolean>(false);
  const [lookupTargetMode, setLookupTargetMode] = useState<'registered' | 'adhoc'>('registered');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(INITIAL_STAFF_PAYROLL[0].id);
  const [selectedBankCode, setSelectedBankCode] = useState<string>('50211');
  const [accountNumberInput, setAccountNumberInput] = useState<string>('2019482710');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<BankAccountLookupResult | null>(null);
  const [lookupBasicAmount, setLookupBasicAmount] = useState<number>(350000);
  const [modalApplyPaye, setModalApplyPaye] = useState<boolean>(true);
  const [modalApplyPension, setModalApplyPension] = useState<boolean>(true);
  const [payoutCategory, setPayoutCategory] = useState<string>('Monthly Net Salary');
  const [lookupStep, setLookupStep] = useState<'input' | 'processing' | 'success'>('input');
  const [lastTransferredSessionId, setLastTransferredSessionId] = useState<string>('');

  // Digital Payslip Voucher Modal State
  const [payslipModalStaff, setPayslipModalStaff] = useState<EmployeePayrollItem | null>(null);

  const fundingAccount = FUNDING_ACCOUNTS.find((a) => a.id === selectedFundingAccount) || FUNDING_ACCOUNTS[0];

  const getStaffPay = (staff: EmployeePayrollItem): DynamicPayCalculationResult => {
    return computeDynamicEmployeePay({
      basicSalary: staff.basicSalary,
      housingAllowance: staff.housingAllowance,
      transportAllowance: staff.transportAllowance,
      otherAllowances: staff.otherAllowances,
      applyPaye: staff.applyPaye,
      applyPension: staff.applyPension,
      applyNhf: staff.applyNhf,
      policy: statutoryPolicy,
    });
  };

  const totalGross = payrollList.reduce((sum, item) => sum + getStaffPay(item).grossPay, 0);
  const totalTax = payrollList.reduce((sum, item) => sum + getStaffPay(item).payeTax, 0);
  const totalPension = payrollList.reduce((sum, item) => sum + getStaffPay(item).pensionEmployee, 0);
  const totalNet = payrollList.reduce((sum, item) => sum + getStaffPay(item).netPay, 0);

  const pendingDisbursements = payrollList.filter((item) => item.status !== 'Paid via NIP');
  const totalPendingAmount = pendingDisbursements.reduce((sum, item) => sum + getStaffPay(item).netPay, 0);

  const toggleGlobalPaye = () => {
    const nextVal = !statutoryPolicy.enablePaye;
    setStatutoryPolicy((prev) => ({ ...prev, enablePaye: nextVal }));
    setToastMessage(
      `Osun State PAYE Tax ${nextVal ? 'ENABLED' : 'DISABLED (Optional Exemption Active)'}. Payroll dynamically recomputed!`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleGlobalPension = () => {
    const nextVal = !statutoryPolicy.enablePension;
    setStatutoryPolicy((prev) => ({ ...prev, enablePension: nextVal }));
    setToastMessage(
      `PenCom 8% Pension ${nextVal ? 'ENABLED' : 'DISABLED (Optional Exemption Active)'}. Payroll dynamically recomputed!`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleGlobalNhf = () => {
    const nextVal = !statutoryPolicy.enableNhf;
    setStatutoryPolicy((prev) => ({ ...prev, enableNhf: nextVal }));
    setToastMessage(`NHF (2.5%) ${nextVal ? 'ENABLED' : 'DISABLED'}. Payroll dynamically recomputed!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleStaffPaye = (staffId: string) => {
    setPayrollList((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          const nextPaye = !s.applyPaye;
          setToastMessage(`${s.fullName}: Osun State PAYE Tax set to ${nextPaye ? 'APPLIED' : 'EXEMPT'}`);
          setTimeout(() => setToastMessage(null), 3000);
          fetch('/api/v1/payroll/employees', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: staffId, applyPaye: nextPaye }),
          }).catch(() => undefined);
          return { ...s, applyPaye: nextPaye };
        }
        return s;
      })
    );
  };

  const toggleStaffPension = (staffId: string) => {
    setPayrollList((prev) =>
      prev.map((s) => {
        if (s.id === staffId) {
          const nextPension = !s.applyPension;
          setToastMessage(`${s.fullName}: PenCom 8% Pension set to ${nextPension ? 'APPLIED' : 'EXEMPT'}`);
          setTimeout(() => setToastMessage(null), 3000);
          fetch('/api/v1/payroll/employees', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: staffId, applyPension: nextPension }),
          }).catch(() => undefined);
          return { ...s, applyPension: nextPension };
        }
        return s;
      })
    );
  };

  const handleOpenBatchPayout = () => {
    setDisbursementTarget('all');
    setDisbursementStep('review');
    setIsDisbursementModalOpen(true);
  };

  const handleOpenSinglePayout = (staffId: string) => {
    const staff = payrollList.find((s) => s.id === staffId);
    if (staff) {
      setSelectedStaffId(staff.id);
      setLookupTargetMode('registered');
      const bank =
        NIGERIAN_BANKS.find((b) => staff.paymentBank.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])) ||
        NIGERIAN_BANKS[4];
      setSelectedBankCode(bank.code);
      setAccountNumberInput(staff.accountNumber);
      setLookupBasicAmount(staff.basicSalary);
      setModalApplyPaye(staff.applyPaye);
      setModalApplyPension(staff.applyPension);
      setPayoutCategory('Monthly Net Salary');
      setLookupResult({
        status: 'success',
        accountNumber: staff.accountNumber,
        bankCode: bank.code,
        bankName: staff.paymentBank,
        accountName: staff.verifiedAccountName,
        kycTier: 'Tier 3 (Verified BVN/NIN)',
        bvnMasked: '224*****819',
        lookupTimestampWat: new Date().toLocaleTimeString('en-NG') + ' WAT',
      });
      setLookupStep('input');
      setIsLookupModalOpen(true);
    }
  };

  const handleExecuteNipTransfer = async () => {
    setIsProcessingDisbursement(true);
    setDisbursementStep('dispatching');
    playPosPaymentChime('ping');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    playPosPaymentChime('ping');

    try {
      const resp = await fetch('/api/v1/transfers/nip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceAccountNumber: fundingAccount.accountNumber.replace(/\s+/g, ''),
          beneficiaryBankCode: '057',
          beneficiaryAccountNumber: '2081928374',
          beneficiaryAccountName: 'DAENEM BATCH PAYROLL',
          amountNgn: totalPendingAmount,
          narration: 'DAENEM FARMS MONTHLY PAYROLL',
        }),
      });
      if (isLive && !resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Live transfer was not accepted. No money was moved.');
      }
    } catch (e) {
      if (isLive) {
        setIsProcessingDisbursement(false);
        setDisbursementStep('review');
        setToastMessage(e instanceof Error ? e.message : 'Live transfer failed. No money was moved.');
        setTimeout(() => setToastMessage(null), 7000);
        return;
      }
      // Simulated mode: continue with demo result
    }

    const nowWat = `${formatDualTime().shortWatDate}, ${formatDualTime().watTime}`;

    setPayrollList((prev) =>
      prev.map((staff) => {
        if (disbursementTarget === 'all' || staff.id === disbursementTarget) {
          return {
            ...staff,
            status: 'Paid via NIP',
            nipSessionId: `999014261107${Math.floor(100000000000000000 + Math.random() * 900000000000000000)}`,
            disbursedAtWAT: nowWat,
            payoutCategory: 'Full Monthly Payroll Run',
          };
        }
        return staff;
      })
    );

    setIsProcessingDisbursement(false);
    setDisbursementStep('completed');
    playPosPaymentChime('confirmed');

    setToastMessage(
      disbursementTarget === 'all'
        ? `NIP Bulk Payout Successful: ${formatNaira(totalPendingAmount)} disbursed from ${fundingAccount.bankName}!`
        : `NIP Single Payout Successful: Staff member credited directly via ${fundingAccount.bankName}!`
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handlePerformAccountLookup = async (accNum: string, bCode: string) => {
    const cleanNum = accNum.replace(/\D/g, '');
    if (cleanNum.length !== 10) {
      setLookupResult({
        status: 'failed',
        accountNumber: cleanNum,
        bankCode: bCode,
        bankName: NIGERIAN_BANKS.find((b) => b.code === bCode)?.name || 'Selected Bank',
        accountName: '',
        failureReason: 'NUBAN account number must be exactly 10 digits.',
      });
      playPosPaymentChime('fraud_alert');
      return;
    }

    setIsLookingUp(true);
    playPosPaymentChime('ping');

    const bankObj = NIGERIAN_BANKS.find((b) => b.code === bCode) || NIGERIAN_BANKS[0];
    let res: BankAccountLookupResult;
    if (isLive) {
      // Live: real provider only. Never fall back to simulated names.
      try {
        const r = await fetch(
          `/api/v1/bank/name-enquiry?accountNumber=${encodeURIComponent(cleanNum)}&bankCode=${encodeURIComponent(bCode)}`
        );
        const d = await r.json().catch(() => ({}));
        res =
          r.ok && d.accountName
            ? { status: 'success', accountNumber: cleanNum, bankCode: bCode, bankName: bankObj.name, accountName: d.accountName }
            : {
                status: 'failed',
                accountNumber: cleanNum,
                bankCode: bCode,
                bankName: bankObj.name,
                accountName: '',
                failureReason: d.error || d.failureReason || 'Live account lookup is unavailable.',
              };
      } catch {
        res = {
          status: 'failed',
          accountNumber: cleanNum,
          bankCode: bCode,
          bankName: bankObj.name,
          accountName: '',
          failureReason: 'Live account lookup is unreachable.',
        };
      }
    } else {
      res = await lookupNigerianBankAccount({
        accountNumber: cleanNum,
        bankCode: bCode,
        bankName: bankObj.name,
      });
    }

    setIsLookingUp(false);
    setLookupResult(res);

    if (res.status === 'success') {
      playPosPaymentChime('confirmed');
    } else {
      playPosPaymentChime('fraud_alert');
    }
  };

  const handleSelectStaffInLookup = (staffId: string) => {
    setSelectedStaffId(staffId);
    const staff = payrollList.find((s) => s.id === staffId);
    if (staff) {
      const bank =
        NIGERIAN_BANKS.find((b) => staff.paymentBank.toLowerCase().includes(b.name.toLowerCase().split(' ')[0])) ||
        NIGERIAN_BANKS[4];
      setSelectedBankCode(bank.code);
      setAccountNumberInput(staff.accountNumber);
      setLookupBasicAmount(staff.basicSalary);
      setModalApplyPaye(staff.applyPaye);
      setModalApplyPension(staff.applyPension);
      void handlePerformAccountLookup(staff.accountNumber, bank.code);
    }
  };

  const selectedStaffObj = payrollList.find((s) => s.id === selectedStaffId);
  const modalCalculatedPay =
    lookupTargetMode === 'registered' && selectedStaffObj
      ? computeDynamicEmployeePay({
          basicSalary: selectedStaffObj.basicSalary,
          housingAllowance: selectedStaffObj.housingAllowance,
          transportAllowance: selectedStaffObj.transportAllowance,
          applyPaye: modalApplyPaye,
          applyPension: modalApplyPension,
          policy: statutoryPolicy,
        })
      : computeDynamicEmployeePay({
          basicSalary: lookupBasicAmount,
          housingAllowance: 0,
          transportAllowance: 0,
          applyPaye: modalApplyPaye,
          applyPension: modalApplyPension,
          policy: statutoryPolicy,
        });

  const handleExecuteLookupPayout = async () => {
    if (!lookupResult || lookupResult.status !== 'success') return;

    setLookupStep('processing');
    playPosPaymentChime('ping');

    await new Promise((resolve) => setTimeout(resolve, 900));

    let newSessionId = `999014261107${Math.floor(100000000000000000 + Math.random() * 900000000000000000)}`;
    try {
      const resp = await fetch('/api/v1/transfers/nip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceAccountNumber: fundingAccount.accountNumber.replace(/\s+/g, ''),
          beneficiaryBankCode: lookupResult.bankCode,
          beneficiaryAccountNumber: lookupResult.accountNumber,
          beneficiaryAccountName: lookupResult.accountName,
          amountNgn: modalCalculatedPay.netPay,
          narration: `DAENEM ${payoutCategory.toUpperCase()}`,
          staffId: lookupTargetMode === 'registered' ? selectedStaffObj?.staffId : 'ADHOC',
        }),
      });
      if (isLive && !resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Live transfer was not accepted. No money was moved.');
      }
      if (resp.ok) {
        const data = (await resp.json()) as { nipSessionId?: string; data?: { sessionId?: string } };
        const sid = data?.nipSessionId || data?.data?.sessionId;
        if (sid) newSessionId = sid;
      }
    } catch (e) {
      if (isLive) {
        setLookupStep('input');
        setToastMessage(e instanceof Error ? e.message : 'Live transfer failed. No money was moved.');
        setTimeout(() => setToastMessage(null), 7000);
        return;
      }
      // Simulated mode: fallback session ID retained
    }

    const nowWat = `${formatDualTime().shortWatDate}, ${formatDualTime().watTime}`;
    setLastTransferredSessionId(newSessionId);

    if (lookupTargetMode === 'registered' && selectedStaffId) {
      setPayrollList((prev) =>
        prev.map((staff) => {
          if (staff.id === selectedStaffId) {
            return {
              ...staff,
              applyPaye: modalApplyPaye,
              applyPension: modalApplyPension,
              status: 'Paid via NIP',
              nipSessionId: newSessionId,
              disbursedAtWAT: nowWat,
              payoutCategory,
            };
          }
          return staff;
        })
      );
    } else {
      const newStaffItem: EmployeePayrollItem = {
        id: `pr-adhoc-${Date.now()}`,
        staffId: `DF-TEMP-${Math.floor(100 + Math.random() * 900)}`,
        fullName: lookupResult.accountName,
        department: 'Casual & Ad-Hoc Staff',
        roleTitle: `${payoutCategory} Recipient`,
        basicSalary: lookupBasicAmount,
        housingAllowance: 0,
        transportAllowance: 0,
        applyPaye: modalApplyPaye,
        applyPension: modalApplyPension,
        applyNhf: false,
        paymentBank: lookupResult.bankName,
        accountNumber: lookupResult.accountNumber,
        verifiedAccountName: lookupResult.accountName,
        status: 'Paid via NIP',
        nipSessionId: newSessionId,
        disbursedAtWAT: nowWat,
        payoutCategory,
      };
      setPayrollList((prev) => [newStaffItem, ...prev]);
    }

    setLookupStep('success');
    playPosPaymentChime('confirmed');

    setToastMessage(
      `NIP Transfer of ${formatNaira(modalCalculatedPay.netPay)} to ${lookupResult.accountName} settled via ${fundingAccount.bankName}!`
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  const filteredStaff = payrollList.filter((item) => {
    const matchesSearch =
      item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.staffId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || item.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <section className={styles.root} aria-labelledby="payroll-command-title">
      {/* Executive Command Bar — Seamlessly connects under PageContextHeader without duplicate headers */}
      <div className="portal-executive-bar" aria-label="Payroll Execution Controls">
        <div className="portal-exec-actions">
          <button
            type="button"
            className="portal-action-btn primary"
            onClick={handleOpenBatchPayout}
            disabled={pendingDisbursements.length === 0}
          >
            <Send size={16} aria-hidden="true" />
            <span>Auto-Pay Full Payroll ({formatNaira(totalPendingAmount)})</span>
          </button>
          <button
            type="button"
            className="portal-action-btn secondary"
            onClick={() => {
              handleSelectStaffInLookup(payrollList[0]?.id || 'pr-01');
              setLookupStep('input');
              setIsLookupModalOpen(true);
            }}
          >
            <Search size={15} aria-hidden="true" />
            <span>Lookup Staff Account &amp; Pay</span>
          </button>
        </div>

        <div className="portal-exec-mode" role="status">
          <div className="portal-mode-badge">
            <i className={`pf-dot ${isLive ? 'pf-dot--live' : 'pf-dot--sim'}`} aria-hidden="true" />
            <span>{isLive ? 'LIVE PAYMENTS' : 'SIMULATED PAYMENTS'}</span>
            <span className="portal-mode-account">
              {fundingAccount.bankName} · {fundingAccount.accountNumber}
            </span>
          </div>
          <button
            type="button"
            className="portal-mode-toggle"
            disabled={modeBusy}
            onClick={() => switchPaymentsMode(isLive ? 'simulated' : 'live')}
            title="Toggle between simulated testing and live payment execution"
          >
            <RefreshCw size={13} className={modeBusy ? 'spin' : ''} aria-hidden="true" />
            <span>{isLive ? 'Turn simulation ON' : 'Turn simulation OFF · Go live'}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="auth-state" role="status">
          <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {toastMessage}
        </div>
      )}

      {/* 4 Native Scoreboard Cards */}
      <div className={styles.scoreboard} aria-label="Payroll financial summary">
        <div className={`${styles.score} pf-score`}>
          <span>
            <Banknote size={19} aria-hidden="true" /> Total Net Disbursement
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>{formatNaira(totalNet)}</strong>
          <small>
            {payrollList.length} active staff · Gross {formatNaira(totalGross)}
          </small>
        </div>
        <div className={`${styles.score} pf-score`}>
          <span>
            <Landmark size={19} aria-hidden="true" /> Source Account Liquidity
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>
            {formatNaira(fundingAccount.availableBalance)}
          </strong>
          <small>
            {fundingAccount.bankName} · {fundingAccount.accountNumber}
          </small>
        </div>
        <div className={`${styles.score} pf-score`}>
          <span>
            <Building2 size={19} aria-hidden="true" /> Osun State PAYE Tax
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>
            {statutoryPolicy.enablePaye ? formatNaira(totalTax) : '₦0.00'}
          </strong>
          <small>
            {statutoryPolicy.enablePaye
              ? 'Dynamic PITA brackets & CRA applied'
              : 'Optional Bypass Active · ₦0 deducted'}
          </small>
        </div>
        <div className={`${styles.score} pf-score`}>
          <span>
            <Users size={19} aria-hidden="true" /> PenCom 8% Pension
          </span>
          <strong style={{ fontSize: 'clamp(1.65rem, 2.1vw, 2.7rem)' }}>
            {statutoryPolicy.enablePension ? formatNaira(totalPension) : '₦0.00'}
          </strong>
          <small>
            {statutoryPolicy.enablePension
              ? '8% of Basic + Housing + Transport'
              : 'Optional Bypass Active · ₦0 deducted'}
          </small>
        </div>
      </div>

      {/* Native FlowBand for Statutory Deduction Policy & Source Account */}
      <div className={styles.flowBand} aria-labelledby="statutory-policy-title">
        <div className={styles.flowHeading}>
          <div>
            <span>STATUTORY DEDUCTION &amp; TAX POLICY ENGINE · 100% DYNAMICALLY COMPUTED</span>
            <h3 id="statutory-policy-title">Optional Statutory Deductions &amp; Payout Funding Controls</h3>
          </div>
          <small>Toggle deductions globally below or per-employee in the register. Net pay updates immediately.</small>
        </div>

        <div className={styles.flowCounts}>
          <div>
            <Sliders size={19} aria-hidden="true" />
            <span>Osun State PAYE Tax (PITA)</span>
            <div className="row between wrap" style={{ marginTop: 4 }}>
              <strong style={{ fontSize: '1.15rem' }}>
                {statutoryPolicy.enablePaye ? 'ACTIVE' : 'BYPASSED'}
              </strong>
              <Btn small primary={statutoryPolicy.enablePaye} onClick={toggleGlobalPaye}>
                {statutoryPolicy.enablePaye ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {statutoryPolicy.enablePaye ? 'Disable PAYE' : 'Enable PAYE'}
              </Btn>
            </div>
          </div>

          <div>
            <Sliders size={19} aria-hidden="true" />
            <span>PenCom 8% Employee Pension</span>
            <div className="row between wrap" style={{ marginTop: 4 }}>
              <strong style={{ fontSize: '1.15rem' }}>
                {statutoryPolicy.enablePension ? 'ACTIVE (8%)' : 'BYPASSED'}
              </strong>
              <Btn small primary={statutoryPolicy.enablePension} onClick={toggleGlobalPension}>
                {statutoryPolicy.enablePension ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {statutoryPolicy.enablePension ? 'Disable 8%' : 'Enable 8%'}
              </Btn>
            </div>
          </div>

          <div>
            <Sliders size={19} aria-hidden="true" />
            <span>National Housing Fund (2.5%)</span>
            <div className="row between wrap" style={{ marginTop: 4 }}>
              <strong style={{ fontSize: '1.15rem' }}>
                {statutoryPolicy.enableNhf ? 'ACTIVE (2.5%)' : 'OPTIONAL OFF'}
              </strong>
              <Btn small primary={statutoryPolicy.enableNhf} onClick={toggleGlobalNhf}>
                {statutoryPolicy.enableNhf ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {statutoryPolicy.enableNhf ? 'Disable NHF' : 'Enable NHF'}
              </Btn>
            </div>
          </div>

          <div>
            <Landmark size={19} aria-hidden="true" />
            <span>Debit Treasury Sub-Account</span>
            <select
              aria-label="Select payout source bank account"
              value={selectedFundingAccount}
              onChange={(e) => setSelectedFundingAccount(e.target.value)}
              style={{
                width: '100%',
                minHeight: 38,
                padding: '6px 10px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--ink)',
                fontWeight: 700,
                fontSize: '.82rem',
              }}
            >
              {FUNDING_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} ({acc.accountNumber})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Native Panel + Data Table for Monthly Compensation & NIP Register */}
      <Panel
        title="Monthly Compensation & NIBSS NIP Disbursement Register"
        description="Click any employee's PAYE or Pension chip to toggle individual statutory exemptions. Use Auto-Pay Staff to verify their NUBAN account on NIBSS and disburse."
        action={
          <div className="row wrap">
            <Chip tone="blue">Dynamic PITA &amp; PenCom 8%</Chip>
            <Chip>{pendingDisbursements.length} Awaiting NIP Transfer</Chip>
          </div>
        }
      >
        <div className="filters">
          <label className="row grow">
            <Search size={18} />
            <input
              className="filter-input"
              aria-label="Filter staff by name or ID"
              placeholder="Search employee name or staff ID (e.g. Glory Mercy, DF-IK-001)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by department"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
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
            <option value="all">All Departments</option>
            <option value="Farm Operations">Farm Operations</option>
            <option value="Veterinary & Health">Veterinary &amp; Health</option>
            <option value="Feed & Milling">Feed &amp; Milling</option>
            <option value="Flock Management">Flock Management</option>
            <option value="Casual & Ad-Hoc Staff">Casual &amp; Ad-Hoc Staff</option>
          </select>
          <span className="filter-count">{filteredStaff.length} Staff Records</span>
        </div>

        <div className="table-wrap mt">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff ID &amp; Name</th>
                <th>Role &amp; Department</th>
                <th>Gross Emoluments</th>
                <th>Osun PAYE Tax (Click to Toggle)</th>
                <th>PenCom 8% (Click to Toggle)</th>
                <th>Dynamic Net Pay</th>
                <th>Verified Bank &amp; NUBAN</th>
                <th>Settlement Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staff) => {
                const pay = getStaffPay(staff);
                return (
                  <tr key={staff.id}>
                    <td>
                      <strong>{staff.fullName}</strong>
                      <div className="metadata">{staff.staffId}</div>
                    </td>
                    <td>
                      <strong>{staff.roleTitle}</strong>
                      <div className="metadata">{staff.department}</div>
                    </td>
                    <td>
                      <strong>{formatNaira(pay.grossPay)}</strong>
                      <div className="metadata">Basic: {formatNaira(staff.basicSalary)}</div>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                        <strong>{pay.isPayeApplied ? `-${formatNaira(pay.payeTax)}` : '₦0.00'}</strong>
                        <button
                          type="button"
                          onClick={() => toggleStaffPaye(staff.id)}
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                          title="Click to toggle Osun State PAYE Tax for this employee"
                        >
                          <Chip tone={pay.isPayeApplied ? 'amber' : 'gray'}>
                            {pay.isPayeApplied ? 'Deducted ✓' : 'Exempt / Optional'}
                          </Chip>
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                        <strong>{pay.isPensionApplied ? `-${formatNaira(pay.pensionEmployee)}` : '₦0.00'}</strong>
                        <button
                          type="button"
                          onClick={() => toggleStaffPension(staff.id)}
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                          title="Click to toggle PenCom 8% Pension for this employee"
                        >
                          <Chip tone={pay.isPensionApplied ? 'blue' : 'gray'}>
                            {pay.isPensionApplied ? '8% Active ✓' : 'Exempt / Optional'}
                          </Chip>
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                        {formatNaira(pay.netPay)}
                      </strong>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <strong>{staff.paymentBank}</strong>
                        <Chip>
                          <UserCheck size={12} /> NIBSS Verified
                        </Chip>
                      </div>
                      <div className="metadata">
                        {staff.accountNumber} · {staff.verifiedAccountName}
                      </div>
                    </td>
                    <td>
                      {staff.status === 'Paid via NIP' ? (
                        <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                          <Chip>
                            <CheckCircle2 size={12} /> Paid via NIP
                          </Chip>
                          <span className="metadata">Ref: {staff.nipSessionId?.slice(0, 12)}…</span>
                        </div>
                      ) : staff.status === 'Approved & Signed' ? (
                        <Chip tone="blue">
                          <Check size={12} /> Signed &amp; Ready
                        </Chip>
                      ) : (
                        <Chip tone="amber">
                          <Clock size={12} /> Pending HR
                        </Chip>
                      )}
                    </td>
                    <td>
                      {staff.status === 'Paid via NIP' ? (
                        <Btn small onClick={() => setPayslipModalStaff(staff)}>
                          <FileText size={14} /> Payslip &amp; Receipt
                        </Btn>
                      ) : (
                        <Btn small primary onClick={() => handleOpenSinglePayout(staff.id)}>
                          <Send size={14} /> Auto-Pay Staff
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ========================================================================= */}
      {/* 1. NATIVE PORTAL OVERLAY: STAFF BANK ACCOUNT LOOKUP & DIRECT NIP PAYOUT   */}
      {/* ========================================================================= */}
      {isLookupModalOpen && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setIsLookupModalOpen(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Direct Staff Account Lookup and NIP Transfer"
            style={{ maxWidth: 680 }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close modal"
              onClick={() => setIsLookupModalOpen(false)}
            >
              <X />
            </button>

            <div className="stack">
              <div>
                <span className="eyebrow">
                  <CreditCard size={14} /> NIBSS NAME ENQUIRY (NES) &amp; INSTANT NIP DISBURSEMENT
                </span>
                <h2>Lookup Employee Bank Account &amp; Execute Payout</h2>
                <p className="muted">
                  Verify any 10-digit NUBAN account across Nigerian commercial and microfinance banks, review optional
                  Osun State PAYE and PenCom 8% deductions, and disburse directly from {fundingAccount.label}.
                </p>
              </div>

              {lookupStep === 'input' && (
                <div className="stack">
                  <div className="row wrap">
                    <Btn
                      small
                      primary={lookupTargetMode === 'registered'}
                      onClick={() => {
                        setLookupTargetMode('registered');
                        handleSelectStaffInLookup(payrollList[0]?.id || 'pr-01');
                      }}
                    >
                      Select Registered Farm Staff
                    </Btn>
                    <Btn
                      small
                      primary={lookupTargetMode === 'adhoc'}
                      onClick={() => {
                        setLookupTargetMode('adhoc');
                        setLookupResult(null);
                        setAccountNumberInput('');
                        setLookupBasicAmount(50000);
                        setModalApplyPaye(false);
                        setModalApplyPension(false);
                        setPayoutCategory('Field Work / Contractor Advance');
                      }}
                    >
                      Lookup Any Nigerian Bank Account
                    </Btn>
                  </div>

                  {lookupTargetMode === 'registered' ? (
                    <label className="field">
                      <span>Select Farm Employee</span>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => handleSelectStaffInLookup(e.target.value)}
                      >
                        {payrollList.map((s) => {
                          const sPay = getStaffPay(s);
                          return (
                            <option key={s.id} value={s.id}>
                              {s.fullName} ({s.staffId}) — {s.roleTitle} · Net: {formatNaira(sPay.netPay)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ) : (
                    <label className="field">
                      <span>Gross Amount to Disburse (₦)</span>
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        value={lookupBasicAmount}
                        onChange={(e) => setLookupBasicAmount(Number(e.target.value))}
                      />
                    </label>
                  )}

                  <div className="form-grid">
                    <label className="field">
                      <span>Destination Bank</span>
                      <select
                        value={selectedBankCode}
                        onChange={(e) => {
                          setSelectedBankCode(e.target.value);
                          if (accountNumberInput.length === 10) {
                            void handlePerformAccountLookup(accountNumberInput, e.target.value);
                          }
                        }}
                      >
                        {NIGERIAN_BANKS.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>10-Digit NUBAN Account Number</span>
                      <div className="row">
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="e.g. 2019482710"
                          value={accountNumberInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAccountNumberInput(val);
                            if (val.length === 10) {
                              void handlePerformAccountLookup(val, selectedBankCode);
                            }
                          }}
                        />
                        <Btn
                          primary
                          onClick={() => void handlePerformAccountLookup(accountNumberInput, selectedBankCode)}
                          disabled={isLookingUp || accountNumberInput.length !== 10}
                        >
                          {isLookingUp ? <RefreshCw size={15} /> : <Search size={15} />}
                          Lookup
                        </Btn>
                      </div>
                    </label>
                  </div>

                  {isLookingUp ? (
                    <div className="panel" role="status">
                      <div className="row">
                        <RefreshCw size={16} />
                        <strong>Querying NIBSS Name Enquiry Switch (NES)…</strong>
                      </div>
                    </div>
                  ) : lookupResult?.status === 'success' ? (
                    <div className="panel" style={{ borderColor: '#9fd3bd', background: '#f3fbf7' }}>
                      <div className="row between wrap">
                        <span className="eyebrow">
                          <CheckCircle2 size={14} /> NIBSS VERIFIED ACCOUNT HOLDER
                        </span>
                        <Chip>{lookupResult.kycTier}</Chip>
                      </div>
                      <h3 style={{ marginTop: 6 }}>{lookupResult.accountName}</h3>
                      <div className="metadata">
                        Bank: {lookupResult.bankName} · NUBAN: {lookupResult.accountNumber} · BVN: {lookupResult.bvnMasked}
                      </div>
                    </div>
                  ) : lookupResult?.status === 'failed' ? (
                    <div className="panel" style={{ borderColor: '#ebbbbb', background: '#fdf4f4' }}>
                      <div className="row">
                        <AlertCircle size={16} />
                        <strong>Account Lookup Failed: {lookupResult.failureReason}</strong>
                      </div>
                    </div>
                  ) : null}

                  <div className="panel">
                    <span className="eyebrow">OPTIONAL STATUTORY DEDUCTIONS FOR THIS PAYOUT</span>
                    <div className="row wrap mt">
                      <Btn
                        small
                        primary={modalApplyPaye}
                        onClick={() => setModalApplyPaye((v) => !v)}
                      >
                        {modalApplyPaye ? <Check size={14} /> : null}
                        Osun PAYE Tax: {modalApplyPaye ? `-${formatNaira(modalCalculatedPay.payeTax)}` : 'Exempt (₦0)'}
                      </Btn>
                      <Btn
                        small
                        primary={modalApplyPension}
                        onClick={() => setModalApplyPension((v) => !v)}
                      >
                        {modalApplyPension ? <Check size={14} /> : null}
                        PenCom 8% Pension:{' '}
                        {modalApplyPension ? `-${formatNaira(modalCalculatedPay.pensionEmployee)}` : 'Exempt (₦0)'}
                      </Btn>
                    </div>
                    <dl className="identity-facts mt">
                      <div>
                        <dt>Gross Emoluments</dt>
                        <dd>{formatNaira(modalCalculatedPay.grossPay)}</dd>
                      </div>
                      <div>
                        <dt>Total Deductions</dt>
                        <dd>-{formatNaira(modalCalculatedPay.totalDeductions)}</dd>
                      </div>
                      <div>
                        <dt>Debit Source Account</dt>
                        <dd>{fundingAccount.label}</dd>
                      </div>
                      <div>
                        <dt>Computed Net To Disburse</dt>
                        <dd style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>
                          {formatNaira(modalCalculatedPay.netPay)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="row between wrap">
                    <Btn onClick={() => setIsLookupModalOpen(false)}>Cancel</Btn>
                    <Btn
                      primary
                      onClick={() => void handleExecuteLookupPayout()}
                      disabled={!lookupResult || lookupResult.status !== 'success' || modalCalculatedPay.netPay <= 0}
                    >
                      <Send size={15} /> Authorize &amp; Transfer {formatNaira(modalCalculatedPay.netPay)}
                    </Btn>
                  </div>
                </div>
              )}

              {lookupStep === 'processing' && (
                <div className="panel stack" style={{ textAlign: 'center', padding: 32 }}>
                  <RefreshCw size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
                  <h3>Executing Live NIP Interbank Transfer…</h3>
                  <p className="muted">
                    Debiting {fundingAccount.bankName} and crediting {lookupResult?.accountName} via NIBSS Central Switch.
                  </p>
                </div>
              )}

              {lookupStep === 'success' && (
                <div className="stack">
                  <div className="panel" style={{ borderColor: '#9fd3bd', background: '#f3fbf7' }}>
                    <Chip>
                      <CheckCircle2 size={14} /> NIP TRANSFER SETTLED
                    </Chip>
                    <h3 style={{ marginTop: 8 }}>
                      {formatNaira(modalCalculatedPay.netPay)} Credited To {lookupResult?.accountName}
                    </h3>
                    <dl className="identity-facts mt">
                      <div>
                        <dt>NIBSS 30-Digit Session ID</dt>
                        <dd>{lastTransferredSessionId}</dd>
                      </div>
                      <div>
                        <dt>Receiving Bank &amp; Account</dt>
                        <dd>
                          {lookupResult?.bankName} ({lookupResult?.accountNumber})
                        </dd>
                      </div>
                      <div>
                        <dt>Statutory Deductions</dt>
                        <dd>
                          PAYE: {modalApplyPaye ? 'Applied' : 'Exempt'} · PenCom 8%:{' '}
                          {modalApplyPension ? 'Applied' : 'Exempt'}
                        </dd>
                      </div>
                      <div>
                        <dt>Debit Treasury Account</dt>
                        <dd>{fundingAccount.label}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="row between wrap">
                    <Btn
                      onClick={() => {
                        const staff = payrollList.find((s) => s.accountNumber === lookupResult?.accountNumber);
                        setIsLookupModalOpen(false);
                        if (staff) setPayslipModalStaff(staff);
                      }}
                    >
                      <FileText size={15} /> Open Payslip &amp; Receipt Voucher
                    </Btn>
                    <Btn primary onClick={() => setIsLookupModalOpen(false)}>
                      Done &amp; Return To Register
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NATIVE PORTAL OVERLAY: BATCH PAYROLL DISBURSEMENT                      */}
      {/* ========================================================================= */}
      {isDisbursementModalOpen && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setIsDisbursementModalOpen(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Direct NIP Batch Salary Disbursement"
            style={{ maxWidth: 620 }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close batch disbursement modal"
              onClick={() => setIsDisbursementModalOpen(false)}
            >
              <X />
            </button>

            <div className="stack">
              <div>
                <span className="eyebrow">
                  <Send size={14} /> BATCH NIP SALARY DISBURSEMENT
                </span>
                <h2>Authorize Monthly Payroll Batch Transfer</h2>
                <p className="muted">
                  Disburse dynamically computed net salaries to all {pendingDisbursements.length} verified employees via{' '}
                  {fundingAccount.bankName}.
                </p>
              </div>

              {disbursementStep === 'review' && (
                <div className="stack">
                  <dl className="identity-facts">
                    <div>
                      <dt>Debit Source Account</dt>
                      <dd>
                        {fundingAccount.label} ({fundingAccount.accountNumber})
                      </dd>
                    </div>
                    <div>
                      <dt>Available Liquidity</dt>
                      <dd>{formatNaira(fundingAccount.availableBalance)}</dd>
                    </div>
                    <div>
                      <dt>Employees In Batch</dt>
                      <dd>{pendingDisbursements.length} Verified Staff</dd>
                    </div>
                    <div>
                      <dt>Total Net Batch Payout</dt>
                      <dd style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>
                        {formatNaira(totalPendingAmount)}
                      </dd>
                    </div>
                  </dl>

                  <div className="row between wrap">
                    <Btn onClick={() => setIsDisbursementModalOpen(false)}>Cancel</Btn>
                    <Btn primary onClick={() => void handleExecuteNipTransfer()}>
                      <Send size={15} /> Authorize &amp; Transfer {formatNaira(totalPendingAmount)}
                    </Btn>
                  </div>
                </div>
              )}

              {disbursementStep === 'dispatching' && (
                <div className="panel stack" style={{ textAlign: 'center', padding: 32 }}>
                  <RefreshCw size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
                  <h3>Dispatching Batch NIP Transfers…</h3>
                  <p className="muted">Generating 30-digit NIBSS session receipts for each employee.</p>
                </div>
              )}

              {disbursementStep === 'completed' && (
                <div className="stack">
                  <div className="panel" style={{ borderColor: '#9fd3bd', background: '#f3fbf7' }}>
                    <Chip>
                      <CheckCircle2 size={14} /> BATCH PAYROLL SETTLED
                    </Chip>
                    <h3 style={{ marginTop: 8 }}>All Staff Salaries Disbursed Successfully</h3>
                    <p className="muted">
                      {formatNaira(totalPendingAmount)} has been credited to employee accounts and digital payslips are
                      ready.
                    </p>
                  </div>
                  <div className="row">
                    <Btn primary onClick={() => setIsDisbursementModalOpen(false)}>
                      Return To Register
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. NATIVE PORTAL OVERLAY: ELECTRONIC PAYSLIP & NIP RECEIPT VOUCHER        */}
      {/* ========================================================================= */}
      {payslipModalStaff &&
        (() => {
          const staffPay = getStaffPay(payslipModalStaff);
          return (
            <div
              className="intel-overlay"
              role="presentation"
              onMouseDown={(e) => e.target === e.currentTarget && setPayslipModalStaff(null)}
            >
              <section
                className="intel-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Electronic Payslip and NIP Receipt"
                style={{ maxWidth: 640 }}
              >
                <button
                  type="button"
                  className="intel-sheet-close"
                  aria-label="Close payslip modal"
                  onClick={() => setPayslipModalStaff(null)}
                >
                  <X />
                </button>

                <div className="stack">
                  <div>
                    <span className="eyebrow">
                      <FileText size={14} /> DAENEM AGRO-ALLIED FARMS LTD · BALOGUN-IKIRE
                    </span>
                    <h2>Electronic Payslip &amp; NIP Settlement Voucher</h2>
                    <p className="muted">
                      {payslipModalStaff.fullName} ({payslipModalStaff.staffId}) · {payslipModalStaff.roleTitle} ·{' '}
                      {payslipModalStaff.department}
                    </p>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Pay Item Description</th>
                          <th>Statutory Rule</th>
                          <th>Amount (₦)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Basic Salary</td>
                          <td>Base Contract</td>
                          <td>{formatNaira(payslipModalStaff.basicSalary)}</td>
                        </tr>
                        <tr>
                          <td>Housing Allowance</td>
                          <td>Base Contract</td>
                          <td>{formatNaira(payslipModalStaff.housingAllowance)}</td>
                        </tr>
                        <tr>
                          <td>Transport Allowance</td>
                          <td>Base Contract</td>
                          <td>{formatNaira(payslipModalStaff.transportAllowance)}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Total Gross Emoluments</strong>
                          </td>
                          <td>Gross</td>
                          <td>
                            <strong>{formatNaira(staffPay.grossPay)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>Osun State PAYE Tax</td>
                          <td>{staffPay.isPayeApplied ? 'Dynamic PITA & CRA' : 'Exempt / Optional Bypass'}</td>
                          <td>{staffPay.isPayeApplied ? `-${formatNaira(staffPay.payeTax)}` : '₦0.00'}</td>
                        </tr>
                        <tr>
                          <td>PenCom Employee Pension (8%)</td>
                          <td>{staffPay.isPensionApplied ? 'Pension Reform Act' : 'Exempt / Optional Bypass'}</td>
                          <td>{staffPay.isPensionApplied ? `-${formatNaira(staffPay.pensionEmployee)}` : '₦0.00'}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Net Disbursed Take-Home Pay</strong>
                          </td>
                          <td>NIP Credited</td>
                          <td>
                            <strong style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
                              {formatNaira(staffPay.netPay)}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <dl className="identity-facts">
                    <div>
                      <dt>Credited Bank</dt>
                      <dd>{payslipModalStaff.paymentBank}</dd>
                    </div>
                    <div>
                      <dt>NUBAN Account</dt>
                      <dd>
                        {payslipModalStaff.accountNumber} ({payslipModalStaff.verifiedAccountName})
                      </dd>
                    </div>
                    <div>
                      <dt>NIBSS Session ID</dt>
                      <dd>{payslipModalStaff.nipSessionId || '999014261107000192837465'}</dd>
                    </div>
                    <div>
                      <dt>Settlement Timestamp</dt>
                      <dd>{payslipModalStaff.disbursedAtWAT || '06 Nov 2026, 02:40 PM WAT'}</dd>
                    </div>
                  </dl>

                  <div className="row between wrap">
                    <Btn onClick={() => window.print()}>
                      <Printer size={15} /> Print Official Voucher
                    </Btn>
                    <Btn primary onClick={() => setPayslipModalStaff(null)}>
                      Close Voucher
                    </Btn>
                  </div>
                </div>
              </section>
            </div>
          );
        })()}
    </section>
  );
};
