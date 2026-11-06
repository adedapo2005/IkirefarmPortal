'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AsyncButtonLabel, Btn, Chip, Panel } from './Common';
import styles from './LeaveRequestWorkspace.module.css';

type LeaveRecord = {
  id: string;
  state: 'requested' | 'approved' | 'rejected' | string;
  revision: number;
  createdBy?: string | null;
  data: {
    kind?: string;
    reference?: string;
    subjectId?: string;
    occurredAt?: string;
    endedAt?: string;
    leaveType?: string;
    reason?: string;
  };
};

type ViewState = 'loading' | 'available' | 'no-data' | 'hidden' | 'sign-in' | 'unavailable';
type FormState = { leaveType: string; startDate: string; endDate: string; reason: string };

const emptyForm: FormState = { leaveType: '', startDate: '', endDate: '', reason: '' };
const leaveTypes = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
];

function isRecord(value: unknown): value is LeaveRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.state === 'string' &&
    typeof item.revision === 'number' && Number.isInteger(item.revision) && Boolean(item.data) &&
    typeof item.data === 'object' && !Array.isArray(item.data);
}

function dateLabel(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

function typeLabel(value: unknown) {
  if (typeof value !== 'string') return 'Leave';
  return leaveTypes.find(option => option.value === value)?.label || 'Leave';
}

function durationDays(start: unknown, end: unknown) {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const first = Date.parse(start.slice(0, 10) + 'T00:00:00Z');
  const last = Date.parse(end.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return null;
  return Math.floor((last - first) / 86_400_000) + 1;
}

function toneFor(state: string) {
  return state === 'approved' ? 'green' : state === 'rejected' ? 'red' : 'amber';
}

function currentDateIn(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function LeaveRequestWorkspace() {
  const [view, setView] = useState<ViewState>('loading');
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [principalId, setPrincipalId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [timeZone, setTimeZone] = useState('Africa/Lagos');
  const today = currentDateIn(timeZone);

  const load = useCallback(async () => {
    setView('loading');
    setNotice('');
    try {
      const [identityResponse, recordsResponse] = await Promise.all([
        fetch('/api/portal/me', { credentials: 'same-origin', headers: { accept: 'application/json' } }),
        fetch('/api/portal/v7/people-hr/leave-request?limit=50', {
          credentials: 'same-origin', headers: { accept: 'application/json' },
        }),
      ]);
      if (identityResponse.status === 401 || recordsResponse.status === 401) {
        setRecords([]); setPrincipalId(''); setView('sign-in'); return;
      }
      if (recordsResponse.status === 403 || recordsResponse.status === 404) {
        setRecords([]); setView('hidden'); return;
      }
      if (!identityResponse.ok || !recordsResponse.ok) throw new Error('unavailable');
      const identity: unknown = await identityResponse.json();
      const page: unknown = await recordsResponse.json();
      if (!identity || typeof identity !== 'object' || !('id' in identity) || typeof identity.id !== 'string' ||
          !page || typeof page !== 'object' || !('items' in page) || !Array.isArray(page.items) ||
          !page.items.every(isRecord)) throw new Error('unavailable');
      const own = page.items.filter(item => item.data.subjectId === identity.id);
      setPrincipalId(identity.id);
      if ('assignedTimezone' in identity && typeof identity.assignedTimezone === 'string' && identity.assignedTimezone) setTimeZone(identity.assignedTimezone);
      setRecords(own);
      setView(own.length ? 'available' : 'no-data');
    } catch {
      setRecords([]);
      setView('unavailable');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    total: records.length,
    pending: records.filter(record => record.state === 'requested').length,
    approved: records.filter(record => record.state === 'approved').length,
  }), [records]);

  function update(name: keyof FormState, value: string) {
    setForm(current => ({ ...current, [name]: value }));
    setNotice('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!principalId) { setNotice('Your authenticated employee identity is unavailable. Refresh before submitting.'); return; }
    if (!form.leaveType || !form.startDate || !form.endDate) {
      setNotice('Choose a leave type, start date, and end date.'); return;
    }
    if (form.startDate < today) { setNotice('The start date cannot be in the past.'); return; }
    if (form.endDate < form.startDate) { setNotice('The end date must be on or after the start date.'); return; }
    const reason = form.reason.trim();
    if (reason.length < 10) { setNotice('Add a brief reason of at least 10 characters.'); return; }

    setSubmitting(true);
    try {
      const reference = `LEAVE-${form.startDate.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const response = await fetch('/api/portal/v7/people-hr/leave-request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ data: {
          kind: 'leave-request',
          reference,
          subjectId: principalId,
          occurredAt: form.startDate + 'T00:00:00.000Z',
          endedAt: form.endDate + 'T23:59:59.999Z',
          leaveType: form.leaveType,
          reason,
        } }),
      });
      if (response.status === 401) { setView('sign-in'); throw new Error('Sign in again before submitting a leave request.'); }
      if (response.status === 403 || response.status === 404) { setView('hidden'); throw new Error('Leave requests are unavailable in your authorized scope.'); }
      if (response.status === 422) {
        const failure = await response.json().catch(() => null) as { details?: unknown } | null;
        const details = Array.isArray(failure?.details) ? failure.details.filter(item => typeof item === 'string').join(' ') : '';
        throw new Error(details || 'Review the leave details and try again.');
      }
      if (!response.ok) throw new Error('The leave service could not confirm this request. No request was recorded.');
      setForm(emptyForm);
      await load();
      toast.success('Leave request recorded and sent for authorized review.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The leave request could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  }

  return <div className={styles.workspace} data-live-leave-workspace>
    <section className={styles.banner} aria-label="Leave service status">
      <span className={styles.statusIcon}><ShieldCheck aria-hidden="true" /></span>
      <div>
        <Chip tone={view === 'available' || view === 'no-data' ? 'green' : 'amber'}>
          {view === 'loading' ? 'Checking Server' : view === 'available' || view === 'no-data' ? 'Live Server Records' : 'Connection Needs Attention'}
        </Chip>
        <h2>Personal leave, backed by the authorized HR workflow</h2>
        <p>Requests are bound to your signed-in identity. Approval remains a separate authorized checker action.</p>
      </div>
      <Btn small onClick={() => void load()} disabled={view === 'loading'} aria-label="Refresh leave records">
        <RefreshCw size={16} aria-hidden="true" /> Refresh
      </Btn>
    </section>

    <div className={styles.summaryGrid} aria-label="Personal leave request summary">
      <div className={styles.summaryCard}><small>Total Requests</small><strong>{view === 'loading' ? '—' : counts.total}</strong><span>Only your visible records</span></div>
      <div className={styles.summaryCard}><small>Awaiting Review</small><strong>{view === 'loading' ? '—' : counts.pending}</strong><span>Checker decision pending</span></div>
      <div className={styles.summaryCard}><small>Approved</small><strong>{view === 'loading' ? '—' : counts.approved}</strong><span>Server-confirmed decisions</span></div>
      <div className={`${styles.summaryCard} ${styles.muted}`}><small>Leave Balance</small><strong>Not Supplied</strong><span>No allowance is inferred</span></div>
    </div>

    <div className={styles.liveGrid}>
      <Panel title="Request Leave" description="Submit a personal request for authorized review." className={styles.requestPanel}>
        <form id="leave-request-form" className={`form-grid ${styles.form}`} onSubmit={submit} noValidate>
          <label className="field wide">
            <span>Leave Type</span>
            <select value={form.leaveType} onChange={event => update('leaveType', event.target.value)} required>
              <option value="">Select leave type</option>
              {leaveTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Start Date</span>
            <input type="date" min={today} value={form.startDate} onChange={event => update('startDate', event.target.value)} required />
          </label>
          <label className="field">
            <span>End Date</span>
            <input type="date" min={form.startDate || today} value={form.endDate} onChange={event => update('endDate', event.target.value)} required />
          </label>
          <label className="field wide">
            <span>Reason</span>
            <textarea value={form.reason} onChange={event => update('reason', event.target.value)} maxLength={500} placeholder="Briefly explain the leave request…" required />
            <small>{form.reason.length}/500 characters</small>
          </label>
          {notice && <p className={`${styles.formNotice} wide`} role="alert">{notice}</p>}
          <div className={`${styles.submitRow} wide`}>
            <div><ShieldCheck size={17} aria-hidden="true" /><span>Submission records a request only. It does not approve leave.</span></div>
            <Btn primary type="submit" disabled={submitting || view === 'loading' || view === 'hidden' || view === 'sign-in' || view === 'unavailable'} aria-busy={submitting}>
              <AsyncButtonLabel busy={submitting} idle="Submit Leave Request" busyText="Recording request…" />
            </Btn>
          </div>
        </form>
      </Panel>

      <Panel title="Request History" description="Your server-confirmed requests and review status." className={styles.historyPanel}>
        {view === 'loading' && <div className={styles.state} role="status"><Clock3 aria-hidden="true" /><strong>Loading your leave records…</strong><span>No sample history is shown while the server responds.</span></div>}
        {view === 'sign-in' && <div className={styles.state} role="status"><ShieldCheck aria-hidden="true" /><strong>Sign-in required</strong><span>Your leave records remain hidden until the session is restored.</span></div>}
        {view === 'hidden' && <div className={styles.state} role="status"><ShieldCheck aria-hidden="true" /><strong>Unavailable in this scope</strong><span>No record details or counts are exposed.</span></div>}
        {view === 'unavailable' && <div className={styles.state} role="alert"><RefreshCw aria-hidden="true" /><strong>Leave service unavailable</strong><span>No fixture history is used as a fallback. Refresh to try again.</span></div>}
        {view === 'no-data' && <div className={styles.state}><CalendarDays aria-hidden="true" /><strong>No leave requests yet</strong><span>Your first confirmed request will appear here.</span></div>}
        {view === 'available' && <div className={styles.recordList}>{records.map(record => {
          const days = durationDays(record.data.occurredAt, record.data.endedAt);
          return <article className={styles.record} key={record.id}>
            <div className={styles.recordTop}>
              <div><span className="eyebrow">{typeLabel(record.data.leaveType)}</span><h3>{record.data.reference || 'Leave request'}</h3></div>
              <Chip tone={toneFor(record.state)}>{record.state === 'requested' ? 'Awaiting Review' : record.state}</Chip>
            </div>
            <dl>
              <div><dt>From</dt><dd>{dateLabel(record.data.occurredAt)}</dd></div>
              <div><dt>To</dt><dd>{dateLabel(record.data.endedAt)}</dd></div>
              <div><dt>Duration</dt><dd>{days ? `${days} day${days === 1 ? '' : 's'}` : 'Unavailable'}</dd></div>
              <div><dt>Revision</dt><dd>{record.revision}</dd></div>
            </dl>
            {record.data.reason && <p>{record.data.reason}</p>}
          </article>;
        })}</div>}
      </Panel>
    </div>
    <p className="form-note">This page shows only requests bound to the authenticated identity. Approval, rejection, and allowance balances remain server-authorized HR responsibilities.</p>
  </div>;
}
