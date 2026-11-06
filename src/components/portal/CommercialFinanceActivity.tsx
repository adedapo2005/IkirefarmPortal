'use client';

import React, { useState } from 'react';
import { AsyncButtonLabel, Btn } from './Common';
import LoggedTimestamp from './LoggedTimestamp';

type Item = { id: string; actorId: string; action: string; channel: string; occurredAt: string; event: string | null; state: string | null; revision: number | null };
type Page = { items: Item[]; nextCursor: string | null };
function validItem(value: unknown): value is Item {
  return Boolean(value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' &&
    'actorId' in value && typeof value.actorId === 'string' && 'action' in value && typeof value.action === 'string' &&
    'channel' in value && typeof value.channel === 'string' && 'occurredAt' in value && typeof value.occurredAt === 'string' &&
    'event' in value && (value.event === null || typeof value.event === 'string') && 'state' in value &&
    (value.state === null || typeof value.state === 'string') && 'revision' in value &&
    (value.revision === null || typeof value.revision === 'number'));
}

export default function CommercialFinanceActivity({ kind, id }: { kind: 'customer' | 'sales-order' | 'revenue' | 'expense' | 'ledger-entry'; id: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'available' | 'no-data' | 'hidden' | 'sign-in' | 'unavailable'>('idle');
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function readPage(next?: string): Promise<Page> {
    const query = new URLSearchParams({ limit: '50' });
    if (next) query.set('cursor', next);
    const response = await fetch(`/api/portal/v7/commercial-finance/${kind}/${encodeURIComponent(id)}/activity?${query}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (response.status === 401) throw new Error('sign-in');
    if (response.status === 403 || response.status === 404) throw new Error('hidden');
    if (!response.ok) throw new Error('unavailable');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) || !body.items.every(validItem) ||
      !('nextCursor' in body) || (body.nextCursor !== null && typeof body.nextCursor !== 'string')) throw new Error('unavailable');
    return { items: body.items, nextCursor: body.nextCursor };
  }

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true); setState('loading'); setItems([]); setCursor(null);
    try {
      const page = await readPage(); setItems(page.items); setCursor(page.nextCursor); setState(page.items.length ? 'available' : 'no-data');
    } catch (error) { setState(error instanceof Error && error.message === 'hidden' ? 'hidden' : error instanceof Error && error.message === 'sign-in' ? 'sign-in' : 'unavailable'); }
  }

  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await readPage(cursor);
      setItems(current => { const known = new Set(current.map(item => item.id)); return [...current, ...page.items.filter(item => !known.has(item.id))]; });
      setCursor(page.nextCursor); setState('available');
    } catch (error) {
      if (error instanceof Error && (error.message === 'hidden' || error.message === 'sign-in')) { setItems([]); setCursor(null); setState(error.message); }
      else setState('unavailable');
    } finally { setLoadingMore(false); }
  }

  return <div className="stack mt">
    <Btn small aria-expanded={open} onClick={() => void toggle()}>{open ? 'Hide activity' : 'View activity'}</Btn>
    {open && <section className="stack" aria-live="polite" aria-label="Authorized activity history">
      {state === 'loading' && <p role="status">Loading authorized activity…</p>}
      {state === 'hidden' && <p role="status">Activity is unavailable in your authorized scope. No event details are shown.</p>}
      {state === 'sign-in' && <p role="status">Sign in to load authorized activity.</p>}
      {state === 'unavailable' && <p role="alert">Activity is temporarily unavailable. No count or fallback data is shown.</p>}
      {state === 'no-data' && <p>No activity is available for this record.</p>}
      {state === 'available' && <>
        <h4>Activity history</h4>
        {items.map(item => <div className="timeline-item" key={item.id}>
          <small><LoggedTimestamp value={item.occurredAt}/></small>
          <strong>{item.action}</strong><p>{item.event || item.state || 'Authorized activity'} · {item.channel} · Revision {item.revision ?? '—'}</p>
        </div>)}
        {cursor && <Btn small onClick={() => void more()} disabled={loadingMore} aria-busy={loadingMore}><AsyncButtonLabel busy={loadingMore} idle="Load more activity" busyText="Loading more activity…"/></Btn>}
      </>}
    </section>}
  </div>;
}
