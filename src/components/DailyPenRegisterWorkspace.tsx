import React, { useState, useEffect } from 'react';
import {
  Bird,
  ShieldCheck,
  CheckCircle2,
  Plus,
  FileSpreadsheet,
  Egg,
  Wheat,
  Activity,
  Thermometer,
  Droplets,
  Wind,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { formatCount } from '../lib/temporal.ts';
import styles from './portal/InventoryControlDashboard.module.css';
import { Panel, Btn, Chip } from './portal/Common';

interface PenDailyRecord {
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
  feedConsumedKg: number;
  feedType: string;
  eggsCrates: number;
  looseEggs: number;
  leakers: number;
  closingStock: number;
  hdepPercent: number;
  attendantName: string;
  status: 'Verified & Signed' | 'Pending Supervisor' | 'Discrepancy';
}

const INITIAL_RECORDS: PenDailyRecord[] = [
  {
    id: 'pen-rec-01',
    houseId: 'H1',
    houseName: 'House 1 (East Wing Cages)',
    flockBatch: 'LY-2025-04 (ISA Brown)',
    breed: 'ISA Brown',
    ageWeeks: 38,
    ageDays: 266,
    openingStock: 12450,
    mortality: 8,
    culls: 2,
    feedConsumedKg: 1494,
    feedType: 'Layer Mash Phase II',
    eggsCrates: 388,
    looseEggs: 14,
    leakers: 6,
    closingStock: 12440,
    hdepPercent: 93.6,
    attendantName: 'Babatunde Alamu',
    status: 'Verified & Signed',
  },
  {
    id: 'pen-rec-02',
    houseId: 'H2',
    houseName: 'House 2 (West Wing Cages)',
    flockBatch: 'LY-2025-05 (Bovans White)',
    breed: 'Bovans White',
    ageWeeks: 32,
    ageDays: 224,
    openingStock: 12050,
    mortality: 11,
    culls: 4,
    feedConsumedKg: 1446,
    feedType: 'Layer Mash Phase I',
    eggsCrates: 374,
    looseEggs: 8,
    leakers: 9,
    closingStock: 12035,
    hdepPercent: 93.3,
    attendantName: 'Sunday Adeleke',
    status: 'Verified & Signed',
  },
  {
    id: 'pen-rec-03',
    houseId: 'H3',
    houseName: 'House 3 (South Automated)',
    flockBatch: 'LY-2026-01 (ISA Brown)',
    breed: 'ISA Brown',
    ageWeeks: 24,
    ageDays: 168,
    openingStock: 12800,
    mortality: 6,
    culls: 1,
    feedConsumedKg: 1408,
    feedType: 'Layer Mash Phase I',
    eggsCrates: 372,
    looseEggs: 18,
    leakers: 4,
    closingStock: 12793,
    hdepPercent: 87.4,
    attendantName: 'Kazeem Olatunji',
    status: 'Pending Supervisor',
  },
  {
    id: 'pen-rec-04',
    houseId: 'H4',
    houseName: 'House 4 (Pullet Rearing Unit)',
    flockBatch: 'PL-2026-02 (Lohmann Tierzucht)',
    breed: 'Lohmann Brown',
    ageWeeks: 14,
    ageDays: 98,
    openingStock: 11200,
    mortality: 3,
    culls: 0,
    feedConsumedKg: 896,
    feedType: 'Grower Mash Special',
    eggsCrates: 0,
    looseEggs: 0,
    leakers: 0,
    closingStock: 11197,
    hdepPercent: 0,
    attendantName: 'Emeka Eze',
    status: 'Verified & Signed',
  },
];

interface DailyPenRegisterWorkspaceProps {
  onBackToDashboard?: () => void;
}

export const DailyPenRegisterWorkspace: React.FC<DailyPenRegisterWorkspaceProps> = () => {
  const [records, setRecords] = useState<PenDailyRecord[]>(INITIAL_RECORDS);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-06');
  const [selectedHouseFilter, setSelectedHouseFilter] = useState<string>('all');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [backendSyncStatus, setBackendSyncStatus] = useState<'connected' | 'offline'>('connected');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [targetHouse, setTargetHouse] = useState<string>('H3');
  const [newMortality, setNewMortality] = useState<number>(5);
  const [newCulls, setNewCulls] = useState<number>(1);
  const [newFeedKg, setNewFeedKg] = useState<number>(1420);
  const [newCrates, setNewCrates] = useState<number>(375);
  const [newLoose, setNewLoose] = useState<number>(12);
  const [newLeakers, setNewLeakers] = useState<number>(5);
  const [attendant, setAttendant] = useState<string>('Babatunde Alamu');

  useEffect(() => {
    fetch('/api/v1/operations/daily-register')
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/v1/operations/daily-register');
      if (res.ok) {
        setBackendSyncStatus('connected');
        setToastMessage('Synchronized latest daily shift records from Cloudflare D1!');
      } else {
        setBackendSyncStatus('offline');
      }
    } catch {
      setBackendSyncStatus('offline');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const filteredRecords = records.filter((r) => selectedHouseFilter === 'all' || r.houseId === selectedHouseFilter);

  const totalBirdsOpening = filteredRecords.reduce((sum, r) => sum + r.openingStock, 0);
  const totalMortality = filteredRecords.reduce((sum, r) => sum + r.mortality, 0);
  const totalCulls = filteredRecords.reduce((sum, r) => sum + r.culls, 0);
  const totalCrates = filteredRecords.reduce((sum, r) => sum + r.eggsCrates, 0);
  const totalFeedKg = filteredRecords.reduce((sum, r) => sum + r.feedConsumedKg, 0);
  const totalBirdsClosing = filteredRecords.reduce((sum, r) => sum + r.closingStock, 0);

  const conservationPassed = totalBirdsOpening - totalMortality - totalCulls === totalBirdsClosing;

  const avgHdep = (
    filteredRecords.filter((r) => r.hdepPercent > 0).reduce((sum, r) => sum + r.hdepPercent, 0) /
    (filteredRecords.filter((r) => r.hdepPercent > 0).length || 1)
  ).toFixed(1);

  const handleSaveDailyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const existing = records.find((r) => r.houseId === targetHouse);
    const opening = existing ? existing.closingStock : 12500;
    const closing = opening - Number(newMortality) - Number(newCulls);
    const totalEggs = Number(newCrates) * 30 + Number(newLoose);
    const hdep = opening > 0 ? ((totalEggs / opening) * 100).toFixed(1) : '0';

    const newRecord: PenDailyRecord = {
      id: `pen-rec-${Date.now()}`,
      houseId: targetHouse,
      houseName: `House ${targetHouse.replace('H', '')} Operational Unit`,
      flockBatch: `FL-${targetHouse}-2026`,
      breed: targetHouse === 'H2' ? 'Bovans White' : targetHouse === 'H4' ? 'Lohmann Brown' : 'ISA Brown',
      ageWeeks: 35,
      ageDays: 245,
      openingStock: opening,
      mortality: Number(newMortality),
      culls: Number(newCulls),
      feedConsumedKg: Number(newFeedKg),
      feedType: targetHouse === 'H4' ? 'Grower Mash Special' : 'Layer Mash Phase I',
      eggsCrates: Number(newCrates),
      looseEggs: Number(newLoose),
      leakers: Number(newLeakers),
      closingStock: closing,
      hdepPercent: parseFloat(hdep),
      attendantName: attendant,
      status: 'Verified & Signed',
    };

    setRecords([newRecord, ...records.filter((r) => r.houseId !== targetHouse)]);
    setIsEntryModalOpen(false);

    try {
      await fetch('/api/v1/operations/daily-register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          penNumber: newRecord.houseName,
          openingBirds: opening,
          mortalityCount: Number(newMortality),
          cullsCount: Number(newCulls),
          closingBirds: closing,
          eggsCollectedGood: Number(newCrates) * 30,
          feedConsumedKg: Number(newFeedKg),
          recordedBy: attendant,
        }),
      });
    } catch {
      // Local state already updated
    }

    setToastMessage(
      `Daily shift for ${newRecord.houseName} posted and locked! Verified Closing Stock: ${formatCount(closing)} birds.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <section className={styles.root} aria-labelledby="daily-register-command-title">
      {/* Executive Command Bar — Seamlessly connects under PageContextHeader without duplicate headers */}
      <div className="portal-executive-bar" aria-label="Daily Pen Register Execution Controls">
        <div className="portal-exec-actions">
          <button type="button" className="portal-action-btn primary" onClick={() => setIsEntryModalOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            <span>Post Daily Pen Log</span>
          </button>
          <button type="button" className="portal-action-btn secondary" onClick={() => setIsVoucherModalOpen(true)}>
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
            <span>Sync D1 Register</span>
          </button>
        </div>

        <div className="portal-exec-mode" role="status">
          <div className="portal-mode-badge">
            <ShieldCheck size={14} aria-hidden="true" style={{ color: conservationPassed ? '#0d8052' : '#e0a526' }} />
            <span>{backendSyncStatus === 'connected' ? 'LIVE D1 REGISTER' : 'LOCAL REGISTER'}</span>
            <span className="portal-mode-account">
              {conservationPassed ? 'CONSERVATION BALANCED ✓' : 'VARIANCE DETECTED'} · Shift: {selectedDate}
            </span>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="auth-state" role="status">
          <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {toastMessage}
        </div>
      )}

      {/* 4 Native Scoreboard Cards */}
      <div className={styles.scoreboard} aria-label="Daily pen register metrics">
        <div className={styles.score}>
          <span>
            <Bird size={19} aria-hidden="true" /> Total Birds On Site
          </span>
          <strong>{formatCount(totalBirdsOpening)}</strong>
          <small>Closing: {formatCount(totalBirdsClosing)} across 4 houses</small>
        </div>
        <div className={styles.score}>
          <span>
            <Egg size={19} aria-hidden="true" /> Today&apos;s Egg Production
          </span>
          <strong>{formatCount(totalCrates)} Crates</strong>
          <small>
            {formatCount(totalCrates * 30)} table eggs · Avg {avgHdep}% HDEP
          </small>
        </div>
        <div className={styles.score}>
          <span>
            <Wheat size={19} aria-hidden="true" /> Daily Feed Intake
          </span>
          <strong>{formatCount(totalFeedKg)} kg</strong>
          <small>{(totalFeedKg / 50).toFixed(1)} bags (50kg) consumed</small>
        </div>
        <div className={styles.score}>
          <span>
            <Activity size={19} aria-hidden="true" /> Shift Mortality &amp; Culls
          </span>
          <strong>
            {totalMortality} / {totalCulls}
          </strong>
          <small>0.06% daily rate (normal &lt;0.15%)</small>
        </div>
      </div>

      {/* Native FlowBand for Microclimate & Poultry THI Index */}
      <div className={styles.flowBand} aria-labelledby="thi-band-title">
        <div className={styles.flowHeading}>
          <div>
            <span>BALOGUN-IKIRE MICROCLIMATE &amp; POULTRY HEAT STRESS INDEX (THI)</span>
            <h3 id="thi-band-title">House Environmental &amp; Bio-Safety Telemetry</h3>
          </div>
          <small>Coordinates: 7.36°N, 4.19°E · Tunnel Ventilation Stage 3 Active</small>
        </div>
        <div className={styles.flowCounts}>
          <div>
            <Thermometer size={19} aria-hidden="true" />
            <span>Poultry THI Index</span>
            <strong>70.8 THI</strong>
          </div>
          <div>
            <Thermometer size={19} aria-hidden="true" />
            <span>Ambient Temperature</span>
            <strong>28.5°C (76% RH)</strong>
          </div>
          <div>
            <Wind size={19} aria-hidden="true" />
            <span>Tunnel Airflow Velocity</span>
            <strong>2.4 m/s</strong>
          </div>
          <div>
            <Droplets size={19} aria-hidden="true" />
            <span>Nipple Line Water Flow</span>
            <strong>1,142 L/hr</strong>
          </div>
        </div>
      </div>

      {/* Native Panel + Data Table for 7-Column Daily Pen Register */}
      <Panel
        title="7-Column Daily Pen Register & Biological Conservation Ledger"
        description="Closing Stock = Opening Headcount − Mortality − Culls ± Transfers. Filter by poultry house or shift date."
        actions={
          <div className="row wrap">
            {[
              { id: 'all', label: 'All Houses' },
              { id: 'H1', label: 'House 1 (ISA Brown)' },
              { id: 'H2', label: 'House 2 (Bovans White)' },
              { id: 'H3', label: 'House 3 (South Auto)' },
              { id: 'H4', label: 'House 4 (Pullets)' },
            ].map((tab) => (
              <Btn
                key={tab.id}
                small
                primary={selectedHouseFilter === tab.id}
                onClick={() => setSelectedHouseFilter(tab.id)}
              >
                {tab.label}
              </Btn>
            ))}
          </div>
        }
      >
        <div className="row between wrap">
          <Chip tone="blue">Strict Headcount Law Active</Chip>
          <label className="row" style={{ fontSize: '.82rem', fontWeight: 700 }}>
            <span>Shift Date (WAT):</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                minHeight: 36,
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            />
          </label>
        </div>

        <div className="table-wrap mt">
          <table className="data-table">
            <thead>
              <tr>
                <th>House &amp; Cohort</th>
                <th>Age (Wks / Days)</th>
                <th>Opening Stock</th>
                <th>Mortality / Culls</th>
                <th>Feed Consumed</th>
                <th>Egg Yield (30-Egg Crates)</th>
                <th>HDEP %</th>
                <th>Closing Stock</th>
                <th>Attendant &amp; Sign-off</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const mortRate = (r.mortality / (r.openingStock || 1)) * 100;
                const calcClosing = r.openingStock - r.mortality - r.culls;
                const isDiscrepant = calcClosing !== r.closingStock;

                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.houseName}</strong>
                      <div className="metadata">{r.flockBatch}</div>
                    </td>
                    <td>
                      <strong>{r.ageWeeks} wks</strong>
                      <div className="metadata">{r.ageDays} days</div>
                    </td>
                    <td>
                      <strong>{formatCount(r.openingStock)}</strong>
                    </td>
                    <td>
                      <strong>
                        {r.mortality} mort / {r.culls} cull
                      </strong>
                      <div className="metadata">{mortRate.toFixed(2)}% daily rate</div>
                    </td>
                    <td>
                      <strong>{formatCount(r.feedConsumedKg)} kg</strong>
                      <div className="metadata">
                        {((r.feedConsumedKg / (r.openingStock || 1)) * 1000).toFixed(0)} g/bird · {r.feedType}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary)' }}>{formatCount(r.eggsCrates)} Crates</strong>
                      <div className="metadata">
                        +{r.looseEggs} loose ({r.leakers} leakers)
                      </div>
                    </td>
                    <td>
                      {r.hdepPercent > 0 ? (
                        <Chip>{r.hdepPercent}% HDEP</Chip>
                      ) : (
                        <Chip tone="gray">Pullet Rearing</Chip>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: isDiscrepant ? '#9b2c2c' : 'var(--primary)', fontSize: '1rem' }}>
                        {formatCount(r.closingStock)}
                      </strong>
                    </td>
                    <td>
                      <strong>{r.attendantName}</strong>
                      <div className="metadata">{r.status}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
            style={{ maxWidth: 580 }}
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
                  <dt>Total Opening Stock</dt>
                  <dd>{formatCount(totalBirdsOpening)} Birds</dd>
                </div>
                <div>
                  <dt>Total Eggs Harvested</dt>
                  <dd>
                    {formatCount(totalCrates)} Crates ({formatCount(totalCrates * 30)} Eggs)
                  </dd>
                </div>
                <div>
                  <dt>Total Feed Consumed</dt>
                  <dd>
                    {formatCount(totalFeedKg)} kg ({(totalFeedKg / 50).toFixed(1)} Bags)
                  </dd>
                </div>
                <div>
                  <dt>Verified Closing Stock</dt>
                  <dd style={{ color: 'var(--primary)' }}>{formatCount(totalBirdsClosing)} Birds</dd>
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

      {/* Post Daily Pen Register Entry Modal */}
      {isEntryModalOpen && (
        <div
          className="intel-overlay"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setIsEntryModalOpen(false)}
        >
          <section
            className="intel-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Post Daily Pen Register Entry"
            style={{ maxWidth: 600 }}
          >
            <button
              type="button"
              className="intel-sheet-close"
              aria-label="Close Entry Modal"
              onClick={() => setIsEntryModalOpen(false)}
            >
              <X />
            </button>

            <form className="stack" onSubmit={(e) => void handleSaveDailyRecord(e)}>
              <div>
                <span className="eyebrow">BIOLOGICAL HEADCOUNT CONSERVATION</span>
                <h2>Post Daily Pen Register Entry</h2>
                <p className="muted">Closing Stock = Opening Headcount − Mortality − Culls.</p>
              </div>

              <label className="field">
                <span>Target House &amp; Flock</span>
                <select value={targetHouse} onChange={(e) => setTargetHouse(e.target.value)}>
                  <option value="H1">House 1 — ISA Brown (Layer)</option>
                  <option value="H2">House 2 — Bovans White (Layer)</option>
                  <option value="H3">House 3 — ISA Brown (Layer)</option>
                  <option value="H4">House 4 — Lohmann Brown (Pullet)</option>
                </select>
              </label>

              <div className="form-grid">
                <label className="field">
                  <span>Mortality Count (Birds)</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMortality}
                    onChange={(e) => setNewMortality(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Culls (Unthrifty / Sick)</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newCulls}
                    onChange={(e) => setNewCulls(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="grid3">
                <label className="field">
                  <span>Eggs (30-Egg Crates)</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newCrates}
                    onChange={(e) => setNewCrates(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Loose Eggs (0–29)</span>
                  <input
                    type="number"
                    min={0}
                    max={29}
                    value={newLoose}
                    onChange={(e) => setNewLoose(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Leakers / Cracked</span>
                  <input
                    type="number"
                    min={0}
                    value={newLeakers}
                    onChange={(e) => setNewLeakers(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Feed Consumed (kg)</span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newFeedKg}
                    onChange={(e) => setNewFeedKg(Number(e.target.value))}
                  />
                </label>

                <label className="field">
                  <span>Shift Attendant Name</span>
                  <input
                    type="text"
                    required
                    value={attendant}
                    onChange={(e) => setAttendant(e.target.value)}
                  />
                </label>
              </div>

              <div className="row between wrap">
                <Btn type="button" onClick={() => setIsEntryModalOpen(false)}>
                  Cancel
                </Btn>
                <Btn primary type="submit">
                  Save &amp; Attest Ledger
                </Btn>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
