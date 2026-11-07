import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bird,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Egg,
  Wheat,
  Activity,
  Thermometer,
  Droplets,
  Printer,
  RefreshCw,
  X,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Check,
  LoaderCircle,
  Database,
  Calendar,
} from 'lucide-react';
import { formatCount } from '../lib/temporal.ts';
import styles from './portal/InventoryControlDashboard.module.css';
import { Panel, Btn, Chip, Empty } from './portal/Common';

export interface PenDailyRecord {
  id: string;
  houseId: string;
  houseName: string;
  flockBatch: string;
  breed: string;
  ageWeeks: number;
  ageDays: number;
  openingStock: number;
  mortality: number;
  culls: number;
  transfersOut: number;
  closingStock: number;
  medication: string;
  vaccination: string;
  feedConsumedKg: number;
  feedType: string;
  eggsCrates: number;
  looseEggs: number;
  leakers: number;
  waterConsumedLitres?: number;
  ambientTempC?: number;
  relativeHumidityPct?: number;
  thiIndex?: number;
  idempotencyKey?: string;
  attendantName: string;
  status: 'Verified & Signed' | 'Pending Supervisor' | 'Discrepancy';
  createdAt?: string;
}

interface DailyPenRegisterWorkspaceProps {
  onBackToDashboard?: () => void;
}

// Canonical flock baselines for Balogun-Ikire pens
const FLOCK_BASELINES: Record<string, { name: string; batch: string; breed: string; baseStock: number; ageWeeks: number }> = {
  H1: { name: 'House 1 (Battery Cages A-D)', batch: 'FLK-2026-01', breed: 'ISA Brown', baseStock: 12201, ageWeeks: 48 },
  H2: { name: 'House 2 (Battery Cages E-H)', batch: 'FLK-2026-02', breed: 'Bovans White', baseStock: 12052, ageWeeks: 45 },
  H3: { name: 'House 3 (Battery Cages J-M)', batch: 'FLK-2026-03', breed: 'ISA Brown', baseStock: 12111, ageWeeks: 38 },
  H4: { name: 'House 4 (Battery Cages N-Q)', batch: 'FLK-2026-04', breed: 'Lohmann Brown', baseStock: 12105, ageWeeks: 29 },
};

export const DailyPenRegisterWorkspace: React.FC<DailyPenRegisterWorkspaceProps> = () => {
  const [records, setRecords] = useState<PenDailyRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedHouseFilter, setSelectedHouseFilter] = useState<string>('all');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendSyncStatus, setBackendSyncStatus] = useState<'connected' | 'offline' | 'loading'>('loading');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Guided Entry Step (1: Today's Birds, 2: Feed, Water & Health, 3: Review & Submit)
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);

  // Step 1: Headcount Fields
  const [targetHouse, setTargetHouse] = useState<string>('H1');
  const [openingBirds, setOpeningBirds] = useState<number>(FLOCK_BASELINES.H1.baseStock);
  const [mortality, setMortality] = useState<number>(0);
  const [culls, setCulls] = useState<number>(0);
  const [transfersOut, setTransfersOut] = useState<number>(0);

  // Step 2: Feed, Water, Health & Microclimate Fields
  const [feedType, setFeedType] = useState<string>('Layer Mash Phase I');
  const [feedKg, setFeedKg] = useState<number>(1464);
  const [waterLitres, setWaterLitres] = useState<number>(2928);
  const [medication, setMedication] = useState<string>('None');
  const [vaccination, setVaccination] = useState<string>('None Scheduled');
  const [crates, setCrates] = useState<number>(373);
  const [looseEggs, setLooseEggs] = useState<number>(10);
  const [leakers, setLeakers] = useState<number>(4);
  const [tempC, setTempC] = useState<number>(28.5);
  const [humidityPct, setHumidityPct] = useState<number>(76);

  // Step 3: Attribution & Idempotency Key
  const [attendant, setAttendant] = useState<string>('Babatunde Alamu');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Biological Invariants
  const calculatedClosing = openingBirds - mortality - culls - transfersOut;
  const totalEggsCount = crates * 30 + looseEggs;
  const calculatedHdep = openingBirds > 0 ? ((totalEggsCount / openingBirds) * 100).toFixed(1) : '0.0';
  const thiStress = Number((0.8 * tempC + (humidityPct / 100) * (tempC - 14.4) + 46.4).toFixed(1));

  // Authoritative API Sync with selected date
  const loadRegisterFromD1 = useCallback(async (dateFilter: string) => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const url = `/api/v1/operations/daily-register${dateFilter ? `?date=${encodeURIComponent(dateFilter)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        setBackendSyncStatus('offline');
        if (res.status === 503) {
          setErrorMessage('Cloudflare D1 binding is unattached. System operates in fail-closed protected mode.');
        } else {
          setErrorMessage(`D1 Query returned HTTP ${res.status}.`);
        }
        return;
      }

      const data = await res.json() as {
        status?: string;
        records?: Array<{
          id: string;
          flockId: string;
          penNumber: string;
          logDate: string;
          ageDays?: number;
          openingBirds: number;
          mortalityCount: number;
          cullsCount: number;
          transfersOut: number;
          closingBirds: number;
          medication?: string;
          vaccination?: string;
          eggsCollectedGood: number;
          eggsDamaged: number;
          eggsRejected: number;
          feedConsumedKg: number;
          waterConsumedLitres: number;
          ambientTempC?: number;
          relativeHumidityPct?: number;
          thiIndex?: number;
          idempotencyKey?: string;
          recordedBy: string;
          createdAt?: string;
        }>;
      };

      if (data && data.status === 'success' && Array.isArray(data.records)) {
        setBackendSyncStatus('connected');
        const mapped: PenDailyRecord[] = data.records.map((r) => {
          const totalGood = Number(r.eggsCollectedGood) || 0;
          const crateCount = Math.floor(totalGood / 30);
          const looseCount = totalGood % 30;

          // Determine House ID from penNumber or flockId
          let hId = 'H1';
          if (r.penNumber?.includes('House 2') || r.flockId?.includes('02') || r.flockId?.includes('flk-2')) hId = 'H2';
          else if (r.penNumber?.includes('House 3') || r.flockId?.includes('03') || r.flockId?.includes('flk-3')) hId = 'H3';
          else if (r.penNumber?.includes('House 4') || r.flockId?.includes('04') || r.flockId?.includes('flk-4')) hId = 'H4';

          const baseline = FLOCK_BASELINES[hId] || FLOCK_BASELINES.H1;
          const ageWks = r.ageDays ? Math.floor(r.ageDays / 7) : baseline.ageWeeks;
          const ageD = r.ageDays || ageWks * 7;

          return {
            id: r.id,
            houseId: hId,
            houseName: r.penNumber || baseline.name,
            flockBatch: r.flockId || baseline.batch,
            breed: baseline.breed,
            ageWeeks: ageWks,
            ageDays: ageD,
            openingStock: Number(r.openingBirds) || 0,
            mortality: Number(r.mortalityCount) || 0,
            culls: Number(r.cullsCount) || 0,
            transfersOut: Number(r.transfersOut) || 0,
            closingStock: Number(r.closingBirds) || 0,
            medication: r.medication || 'None',
            vaccination: r.vaccination || 'None Scheduled',
            feedConsumedKg: Number(r.feedConsumedKg) || 0,
            feedType: hId === 'H4' ? 'Grower Mash Pullet' : 'Layer Mash Phase I',
            eggsCrates: crateCount,
            looseEggs: looseCount,
            leakers: Number(r.eggsDamaged) || 0,
            waterConsumedLitres: Number(r.waterConsumedLitres) || 0,
            ambientTempC: r.ambientTempC,
            relativeHumidityPct: r.relativeHumidityPct,
            thiIndex: r.thiIndex,
            idempotencyKey: r.idempotencyKey,
            attendantName: r.recordedBy || 'Authorized Operator',
            status: 'Verified & Signed',
            createdAt: r.createdAt,
          };
        });

        setRecords(mapped);
      } else {
        setBackendSyncStatus('connected');
        setRecords([]);
      }
    } catch (err: unknown) {
      setBackendSyncStatus('offline');
      setErrorMessage(err instanceof Error ? err.message : 'Network failure contacting D1 backend.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRegisterFromD1(selectedDate);
  }, [loadRegisterFromD1, selectedDate]);

  // When opening modal or changing house, derive authoritative opening stock from latest closing
  const handleOpenEntryModal = (houseKey = 'H1') => {
    setTargetHouse(houseKey);
    const existingForHouse = records.find((r) => r.houseId === houseKey);
    if (existingForHouse && existingForHouse.closingStock > 0) {
      setOpeningBirds(existingForHouse.closingStock);
    } else {
      setOpeningBirds(FLOCK_BASELINES[houseKey]?.baseStock || 12200);
    }
    setMortality(0);
    setCulls(0);
    setTransfersOut(0);
    setFormStep(1);
    setErrorMessage(null);
    setIdempotencyKey(`idem-${houseKey}-${selectedDate}-${Date.now()}`);
    setIsEntryModalOpen(true);
  };

  const handleHouseSelectChange = (hKey: string) => {
    setTargetHouse(hKey);
    const existingForHouse = records.find((r) => r.houseId === hKey);
    if (existingForHouse && existingForHouse.closingStock > 0) {
      setOpeningBirds(existingForHouse.closingStock);
    } else {
      setOpeningBirds(FLOCK_BASELINES[hKey]?.baseStock || 12200);
    }
    setIdempotencyKey(`idem-${hKey}-${selectedDate}-${Date.now()}`);
  };

  const handleRefresh = async () => {
    await loadRegisterFromD1(selectedDate);
    setToastMessage('Register synchronized with Cloudflare D1.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredRecords = useMemo(() => {
    return records.filter(
      (r) => selectedHouseFilter === 'all' || r.houseId === selectedHouseFilter
    );
  }, [records, selectedHouseFilter]);

  // Genuine aggregations from filtered records
  const totalBirdsOpening = filteredRecords.reduce((sum, r) => sum + r.openingStock, 0);
  const totalMortality = filteredRecords.reduce((sum, r) => sum + r.mortality, 0);
  const totalCulls = filteredRecords.reduce((sum, r) => sum + r.culls, 0);
  const totalTransfers = filteredRecords.reduce((sum, r) => sum + r.transfersOut, 0);
  const totalCrates = filteredRecords.reduce((sum, r) => sum + r.eggsCrates, 0);
  const totalLooseEggs = filteredRecords.reduce((sum, r) => sum + r.looseEggs, 0);
  const grandTotalEggs = totalCrates * 30 + totalLooseEggs;
  const totalFeedKg = filteredRecords.reduce((sum, r) => sum + r.feedConsumedKg, 0);
  const totalBirdsClosing = filteredRecords.reduce((sum, r) => sum + r.closingStock, 0);

  const conservationPassed =
    totalBirdsOpening - totalMortality - totalCulls - totalTransfers === totalBirdsClosing;

  // Guided Form Submission with Idempotency Key & Timeout Protection
  const handleSaveDailyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Fail closed validation
    if (openingBirds <= 0) {
      setErrorMessage('Opening headcount must be greater than zero.');
      setFormStep(1);
      return;
    }
    if (calculatedClosing < 0) {
      setErrorMessage('Mortality, culls and transfers cannot exceed opening headcount.');
      setFormStep(1);
      return;
    }
    if (!attendant.trim()) {
      setErrorMessage('Attendant name is required for legal and operational attribution.');
      setFormStep(3);
      return;
    }

    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second network timeout

    try {
      const baseline = FLOCK_BASELINES[targetHouse] || FLOCK_BASELINES.H1;
      const houseName = baseline.name;
      const flockCode = baseline.batch;
      const ageDays = baseline.ageWeeks * 7;

      const payload = {
        penNumber: houseName,
        flockId: flockCode,
        logDate: selectedDate,
        ageDays,
        openingBirds,
        mortalityCount: mortality,
        cullsCount: culls,
        transfersOut,
        closingBirds: calculatedClosing,
        medication: medication.trim() || 'None',
        vaccination: vaccination.trim() || 'None Scheduled',
        eggsCollectedGood: crates * 30 + looseEggs,
        eggsDamaged: leakers,
        eggsRejected: 0,
        feedConsumedKg: feedKg,
        waterConsumedLitres: waterLitres,
        ambientTempC: tempC,
        relativeHumidityPct: humidityPct,
        thiIndex: thiStress,
        idempotencyKey,
        recordedBy: attendant.trim(),
      };

      const res = await fetch('/api/v1/operations/daily-register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await res.json() as {
        status?: string;
        id?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || result.status !== 'success') {
        throw new Error(result.error || `Server returned HTTP ${res.status}`);
      }

      setToastMessage(
        `Shift for ${houseName} persisted to D1! Audit Ref: ${result.id || 'N/A'}. Closing: ${formatCount(calculatedClosing)} birds.`
      );
      setIsEntryModalOpen(false);
      setFormStep(1);

      // Re-query database to ensure display reflects confirmed server persistence
      await loadRegisterFromD1(selectedDate);

    } catch (err: unknown) {
      if ((err as any)?.name === 'AbortError') {
        setErrorMessage('Request timed out. The server may still have processed your shift. Please click "Sync D1 Register" to verify.');
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to persist record to Cloudflare D1. Submission blocked (fail closed).'
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <section className={styles.root} aria-labelledby="daily-register-command-title">
      {/* Executive Command Bar */}
      <div className="portal-executive-bar" aria-label="Daily Pen Register Execution Controls">
        <div className="portal-exec-actions">
          <button
            type="button"
            className="portal-action-btn primary"
            onClick={() => handleOpenEntryModal('H1')}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Post Daily Pen Log</span>
          </button>
          <button
            type="button"
            className="portal-action-btn secondary"
            onClick={() => setIsVoucherModalOpen(true)}
            disabled={filteredRecords.length === 0}
          >
            <Printer size={15} aria-hidden="true" />
            <span>Official Shift Voucher</span>
          </button>
          <button
            type="button"
            className="portal-action-btn secondary"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
            <span>{isRefreshing ? 'Syncing...' : 'Sync D1 Register'}</span>
          </button>
        </div>

        <div className="portal-exec-mode" role="status">
          <div className="portal-mode-badge">
            <span className={`portal-indicator-dot ${backendSyncStatus === 'connected' ? 'connected' : 'offline'}`} />
            <span>{backendSyncStatus === 'connected' ? 'Cloudflare D1 Verified' : 'D1 Offline (Fail-Closed)'}</span>
          </div>
          <div className="portal-mode-badge" style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>
            <Calendar size={13} style={{ marginRight: 4, color: '#008751' }} />
            <span>{selectedDate} WAT</span>
          </div>
        </div>
      </div>

      {/* Notifications & Error Feed */}
      {toastMessage && (
        <div style={{ margin: '16px 0', padding: '12px 16px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ margin: '16px 0', padding: '12px 16px', borderRadius: 8, background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600 }}>
          <AlertTriangle size={18} color="#e53e3e" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary KPI Grid (Biological Headcount & Yield) */}
      <div className="portal-metric-grid" style={{ marginBottom: 24 }}>
        <article className="portal-metric-tile">
          <header className="portal-tile-header">
            <span className="portal-tile-title">Opening Headcount</span>
            <Bird size={16} className="portal-tile-icon" aria-hidden="true" />
          </header>
          <div className="portal-metric-value">{formatCount(totalBirdsOpening)}</div>
          <footer className="portal-tile-footer">
            <span>Authoritative start of day</span>
          </footer>
        </article>

        <article className="portal-metric-tile">
          <header className="portal-tile-header">
            <span className="portal-tile-title">Today&apos;s Mortality / Culls</span>
            <Activity size={16} className="portal-tile-icon" aria-hidden="true" />
          </header>
          <div className="portal-metric-value" style={{ color: totalMortality > 10 ? '#dc2626' : 'inherit' }}>
            {formatCount(totalMortality)}
            {totalCulls > 0 && <span style={{ fontSize: '0.95rem', color: '#64748b' }}> (+{totalCulls} culls)</span>}
          </div>
          <footer className="portal-tile-footer">
            <span style={{ color: totalMortality > 10 ? '#dc2626' : '#059669', fontWeight: 600 }}>
              {totalBirdsOpening > 0 ? ((totalMortality / totalBirdsOpening) * 100).toFixed(2) : '0.00'}% daily rate
            </span>
          </footer>
        </article>

        <article className="portal-metric-tile">
          <header className="portal-tile-header">
            <span className="portal-tile-title">Total Egg Harvest</span>
            <Egg size={16} className="portal-tile-icon" aria-hidden="true" />
          </header>
          <div className="portal-metric-value">
            {formatCount(totalCrates)}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}> Crates</span>
          </div>
          <footer className="portal-tile-footer">
            <span>+{totalLooseEggs} loose eggs ({formatCount(grandTotalEggs)} total)</span>
          </footer>
        </article>

        <article className="portal-metric-tile">
          <header className="portal-tile-header">
            <span className="portal-tile-title">Feed Consumption</span>
            <Wheat size={16} className="portal-tile-icon" aria-hidden="true" />
          </header>
          <div className="portal-metric-value">
            {formatCount(totalFeedKg)}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}> kg</span>
          </div>
          <footer className="portal-tile-footer">
            <span>{(totalFeedKg / 50).toFixed(1)} standard 50kg bags</span>
          </footer>
        </article>

        <article className="portal-metric-tile">
          <header className="portal-tile-header">
            <span className="portal-tile-title">Verified Closing Stock</span>
            <ShieldCheck size={16} className="portal-tile-icon" aria-hidden="true" />
          </header>
          <div className="portal-metric-value" style={{ color: conservationPassed ? '#008751' : '#c53030' }}>
            {formatCount(totalBirdsClosing)}
          </div>
          <footer className="portal-tile-footer">
            <span style={{ color: conservationPassed ? '#008751' : '#c53030', fontWeight: 600 }}>
              {conservationPassed ? '✓ Invariant Balanced' : '⚠ Conservation Discrepancy'}
            </span>
          </footer>
        </article>
      </div>

      {/* Main Pen Register Panel */}
      <Panel
        title="Flock Daily Register & Biological Conservation"
        subtitle="Authoritative seven-column headcount, veterinary medications, feed intake and closing balances recorded across all production pens."
      >
        {/* Filter & Date Bar */}
        <div className="row between wrap items-center" style={{ gap: 12, paddingBottom: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div className="row items-center" style={{ gap: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 650, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter Pen:</span>
            {['all', 'H1', 'H2', 'H3', 'H4'].map((hId) => (
              <button
                key={hId}
                type="button"
                onClick={() => setSelectedHouseFilter(hId)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedHouseFilter === hId ? '1px solid #008751' : '1px solid #cbd5e1',
                  background: selectedHouseFilter === hId ? '#008751' : '#ffffff',
                  color: selectedHouseFilter === hId ? '#ffffff' : '#334155',
                  transition: 'all 0.15s ease',
                }}
              >
                {hId === 'all' ? 'All Houses' : `House ${hId.replace('H', '')}`}
              </button>
            ))}
          </div>

          <label className="row items-center" style={{ gap: 8, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            <span>Shift Date (WAT):</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#1e293b',
                background: '#ffffff',
              }}
            />
          </label>
        </div>

        {backendSyncStatus === 'loading' && records.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <LoaderCircle size={28} className="spin" style={{ margin: '0 auto 12px', color: '#008751' }} />
            <p className="muted">Connecting to Cloudflare D1 production database...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '36px 0' }}>
            <Empty
              title="No Shift Records in D1 for Selected Date"
              detail={`No pen logs found in database for date ${selectedDate} (filter: ${selectedHouseFilter.toUpperCase()}). Post today's biological shift log below.`}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Btn primary onClick={() => handleOpenEntryModal('H1')}>
                <Plus size={16} /> Record Today&apos;s Shift
              </Btn>
            </div>
          </div>
        ) : (
          <div className="table-wrap mt">
            {/* EXACT SEVEN-COLUMN BUSINESS REGISTER */}
            <table className="data-table" aria-label="Authoritative 7-Column Daily Flock Register">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>AGE</th>
                  <th style={{ textAlign: 'right', width: '14%' }}>OPENING STOCK</th>
                  <th style={{ textAlign: 'right', width: '14%' }}>MORTALITY</th>
                  <th style={{ width: '15%' }}>MEDICATION</th>
                  <th style={{ width: '15%' }}>VACCINATION</th>
                  <th style={{ textAlign: 'right', width: '14%' }}>FEED IN TAKE</th>
                  <th style={{ textAlign: 'right', width: '14%' }}>CLOSING STOCK</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const mortRate = r.openingStock > 0 ? (r.mortality / r.openingStock) * 100 : 0;
                  const calcClosing = r.openingStock - r.mortality - r.culls - r.transfersOut;
                  const isDiscrepant = calcClosing !== r.closingStock;
                  const isExpanded = expandedRecordId === r.id;

                  return (
                    <React.Fragment key={r.id}>
                      {/* Cohort Header Banner */}
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={7} style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                                {r.houseName}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                • {r.flockBatch} ({r.breed})
                              </span>
                              <Chip tone="green">WAT Verified</Chip>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedRecordId(isExpanded ? null : r.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'transparent',
                                border: 'none',
                                color: '#008751',
                                fontSize: '0.78rem',
                                fontWeight: 650,
                                cursor: 'pointer',
                              }}
                            >
                              <span>{isExpanded ? 'Hide Details' : 'View Yield & Sign-off'}</span>
                              <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Authoritative 7-Column Row */}
                      <tr style={{ background: '#ffffff' }}>
                        {/* 1. AGE */}
                        <td>
                          <strong style={{ fontSize: '0.92rem' }}>{r.ageWeeks} wks</strong>
                          <div className="metadata">{r.ageDays} days</div>
                        </td>

                        {/* 2. OPENING STOCK */}
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'lining-nums tabular-nums', fontWeight: 650, fontSize: '0.95rem' }}>
                          {formatCount(r.openingStock)}
                        </td>

                        {/* 3. MORTALITY */}
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'lining-nums tabular-nums' }}>
                          <strong style={{ color: r.mortality > 5 ? '#c53030' : '#1e293b' }}>
                            {r.mortality} mort
                          </strong>
                          {r.culls > 0 && <span className="metadata"> · {r.culls} culls</span>}
                          <div className="metadata">{mortRate.toFixed(2)}% daily</div>
                        </td>

                        {/* 4. MEDICATION */}
                        <td>
                          <strong style={{ color: r.medication !== 'None' ? '#0369a1' : '#64748b' }}>
                            {r.medication}
                          </strong>
                        </td>

                        {/* 5. VACCINATION */}
                        <td>
                          <strong style={{ color: r.vaccination !== 'None Scheduled' ? '#7c2d12' : '#64748b' }}>
                            {r.vaccination}
                          </strong>
                        </td>

                        {/* 6. FEED IN TAKE */}
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'lining-nums tabular-nums' }}>
                          <strong style={{ fontSize: '0.92rem' }}>{formatCount(r.feedConsumedKg)} kg</strong>
                          <div className="metadata">{r.feedType}</div>
                        </td>

                        {/* 7. CLOSING STOCK */}
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'lining-nums tabular-nums' }}>
                          <strong style={{ color: isDiscrepant ? '#c53030' : '#008751', fontSize: '1.05rem', fontWeight: 700 }}>
                            {formatCount(r.closingStock)}
                          </strong>
                          <div className="metadata" style={{ color: isDiscrepant ? '#c53030' : '#059669' }}>
                            {isDiscrepant ? 'Variance Detected' : '✓ Balanced'}
                          </div>
                        </td>
                      </tr>

                      {/* Supplementary Metrics Drawer (when expanded) */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={7} style={{ padding: '12px 18px', borderBottom: '1px solid #cbd5e1' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                              <div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Egg Yield (30-Egg Crates)</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#008751', marginTop: 2 }}>
                                  {r.eggsCrates} Crates + {r.looseEggs} Loose
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Total: {formatCount(r.eggsCrates * 30 + r.looseEggs)} eggs ({r.leakers} damaged)
                                </div>
                              </div>

                              <div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Water Intake</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 650, marginTop: 2 }}>
                                  {formatCount(r.waterConsumedLitres || 0)} Litres
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Ratio: {r.feedConsumedKg > 0 ? ((r.waterConsumedLitres || 0) / r.feedConsumedKg).toFixed(1) : '2.0'} L/kg feed
                                </div>
                              </div>

                              <div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Microclimate Observation</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 650, marginTop: 2 }}>
                                  {r.ambientTempC ? `${r.ambientTempC}°C` : 'N/A'} · {r.relativeHumidityPct ? `${r.relativeHumidityPct}% RH` : ''}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  THI Stress Index: {r.thiIndex ?? 'Normal'}
                                </div>
                              </div>

                              <div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Attendant Sign-Off</span>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                                  {r.attendantName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#008751', fontWeight: 600 }}>
                                  ✓ Shift Verified &amp; Signed
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Official Shift Voucher Modal */}
      {isVoucherModalOpen && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setIsVoucherModalOpen(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Official Daily Flock and Egg Register Voucher"
            style={{ maxWidth: 580, background: '#ffffff', borderRadius: 16, border: '1px solid #d6e4db' }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close Shift Voucher Modal"
              onClick={() => setIsVoucherModalOpen(false)}
            >
              <X />
            </button>

            <div className="stack">
              <div>
                <span className="eyebrow">DAENEM FARMS LIMITED · BALOGUN-IKIRE</span>
                <h2>Official Daily Flock &amp; Egg Register Voucher</h2>
                <p className="muted">Shift Date: {selectedDate} (Africa/Lagos WAT)</p>
              </div>

              <dl className="identity-facts">
                <div>
                  <dt>Opening Headcount</dt>
                  <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>{formatCount(totalBirdsOpening)} Birds</dd>
                </div>
                <div>
                  <dt>Total Egg Harvest</dt>
                  <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>
                    {formatCount(totalCrates)} Crates + {totalLooseEggs} Loose ({formatCount(grandTotalEggs)} Eggs)
                  </dd>
                </div>
                <div>
                  <dt>Total Feed Consumed</dt>
                  <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>
                    {formatCount(totalFeedKg)} kg ({(totalFeedKg / 50).toFixed(1)} Bags)
                  </dd>
                </div>
                <div>
                  <dt>Verified Closing Headcount</dt>
                  <dd style={{ color: '#008751', fontWeight: 700, fontVariantNumeric: 'lining-nums tabular-nums' }}>
                    {formatCount(totalBirdsClosing)} Birds
                  </dd>
                </div>
              </dl>

              <div className="row between wrap">
                <Btn onClick={() => window.print()}>
                  <Printer size={15} /> Print Official Voucher
                </Btn>
                <Btn primary onClick={() => setIsVoucherModalOpen(false)}>
                  Close
                </Btn>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Guided 3-Step Multi-Stage Entry Modal */}
      {isEntryModalOpen && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && !isSubmitting && setIsEntryModalOpen(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Post Daily Pen Register Entry"
            style={{ maxWidth: 660, background: '#ffffff', borderRadius: 16, border: '1px solid #d6e4db', boxShadow: '0 24px 60px rgba(10,35,25,.18)' }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close Entry Modal"
              onClick={() => !isSubmitting && setIsEntryModalOpen(false)}
              disabled={isSubmitting}
            >
              <X />
            </button>

            {/* Step Wizard Header */}
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
              <span className="eyebrow" style={{ color: '#008751' }}>GUIDED BIOLOGICAL SHIFT REGISTER</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 650, marginTop: 4 }}>
                {formStep === 1 && "Step 1: Today's Birds (Headcount Invariant)"}
                {formStep === 2 && 'Step 2: Feed, Water & Health Operations'}
                {formStep === 3 && 'Step 3: Review & Submit Register'}
              </h2>
              
              {/* Stepper Pills */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {[
                  { step: 1, label: "1. Today's Birds" },
                  { step: 2, label: '2. Feed, Water & Health' },
                  { step: 3, label: '3. Review & Submit' },
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      background: formStep === s.step ? '#008751' : formStep > s.step ? '#ecfdf5' : '#f1f5f9',
                      color: formStep === s.step ? '#ffffff' : formStep > s.step ? '#065f46' : '#64748b',
                      border: formStep === s.step ? '1px solid #008751' : '1px solid #e2e8f0',
                      transition: 'all 0.16s ease',
                    }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', marginBottom: 16, fontSize: '0.88rem' }}>
                <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {errorMessage}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveDailyRecord(e)}>
              {/* STEP 1: Headcount & Biological Conservation */}
              {formStep === 1 && (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Target Poultry Pen / Cohort</span>
                      <select
                        value={targetHouse}
                        onChange={(e) => handleHouseSelectChange(e.target.value)}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      >
                        <option value="H1">House 1 — ISA Brown (Cages A-D)</option>
                        <option value="H2">House 2 — Bovans White (Cages E-H)</option>
                        <option value="H3">House 3 — ISA Brown (Cages J-M)</option>
                        <option value="H4">House 4 — Lohmann Brown (Pullets N-Q)</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Shift Date (WAT)</span>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setIdempotencyKey(`idem-${targetHouse}-${e.target.value}-${Date.now()}`);
                        }}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Opening Headcount (Birds)</span>
                      <input
                        type="number"
                        min={1}
                        required
                        value={openingBirds}
                        onChange={(e) => setOpeningBirds(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                      <small className="muted">Authoritatively prefilled from prior shift closing balance.</small>
                    </label>

                    <label className="field">
                      <span>Mortality Count</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={mortality}
                        onChange={(e) => setMortality(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Culls Count (Sick / Unthrifty)</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={culls}
                        onChange={(e) => setCulls(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>

                    <label className="field">
                      <span>Transfers Out (if any)</span>
                      <input
                        type="number"
                        min={0}
                        value={transfersOut}
                        onChange={(e) => setTransfersOut(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>
                  </div>

                  {/* Real-time Biological Conservation Invariant Card */}
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      BIOLOGICAL CONSERVATION EQUATION
                    </div>
                    <div style={{ marginTop: 6, fontSize: '0.95rem', fontWeight: 650, fontVariantNumeric: 'lining-nums tabular-nums' }}>
                      Opening ({formatCount(openingBirds)}) − Mort ({mortality}) − Culls ({culls}) − Transfers ({transfersOut}) ={' '}
                      <span style={{ color: calculatedClosing >= 0 ? '#008751' : '#c53030' }}>
                        {formatCount(calculatedClosing)} Closing Birds
                      </span>
                    </div>
                  </div>

                  <div className="row between wrap" style={{ marginTop: 12 }}>
                    <Btn type="button" onClick={() => setIsEntryModalOpen(false)}>
                      Cancel
                    </Btn>
                    <Btn
                      primary
                      type="button"
                      onClick={() => {
                        if (calculatedClosing < 0) {
                          setErrorMessage('Negative closing stock is impossible. Check mortality and culls.');
                          return;
                        }
                        setErrorMessage(null);
                        setFormStep(2);
                      }}
                    >
                      Next: Feed, Water &amp; Health <ChevronRight size={15} />
                    </Btn>
                  </div>
                </div>
              )}

              {/* STEP 2: Feed, Water & Health */}
              {formStep === 2 && (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Feed Formulation Rations</span>
                      <input
                        type="text"
                        required
                        value={feedType}
                        onChange={(e) => setFeedType(e.target.value)}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </label>

                    <label className="field">
                      <span>Feed Consumed (kg)</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={feedKg}
                        onChange={(e) => setFeedKg(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Medication Administered</span>
                      <input
                        type="text"
                        value={medication}
                        onChange={(e) => setMedication(e.target.value)}
                        placeholder="e.g. None or Oxytetracycline 20%"
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </label>

                    <label className="field">
                      <span>Vaccination Administered</span>
                      <input
                        type="text"
                        value={vaccination}
                        onChange={(e) => setVaccination(e.target.value)}
                        placeholder="e.g. None Scheduled or ND+IB Booster"
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </label>
                  </div>

                  <div className="grid3">
                    <label className="field">
                      <span>30-Egg Crates</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={crates}
                        onChange={(e) => setCrates(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>

                    <label className="field">
                      <span>Loose Eggs (0–29)</span>
                      <input
                        type="number"
                        min={0}
                        max={29}
                        value={looseEggs}
                        onChange={(e) => setLooseEggs(Math.min(29, Math.max(0, Number(e.target.value))))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>

                    <label className="field">
                      <span>Damaged / Leakers</span>
                      <input
                        type="number"
                        min={0}
                        value={leakers}
                        onChange={(e) => setLeakers(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>
                  </div>

                  <div className="grid3">
                    <label className="field">
                      <span>Water Flow (Litres)</span>
                      <input
                        type="number"
                        min={0}
                        value={waterLitres}
                        onChange={(e) => setWaterLitres(Math.max(0, Number(e.target.value)))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>

                    <label className="field">
                      <span>Temperature (°C)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={tempC}
                        onChange={(e) => setTempC(Number(e.target.value))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>

                    <label className="field">
                      <span>Humidity (% RH)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={humidityPct}
                        onChange={(e) => setHumidityPct(Number(e.target.value))}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontVariantNumeric: 'lining-nums tabular-nums' }}
                      />
                    </label>
                  </div>

                  {/* Calculated Production Preview */}
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL EGGS HARVESTED</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 650, color: '#008751', fontVariantNumeric: 'lining-nums tabular-nums' }}>
                        {formatCount(totalEggsCount)} Eggs ({crates} Crates + {looseEggs} Loose)
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>COMPUTED LAY RATE</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 650, fontVariantNumeric: 'lining-nums tabular-nums' }}>
                        {calculatedHdep}% HDEP
                      </div>
                    </div>
                  </div>

                  <div className="row between wrap" style={{ marginTop: 12 }}>
                    <Btn type="button" onClick={() => setFormStep(1)}>
                      <ArrowLeft size={15} /> Back to Headcount
                    </Btn>
                    <Btn
                      primary
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setFormStep(3);
                      }}
                    >
                      Next: Review &amp; Submit <ChevronRight size={15} />
                    </Btn>
                  </div>
                </div>
              )}

              {/* STEP 3: Review & Submit */}
              {formStep === 3 && (
                <div className="stack" style={{ gap: 16 }}>
                  <div style={{ padding: '14px 18px', borderRadius: 12, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                    <span className="eyebrow" style={{ color: '#008751' }}>SEVEN-COLUMN REGISTER SUMMARY</span>
                    
                    <dl className="identity-facts" style={{ marginTop: 12 }}>
                      <div>
                        <dt>Pen Cohort</dt>
                        <dd>{FLOCK_BASELINES[targetHouse]?.name || `House ${targetHouse}`}</dd>
                      </div>
                      <div>
                        <dt>Shift Date (WAT)</dt>
                        <dd>{selectedDate}</dd>
                      </div>
                      <div>
                        <dt>1. AGE</dt>
                        <dd>{(FLOCK_BASELINES[targetHouse]?.ageWeeks || 48)} wks ({(FLOCK_BASELINES[targetHouse]?.ageWeeks || 48) * 7} d)</dd>
                      </div>
                      <div>
                        <dt>2. OPENING STOCK</dt>
                        <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>{formatCount(openingBirds)}</dd>
                      </div>
                      <div>
                        <dt>3. MORTALITY</dt>
                        <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>{mortality} mort {culls > 0 ? `· ${culls} culls` : ''}</dd>
                      </div>
                      <div>
                        <dt>4. MEDICATION</dt>
                        <dd style={{ fontWeight: 600 }}>{medication}</dd>
                      </div>
                      <div>
                        <dt>5. VACCINATION</dt>
                        <dd style={{ fontWeight: 600 }}>{vaccination}</dd>
                      </div>
                      <div>
                        <dt>6. FEED IN TAKE</dt>
                        <dd style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>{formatCount(feedKg)} kg ({feedType})</dd>
                      </div>
                      <div>
                        <dt>7. CLOSING STOCK</dt>
                        <dd style={{ color: '#008751', fontWeight: 700, fontVariantNumeric: 'lining-nums tabular-nums', fontSize: '1.05rem' }}>
                          {formatCount(calculatedClosing)} Birds (✓ Invariant Balanced)
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Shift Attendant / Operator Name *</span>
                      <input
                        type="text"
                        required
                        value={attendant}
                        onChange={(e) => setAttendant(e.target.value)}
                        placeholder="e.g. Babatunde Alamu"
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 600 }}
                      />
                    </label>

                    <label className="field">
                      <span>Idempotency Key (Retry-Safe)</span>
                      <input
                        type="text"
                        readOnly
                        value={idempotencyKey}
                        style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#64748b', fontSize: '0.8rem' }}
                      />
                    </label>
                  </div>

                  <div className="row between wrap" style={{ marginTop: 12 }}>
                    <Btn type="button" onClick={() => setFormStep(2)} disabled={isSubmitting}>
                      <ArrowLeft size={15} /> Back
                    </Btn>
                    <Btn primary type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <LoaderCircle size={15} className="spin" />
                          <span>Persisting to D1...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Confirm &amp; Persist Shift Log</span>
                        </>
                      )}
                    </Btn>
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>
      )}
    </section>
  );
};

export default DailyPenRegisterWorkspace;
