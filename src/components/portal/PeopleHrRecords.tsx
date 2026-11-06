'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, Btn, Chip, AsyncButtonLabel } from './Common';
import LoggedTimestamp from './LoggedTimestamp';

type Kind = 'employee-record' | 'leave-request' | 'attendance-record' | 'payroll-batch' | 'recruitment-candidate';
type RecordItem = { id: string; state: string; revision: number; createdBy?: string | null; data: Record<string, unknown> };
type Page = { items: RecordItem[]; nextCursor: string | null; state: 'available' | 'no-data' };
type ViewState = 'loading' | 'available' | 'no-data' | 'hidden' | 'sign-in' | 'unavailable';
const kinds: { id: Kind; label: string }[] = [
  { id: 'employee-record', label: 'Employee Records' },
  { id: 'leave-request', label: 'Leave Requests' },
  { id: 'attendance-record', label: 'Attendance' },
  { id: 'payroll-batch', label: 'Payroll Batches' },
  { id: 'recruitment-candidate', label: 'Recruitment' },
];

function validRecord(value: unknown): value is RecordItem {
  return Boolean(value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' &&
    'state' in value && typeof value.state === 'string' && 'revision' in value &&
    typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision > 0 &&
    'data' in value && value.data && typeof value.data === 'object' && !Array.isArray(value.data));
}

async function readPage(kind: Kind, cursor?: string): Promise<Page> {
  const query = new URLSearchParams({ limit: '50' });
  if (cursor) query.set('cursor', cursor);
  const response = await fetch(`/api/portal/v7/people-hr/${kind}?${query}`, {
    credentials: 'same-origin', headers: { accept: 'application/json' },
  });
  if (response.status === 401) throw new Error('sign-in');
  if (response.status === 403 || response.status === 404) throw new Error('hidden');
  if (!response.ok) throw new Error('unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) ||
      !('state' in body) || !['available', 'no-data'].includes(String(body.state)) ||
      ('nextCursor' in body && body.nextCursor !== null && typeof body.nextCursor !== 'string') ||
      !body.items.every(validRecord)) throw new Error('unavailable');
  return { items: body.items, nextCursor: 'nextCursor' in body ? body.nextCursor as string | null : null, state: body.state as Page['state'] };
}

function detailLines(kind: Kind, item: RecordItem) {
  const lines: string[] = [];
  const data = item.data;
  if (typeof data.subjectId === 'string' && data.subjectId) lines.push(`Subject: ${data.subjectId}`);
  if (kind === 'payroll-batch' && typeof data.amountMinor === 'number' && typeof data.currency === 'string') {
    lines.push(`Recorded amount: ${data.amountMinor} minor units · ${data.currency}`);
  }
  if (kind === 'recruitment-candidate' && (item.state === 'closed' || item.state === 'rejected')) {
    lines.push(`Final state: ${item.state}`);
  }
  if (Array.isArray(data.evidenceIds)) lines.push(`Evidence links: ${data.evidenceIds.length}`);
  if (item.createdBy) lines.push(`Maker: ${item.createdBy}`);
  return lines;
}

export default function PeopleHrRecords({ initialKind = 'employee-record', collection }: { initialKind?: Kind; collection?: Kind } = {}) {
  const [kind, setKind] = useState<Kind>(collection || initialKind);
  const [state, setState] = useState<ViewState>('loading');
  const [items, setItems] = useState<RecordItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  useEffect(() => {
    ++requestId.current;
    setKind(collection || initialKind);
    setItems([]);
    setNextCursor(null);
    setState('loading');
    setNotice('');
  }, [collection, initialKind]);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setState('loading'); setNotice('');
    try {
      const page = await readPage(kind);
      if (request !== requestId.current) return;
      setItems(page.items); setNextCursor(page.nextCursor);
      setState(page.state === 'no-data' || page.items.length === 0 ? 'no-data' : 'available');
    } catch (error) {
      if (request !== requestId.current) return;
      setItems([]); setNextCursor(null);
      setState(error instanceof Error && error.message === 'hidden' ? 'hidden' :
        error instanceof Error && error.message === 'sign-in' ? 'sign-in' : 'unavailable');
    }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setNotice('');
    try {
      const page = await readPage(kind, nextCursor);
      setItems(current => {
        const known = new Set(current.map(item => item.id));
        return [...current, ...page.items.filter(item => !known.has(item.id))];
      });
      setNextCursor(page.nextCursor); setState('available');
    } catch (error) {
      if (error instanceof Error && (error.message === 'hidden' || error.message === 'sign-in')) {
        setItems([]); setNextCursor(null); setState(error.message);
      } else setNotice('More authorized records could not be loaded. Records already shown are unchanged; try again.');
    } finally { setLoadingMore(false); }
  }

  const label = kinds.find(option => option.id === kind)?.label || 'People & HR Records';
  const title = collection === 'employee-record' ? 'Employee Register'
    : collection === 'attendance-record' ? 'Attendance Administration'
      : collection === 'payroll-batch' ? 'Payroll Batch Register'
        : collection === 'recruitment-candidate' ? 'Recruitment Candidate Register'
          : 'People & HR Records';
  return <Panel title={title} description="Authorized records are returned by the API v7 People & HR service after employee and organization scope checks. Unsupported fields are not replaced with sample content.">
    {!collection && <div className="row wrap" aria-label="People and HR record type">
      {kinds.map(option => <Btn key={option.id} small aria-pressed={kind === option.id} onClick={() => { ++requestId.current; setState('loading'); setItems([]); setNextCursor(null); setKind(option.id); }}>{option.label}</Btn>)}
    </div>}
    <div className="row between wrap mt" aria-live="polite">
      <Chip tone={state === 'available' ? 'blue' : state === 'no-data' ? 'gray' : 'amber'}>
        {state === 'loading' ? 'Loading authorized records…' : state === 'available' ? 'Records Available' : state === 'no-data' ? 'No Data' : state === 'hidden' ? 'Unavailable in This Scope' : state === 'sign-in' ? 'Sign-In Required' : 'Service Unavailable'}
      </Chip>
      <Btn small onClick={() => void load()} disabled={state === 'loading'}>Refresh</Btn>
    </div>
    {state === 'hidden' && <p className="mt" role="status">This collection is unavailable in your authorized scope. No record details or counts are shown.</p>}
    {state === 'sign-in' && <p className="mt" role="status">Sign in to load authorized People & HR records. No record details or counts are shown.</p>}
    {state === 'unavailable' && <p className="mt" role="alert">The People & HR service could not be reached. Records are not shown as a fallback.</p>}
    {state === 'no-data' && <p className="mt">No authorized {label.toLowerCase()} are available.</p>}
    {state === 'available' && <div className="stack mt">{items.map(item => {
      const details = detailLines(kind, item);
      return <article className="record-row" key={item.id} aria-label={`${label} ${item.state}`}>
        <span className="grow"><strong>{String(item.data.reference || item.id)}</strong><small>{item.state} · Revision {item.revision}</small>{item.data.occurredAt != null && <small>Occurred: <LoggedTimestamp value={item.data.occurredAt}/></small>}{item.data.endedAt != null && <small>Ended: <LoggedTimestamp value={item.data.endedAt}/></small>}{details.map((line, index) => <small key={`${item.id}-${index}`}>{line}</small>)}</span>
      </article>;
    })}</div>}
    {state === 'available' && nextCursor && <div className="row mt"><Btn small onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}><AsyncButtonLabel busy={loadingMore} idle="Load More" busyText="Loading more records…"/></Btn></div>}
    {notice && <p className="mt" role="status">{notice}</p>}
    {kind === 'recruitment-candidate' && <p className="form-note mt">Workflow actions are not shown because this API contract does not expose per-record action capabilities. The server remains the authorization authority. Checker attribution is not included in the record response.</p>}
    <p className="form-note mt">The server supplies only records visible to this authenticated principal; page length is not presented as a total.</p>
  </Panel>;
}
