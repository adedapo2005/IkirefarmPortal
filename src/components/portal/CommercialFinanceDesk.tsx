'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, Btn, Chip, AsyncButtonLabel } from './Common';
import ContextualCommunicationAction from './ContextualCommunicationAction';
import CommercialFinanceActivity from './CommercialFinanceActivity';
import { createFinanceReadGate, currentFinanceSourceChoices } from './finance-list-request-gate';
import type { WorkspaceProps } from './PortalExperience';

type Kind = 'customer' | 'sales-order' | 'revenue' | 'expense' | 'ledger-entry';
type RecordItem = { id: string; resourceType: string; state: string; revision: number; data: Record<string, unknown> };
type Listing = { items: RecordItem[]; nextCursor: string | null; state: 'available' | 'no-data' };
type ViewState = 'loading' | 'available' | 'no-data' | 'hidden' | 'authentication-required' | 'validation' | 'unavailable';
type Field = { key: string; label: string; type?: string; options?: string[]; optional?: boolean };
type SearchChoice = { kind: Kind; query: string; name?: string; id?: string };
type ScopedRevenueChoices = { scopeKey: string; sourceKind: Kind; items: RecordItem[] };

const kinds: { id: Kind; label: string }[] = [
  { id: 'customer', label: 'Customers' },
  { id: 'sales-order', label: 'Sales orders' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expense', label: 'Expenses' },
  { id: 'ledger-entry', label: 'Ledger entries' },
];
const actions: Record<Kind, Record<string, { to: string; label: string }[]>> = {
  customer: {},
  'sales-order': { draft: [{ to: 'submitted', label: 'Submit' }, { to: 'cancelled', label: 'Cancel' }], submitted: [{ to: 'approved', label: 'Approve' }, { to: 'rejected', label: 'Reject' }, { to: 'cancelled', label: 'Cancel' }], approved: [{ to: 'fulfilled', label: 'Fulfill' }, { to: 'cancelled', label: 'Cancel' }], rejected: [{ to: 'draft', label: 'Return to draft' }] },
  revenue: { draft: [{ to: 'submitted', label: 'Submit' }, { to: 'cancelled', label: 'Cancel' }], submitted: [{ to: 'confirmed', label: 'Confirm' }, { to: 'rejected', label: 'Reject' }, { to: 'cancelled', label: 'Cancel' }], rejected: [{ to: 'draft', label: 'Return to draft' }] },
  expense: { draft: [{ to: 'submitted', label: 'Submit' }, { to: 'cancelled', label: 'Cancel' }], submitted: [{ to: 'approved', label: 'Approve' }, { to: 'rejected', label: 'Reject' }, { to: 'cancelled', label: 'Cancel' }], approved: [{ to: 'posted', label: 'Post' }], rejected: [{ to: 'draft', label: 'Return to draft' }] },
  'ledger-entry': { draft: [{ to: 'posted', label: 'Post' }], posted: [{ to: 'reversed', label: 'Reverse' }] },
};
const editableStates: Record<Kind, string[]> = {
  customer: ['active', 'inactive'],
  'sales-order': ['draft', 'rejected'],
  revenue: ['draft', 'rejected'],
  expense: ['draft', 'rejected'],
  'ledger-entry': ['draft'],
};
const fields: Record<Kind, Field[]> = {
  customer: [{ key: 'customerCode', label: 'Customer code' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status', options: ['active', 'inactive'] }, { key: 'contactEmail', label: 'Contact email', optional: true }, { key: 'phone', label: 'Phone', optional: true }, { key: 'evidenceIds', label: 'Evidence IDs (comma separated)', optional: true }],
  'sales-order': [{ key: 'orderCode', label: 'Order code' }, { key: 'customerCode', label: 'Customer code' }, { key: 'itemCode', label: 'Item code' }, { key: 'quantity', label: 'Quantity', type: 'number' }, { key: 'unit', label: 'Unit', options: ['unit', 'kg', 'bag', 'ton', 'litre'] }, { key: 'currency', label: 'Currency (ISO)' }, { key: 'unitPrice', label: 'Unit price', type: 'number' }, { key: 'orderedAt', label: 'Ordered at (ISO date/time with offset)' }, { key: 'evidenceIds', label: 'Evidence IDs (comma separated)', optional: true }],
  revenue: [{ key: 'revenueCode', label: 'Revenue code' }, { key: 'sourceType', label: 'Source type', options: ['customer', 'sales-order', 'other'] }, { key: 'sourceId', label: 'Source record ID (required for customer or sales order)', optional: true }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', type: 'number' }, { key: 'currency', label: 'Currency (ISO)' }, { key: 'recordedAt', label: 'Recorded at (ISO date/time with offset)' }, { key: 'paymentStatus', label: 'Payment status', options: ['pending', 'partial', 'received'] }, { key: 'evidenceIds', label: 'Evidence IDs (comma separated)', optional: true }],
  expense: [{ key: 'expenseCode', label: 'Expense code' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', type: 'number' }, { key: 'currency', label: 'Currency (ISO)' }, { key: 'incurredAt', label: 'Incurred at (ISO date/time with offset)' }, { key: 'description', label: 'Description' }, { key: 'evidenceIds', label: 'Evidence IDs (comma separated)', optional: true }],
  'ledger-entry': [{ key: 'entryCode', label: 'Entry code' }, { key: 'accountCode', label: 'Account code' }, { key: 'direction', label: 'Direction', options: ['debit', 'credit'] }, { key: 'amount', label: 'Amount', type: 'number' }, { key: 'currency', label: 'Currency (ISO)' }, { key: 'occurredAt', label: 'Occurred at (ISO date/time with offset)' }, { key: 'sourceType', label: 'Source type', options: ['manual', 'sales-order', 'expense'] }, { key: 'sourceId', label: 'Source record ID (required for business source)', optional: true }, { key: 'evidenceIds', label: 'Evidence IDs (comma separated)', optional: true }],
};

async function readListing(kind: Kind, cursor?: string, search?: string): Promise<Listing> {
  const query = new URLSearchParams({ limit: '50' });
  if (cursor) query.set('cursor', cursor);
  if (search) query.set('q', search);
  const response = await fetch(`/api/portal/v7/commercial-finance/${kind}?${query.toString()}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (response.status === 404 || response.status === 403) throw new Error('hidden');
  if (response.status === 401) throw new Error('authentication-required');
  if (response.status === 422) throw new Error('validation');
  if (!response.ok) throw new Error('unavailable');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) || !('state' in body) || !['available', 'no-data'].includes(String(body.state)) || ('nextCursor' in body && body.nextCursor !== null && typeof body.nextCursor !== 'string')) throw new Error('unavailable');
  const items = body.items as unknown[];
  if (!items.every((item) => item && typeof item === 'object' && 'id' in item && typeof item.id === 'string' && 'resourceType' in item && item.resourceType === kind && 'state' in item && typeof item.state === 'string' && 'revision' in item && typeof item.revision === 'number' && Number.isInteger(item.revision) && item.revision > 0 && 'data' in item && item.data && typeof item.data === 'object' && !Array.isArray(item.data))) throw new Error('unavailable');
  return { items: items as RecordItem[], nextCursor: 'nextCursor' in body ? body.nextCursor as string | null : null, state: body.state as Listing['state'] };
}

function isRecordItem(value: unknown, expectedKind: Kind): value is RecordItem {
  return Boolean(value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' && 'resourceType' in value && value.resourceType === expectedKind && 'state' in value && typeof value.state === 'string' && 'revision' in value && typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision > 0 && 'data' in value && value.data && typeof value.data === 'object' && !Array.isArray(value.data));
}

export default function CommercialFinanceDesk({ person, detail, go, initialKind = 'customer', collection }: Pick<WorkspaceProps, 'person'|'detail'|'go'> & { initialKind?: Kind; collection?: Kind }) {
  const [kind, setKind] = useState<Kind>(collection || initialKind);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState<ViewState>('loading');
  const [items, setItems] = useState<RecordItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [hiddenActions, setHiddenActions] = useState<string[]>([]);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingLedgerCreate, setPendingLedgerCreate] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [createHiddenKinds, setCreateHiddenKinds] = useState<Kind[]>([]);
  const [hiddenRecordControls, setHiddenRecordControls] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchChoice[]>([]);
  const [frequentSearches, setFrequentSearches] = useState<SearchChoice[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchChoice[]>([]);
  const [savedName, setSavedName] = useState('');
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [revenueSourceChoices, setRevenueSourceChoices] = useState<ScopedRevenueChoices | null>(null);
  // Every change of collection or query invalidates earlier in-flight reads.
  // An older Customer response must never populate a newly selected Ledger view.
  const listingVersion = useRef(createFinanceReadGate());
  // A completed server operation must never update a different Finance
  // collection or a subsequently selected authenticated farm/account.
  const actionVersion = useRef(createFinanceReadGate());
  const activeKind = useRef<Kind>(kind);
  const activeSearch = useRef(search);
  const scopeKey = JSON.stringify([
    person.id, person.principalSource, person.email, person.accessState, person.restriction,
    Object.entries(person.organizationScope || {}).sort(([a], [b]) => a.localeCompare(b)),
    [...person.permissions].sort(),
    Object.entries(person.permissionScopes || {}).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  const activeScope = useRef(scopeKey);
  const searchPreferencesVersion = useRef(0);
  const invalidateListing = useCallback(() => {
    listingVersion.current.invalidate();
    actionVersion.current.invalidate();
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setState('loading');
  }, []);
  useEffect(() => {
    // A new signed-in principal, farm scope or grant set invalidates prior rows.
    activeScope.current = scopeKey;
    searchPreferencesVersion.current += 1;
    invalidateListing();
    setRecentSearches([]);
    setFrequentSearches([]);
    setSavedSearches([]);
    setEditing(null);
    setFormOpen(false);
    setPendingLedgerCreate(false);
    // Denials discovered in a previous signed-in scope must not suppress
    // controls for a new account, role, or authorized farm.
    setCreateHiddenKinds([]);
    setHiddenRecordControls([]);
    setHiddenActions([]);
    setNotice('');
    setBusyId('');
    setSaving(false);
    setPreferencesBusy(false);
  }, [scopeKey, invalidateListing]);
  const revenueSourceType = kind === 'revenue' ? formData.sourceType : undefined;
  useEffect(() => {
    let active = true;
    // Scope changes must not re-use old authorized Customer/Sales Order choices.
    setRevenueSourceChoices(null);
    if (kind !== 'revenue' || !['customer', 'sales-order'].includes(revenueSourceType || '')) {
      return () => { active = false; };
    }
    const sourceKind = revenueSourceType as Kind;
    void readListing(sourceKind).then(result => {
      if (active && scopeKey === activeScope.current) {
        setRevenueSourceChoices({ scopeKey, sourceKind, items: result.items });
      }
    }).catch(() => {
      if (active && scopeKey === activeScope.current) setRevenueSourceChoices(null);
    });
    return () => { active = false; };
  }, [kind, revenueSourceType, scopeKey]);
  const authorizedRevenueChoices = kind === 'revenue'
    ? currentFinanceSourceChoices(revenueSourceChoices, scopeKey, revenueSourceType) : [];
  useEffect(() => {
    const nextKind = collection || initialKind;
    activeKind.current = nextKind;
    activeSearch.current = '';
    invalidateListing();
    setKind(nextKind);
    setEditing(null);
    setFormOpen(false);
    setSearchInput('');
    setSearch('');
  }, [collection, initialKind, invalidateListing]);
  const load = useCallback(async (preserveNotice = false) => {
    if (kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
    const version = listingVersion.current.begin();
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setState('loading');
    if (!preserveNotice) setNotice('');
    try {
      const result = await readListing(kind, undefined, search);
      if (!listingVersion.current.isCurrent(version) || kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setState(result.state === 'no-data' || result.items.length === 0 ? 'no-data' : 'available');
    } catch (error) {
      if (!listingVersion.current.isCurrent(version) || kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
      setItems([]); setNextCursor(null); setState(error instanceof Error && error.message === 'hidden' ? 'hidden' : error instanceof Error && error.message === 'authentication-required' ? 'authentication-required' : error instanceof Error && error.message === 'validation' ? 'validation' : 'unavailable');
    }
  }, [kind, search, scopeKey]);
  useEffect(() => {
    const gate = listingVersion.current;
    const actions = actionVersion.current;
    void load();
    return () => {
      gate.invalidate();
      actions.invalidate();
    };
  }, [load]);

  useEffect(() => {
    if (collection) return;
    const panel = document.getElementById('commercial-finance-records');
    if (!panel) return;
    const requestLedgerCreate = () => {
      // Opening a financial form is a UI request, never an immediate write.
      setPendingLedgerCreate(true);
      setEditing(null);
      setFormOpen(false);
      if (kind !== 'ledger-entry') {
        activeKind.current = 'ledger-entry';
        activeSearch.current = '';
        invalidateListing();
        setKind('ledger-entry');
        setSearchInput('');
        setSearch('');
        setSavedName('');
      }
    };
    panel.addEventListener('daenem:finance-ledger-create', requestLedgerCreate);
    return () => panel.removeEventListener('daenem:finance-ledger-create', requestLedgerCreate);
  }, [collection, kind, invalidateListing]);

  useEffect(() => {
    if (!pendingLedgerCreate || kind !== 'ledger-entry') return;
    if (state === 'available' || state === 'no-data') {
      setPendingLedgerCreate(false);
      if (createHiddenKinds.includes('ledger-entry')) {
        setNotice('Ledger Entry creation is unavailable in your authorized scope.');
        return;
      }
      setEditing(null);
      setFormData(Object.fromEntries(fields['ledger-entry'].map(field => [field.key, ''])));
      setFormOpen(true);
    } else if (state === 'hidden' || state === 'authentication-required' || state === 'validation' || state === 'unavailable') {
      setPendingLedgerCreate(false);
      setNotice('Ledger Entry creation is unavailable until authorized Finance records can be loaded.');
    }
  }, [pendingLedgerCreate, kind, state, createHiddenKinds]);

  useEffect(() => {
    if (!formOpen || kind !== 'ledger-entry') return;
    const form = document.getElementById('commercial-finance-create-form');
    form?.querySelector<HTMLElement>('input:not(:disabled), select, textarea, button')?.focus({ preventScroll: true });
  }, [formOpen, kind]);

  const loadSearchPreferences = useCallback(async () => {
    const version = ++searchPreferencesVersion.current;
    if (state !== 'available' && state !== 'no-data') {
      setRecentSearches([]); setFrequentSearches([]); setSavedSearches([]); return;
    }
    try {
      const paths = ['history', 'frequency', 'saved'] as const;
      const responses = await Promise.all(paths.map(path => fetch(`/api/portal/v7/commercial-search/${path}`, { credentials: 'same-origin', headers: { accept: 'application/json' } })));
      if (version !== searchPreferencesVersion.current || scopeKey !== activeScope.current) return;
      if (responses.some(response => response.status === 401 || response.status === 403 || response.status === 404)) {
        setRecentSearches([]); setFrequentSearches([]); setSavedSearches([]); return;
      }
      if (responses.some(response => !response.ok)) return;
      const bodies = await Promise.all(responses.map(response => response.json() as Promise<{ items?: unknown }>));
      if (version !== searchPreferencesVersion.current || scopeKey !== activeScope.current) return;
      const parse = (value: unknown): SearchChoice[] => Array.isArray(value) ? value.filter((item): item is SearchChoice => Boolean(item && typeof item === 'object' && 'kind' in item && kinds.some(option => option.id === item.kind) && 'query' in item && typeof item.query === 'string')) : [];
      setRecentSearches(parse(bodies[0]?.items)); setFrequentSearches(parse(bodies[1]?.items)); setSavedSearches(parse(bodies[2]?.items));
    } catch { /* Preferences are optional; collection state remains authoritative. */ }
  }, [state, scopeKey]);
  useEffect(() => {
    void loadSearchPreferences();
    return () => { searchPreferencesVersion.current += 1; };
  }, [loadSearchPreferences]);

  async function saveCurrentSearch() {
    const name = savedName.trim();
    if (!name || !search.trim()) return;
    setPreferencesBusy(true);
    try {
      const response = await fetch('/api/portal/v7/commercial-search/saved', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ kind, name, query: search }) });
      if (!response.ok) { setNotice('This search could not be saved.'); return; }
      setSavedName(''); await loadSearchPreferences(); setNotice('Search saved to your account.');
    } catch { setNotice('Saved searches are unavailable.'); }
    finally { setPreferencesBusy(false); }
  }

  async function deleteSavedSearch(id: string) {
    try {
      const response = await fetch(`/api/portal/v7/commercial-search/saved/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (response.ok) await loadSearchPreferences();
    } catch { setNotice('Saved searches are unavailable.'); }
  }

  function reopenSearch(choice: SearchChoice) {
    if (choice.kind !== kind) return;
    const next = choice.query;
    activeSearch.current = next;
    setSearchInput(next);
    if (next === search) { void load(); return; }
    invalidateListing();
    setSearch(choice.query);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore || state !== 'available'
      || kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
    const version = listingVersion.current.snapshot();
    setLoadingMore(true); setNotice('');
    try {
      const result = await readListing(kind, nextCursor, search);
      if (!listingVersion.current.isCurrent(version) || kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
      setItems(current => {
        const knownIds = new Set(current.map(item => item.id));
        return [...current, ...result.items.filter(item => !knownIds.has(item.id))];
      });
      setNextCursor(result.nextCursor);
      setState('available');
    } catch (error) {
      if (!listingVersion.current.isCurrent(version) || kind !== activeKind.current || search !== activeSearch.current || scopeKey !== activeScope.current) return;
      if (error instanceof Error && (error.message === 'hidden' || error.message === 'authentication-required')) {
        setItems([]); setNextCursor(null); setState(error.message);
      } else if (error instanceof Error && error.message === 'validation') setNotice('The search request was rejected. Check the search text and try again.');
      else setNotice('More records could not be loaded. The records already shown are unchanged; try again.');
    } finally {
      if (listingVersion.current.isCurrent(version)) setLoadingMore(false);
    }
  }

  async function transition(item: RecordItem, to: string) {
    const epoch = actionVersion.current.snapshot();
    const current = () => actionVersion.current.isCurrent(epoch) && activeKind.current === kind && activeScope.current === scopeKey;
    setBusyId(item.id); setNotice('');
    try {
      const response = await fetch(`/api/portal/v7/commercial-finance/${kind}/${encodeURIComponent(item.id)}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ to, expectedRevision: item.revision }),
      });
      if (!current()) return;
      if (response.status === 401) { setNotice('Your sign-in is no longer valid. Finance records are being checked again.'); await load(true); return; }
      if (response.status === 409) { setNotice('This record changed since it was loaded. The latest authorized version is being refreshed.'); await load(true); return; }
      if (response.status === 404 || response.status === 403) { setHiddenActions(current => [...new Set([...current, `${item.id}:${to}`])]); setNotice('This workflow action is unavailable in your authorized scope.'); await load(true); return; }
      if (response.status === 422) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        if (!current()) return;
        if (error?.error === 'PERMISSION_NOT_CONFIGURED' || error?.error === 'TRANSITION_NOT_ALLOWED') setHiddenActions(current => [...new Set([...current, `${item.id}:${to}`])]);
        setNotice('The server could not apply this workflow action. The record has been refreshed.'); await load(true); return;
      }
      if (!response.ok) { setNotice('The finance service is unavailable. No change was confirmed.'); return; }
      const body: unknown = await response.json();
      if (!current()) return;
      if (!isRecordItem(body, kind) || body.id !== item.id) { setNotice('The finance service returned an invalid response. No change is shown.'); return; }
      const updated = body;
      setItems(current => current.map(row => row.id === updated.id ? updated : row));
      setNotice('Workflow update confirmed by the server.');
    } catch { if (current()) setNotice('The finance service is unavailable. No change was confirmed.'); }
    finally { if (current()) setBusyId(''); }
  }

  function openForm(item?: RecordItem) {
    setEditing(item || null);
    const initial = Object.fromEntries(fields[kind].map(field => [field.key, item?.data[field.key] === undefined ? '' : Array.isArray(item.data[field.key]) ? (item.data[field.key] as unknown[]).join(', ') : String(item.data[field.key])]));
    if (!item) initial.kind = kind;
    setFormData(initial);
    setFormOpen(true);
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const epoch = actionVersion.current.snapshot();
    const current = () => actionVersion.current.isCurrent(epoch) && activeKind.current === kind && activeScope.current === scopeKey;
    setSaving(true); setNotice('');
    const data: Record<string, unknown> = { kind };
    for (const field of fields[kind]) {
      const value = formData[field.key]?.trim() || '';
      // The server forbids a source ID on manual entries; never carry one
      // over when switching from an Expense or Sales Order reference.
      if (kind === 'ledger-entry' && field.key === 'sourceId' && formData.sourceType === 'manual') continue;
      if (!value && field.optional) continue;
      data[field.key] = field.key === 'evidenceIds'
        ? value.split(',').map(entry => entry.trim()).filter(Boolean)
        : field.type === 'number' ? Number(value) : value;
    }
    try {
      const response = await fetch(`/api/portal/v7/commercial-finance/${kind}${editing ? `/${encodeURIComponent(editing.id)}` : ''}`, {
        method: editing ? 'PATCH' : 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(editing ? { data, expectedRevision: editing.revision } : { data }),
      });
      if (!current()) return;
      if (response.status === 401) { setNotice('Your sign-in is no longer valid. Finance records are being checked again.'); setFormOpen(false); await load(true); return; }
      if (response.status === 409) { setNotice('This record changed since it was loaded. The latest authorized version is being refreshed.'); setFormOpen(false); await load(true); return; }
      if (response.status === 404 || response.status === 403) { if (editing) setHiddenRecordControls(current => [...new Set([...current, `${editing.id}:edit`])]); else setCreateHiddenKinds(current => [...new Set([...current, kind])]); setNotice('This action is unavailable in your authorized scope.'); setFormOpen(false); await load(true); return; }
      if (response.status === 422) { const error = await response.json().catch(() => null) as { error?: string } | null; if (!current()) return; if (error?.error === 'PERMISSION_NOT_CONFIGURED' || error?.error === 'AUTHORIZATION_DENIED') { if (editing) setHiddenRecordControls(current => [...new Set([...current, `${editing.id}:edit`])]); else setCreateHiddenKinds(current => [...new Set([...current, kind])]); setFormOpen(false); } setNotice('The server rejected these fields or this action. Review the values and try again.'); return; }
      if (!response.ok) { setNotice('The finance service is unavailable. No change was confirmed.'); return; }
      const body: unknown = await response.json();
      if (!current()) return;
      if (!isRecordItem(body, kind) || (editing && body.id !== editing.id)) { setNotice('The finance service returned an invalid response. No change is shown.'); return; }
      setNotice(editing ? 'Record update confirmed by the server.' : 'Record creation confirmed by the server.');
      setFormOpen(false); await load(true);
    } catch { if (current()) setNotice('The finance service is unavailable. No change was confirmed.'); }
    finally { if (current()) setSaving(false); }
  }

  async function removeRecord(item: RecordItem) {
    if (!window.confirm('Remove this record? The server will apply an audited soft delete.')) return;
    const epoch = actionVersion.current.snapshot();
    const current = () => actionVersion.current.isCurrent(epoch) && activeKind.current === kind && activeScope.current === scopeKey;
    setBusyId(item.id); setNotice('');
    try {
      const response = await fetch(`/api/portal/v7/commercial-finance/${kind}/${encodeURIComponent(item.id)}`, {
        method: 'DELETE', credentials: 'same-origin', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ expectedRevision: item.revision }),
      });
      if (!current()) return;
      if (response.status === 401) setNotice('Your sign-in is no longer valid. Finance records are being checked again.');
      else if (response.status === 409) setNotice('This record changed since it was loaded. The latest authorized version is being refreshed.');
      else if (response.status === 404 || response.status === 403) { setHiddenRecordControls(current => [...new Set([...current, `${item.id}:remove`])]); setNotice('This action is unavailable in your authorized scope.'); }
      else if (response.status === 422) { const error = await response.json().catch(() => null) as { error?: string } | null; if (!current()) return; if (error?.error === 'PERMISSION_NOT_CONFIGURED' || error?.error === 'AUTHORIZATION_DENIED') setHiddenRecordControls(current => [...new Set([...current, `${item.id}:remove`])]); setNotice('The server could not apply this removal.'); }
      else if (!response.ok) setNotice('The finance service could not confirm removal. No success is shown.');
      else setNotice('Record removal confirmed by the server.');
      await load(true);
    } catch { if (current()) setNotice('The finance service is unavailable. No change was confirmed.'); }
    finally { if (current()) setBusyId(''); }
  }

  const inputOptions = (field: Field) => field.options ||
    (kind === 'revenue' && field.key === 'sourceId' ? authorizedRevenueChoices.map(item => item.id) : undefined);
  const inputOptionLabel = (field: Field, option: string) => {
    if (kind !== 'revenue' || field.key !== 'sourceId') return option;
    const item = authorizedRevenueChoices.find(choice => choice.id === option);
    return item ? String(item.data.name || item.data.orderCode || item.id) : option;
  };

  return <div id="commercial-finance-records" className="stack">
    <Panel title={collection === 'expense' ? 'Expense Evidence & Approvals' : collection === 'revenue' ? 'Revenue Evidence & Confirmation' : 'Commercial & Finance Records'} description={collection === 'expense' ? 'Record real expense evidence, then follow the server-controlled draft, review, approval and posting workflow.' : collection === 'revenue' ? 'Record revenue with a verified source, payment status and evidence, then follow the server-controlled confirmation workflow.' : 'Records and workflow outcomes are loaded from the authenticated, scope checked finance service.'}>
      {!collection && <div className="row wrap" aria-label="Finance record type">{kinds.map(option => <Btn key={option.id} small data-finance-kind={option.id} aria-pressed={kind === option.id} onClick={() => {
        setPendingLedgerCreate(false);
        if (kind === option.id) return;
        activeKind.current = option.id;
        activeSearch.current = '';
        invalidateListing();
        setKind(option.id);
        setSearchInput('');
        setSearch('');
        setSavedName('');
        setEditing(null);
        setFormOpen(false);
      }}>{option.label}</Btn>)}</div>}
      {(collection === 'expense' || collection === 'revenue') && <div className="row between wrap"><Chip tone="blue">Live finance contract</Chip><small>Creating a record saves a draft. Submission and independent confirmation remain separate audited actions.</small></div>}
      <form className="row wrap mt" role="search" aria-label={`Search ${kinds.find(option => option.id === kind)?.label}`} onSubmit={event => {
        event.preventDefault();
        const next = searchInput.trim();
        activeSearch.current = next;
        if (next === search) { void load(); return; }
        invalidateListing();
        setSearch(searchInput.trim());
      }}>
        <label className="field grow"><span>Search this collection</span><input type="search" value={searchInput} maxLength={120} onChange={event => setSearchInput(event.target.value)} aria-describedby="finance-search-help" /></label>
        <Btn small type="submit">Search</Btn>
        {search && <Btn small type="button" onClick={() => {
        activeSearch.current = '';
        invalidateListing();
        setSearchInput('');
        setSearch('');
      }}>Clear search</Btn>}
        <small id="finance-search-help">Search checks only fields allowed for this collection.</small>
      </form>
      {(state === 'available' || state === 'no-data') && <div className="stack mt" aria-label="Your saved and recent searches">
        {search && <div className="row wrap"><label className="field"><span>Save this search as</span><input value={savedName} maxLength={80} onChange={event => setSavedName(event.target.value)} /></label><Btn small onClick={() => void saveCurrentSearch()} disabled={!savedName.trim() || preferencesBusy} aria-busy={preferencesBusy}><AsyncButtonLabel busy={preferencesBusy} idle="Save search" busyText="Saving search…"/></Btn></div>}
        {[["Recent searches", recentSearches], ["Frequent searches", frequentSearches], ["Saved searches", savedSearches]].map(([title, choices]) => <div key={title as string}><strong>{title as string}</strong><div className="row wrap">{(choices as SearchChoice[]).filter(choice => choice.kind === kind).map((choice, index) => <span className="row" key={choice.id || `${choice.query}-${index}`}><Btn small onClick={() => reopenSearch(choice)}>{choice.name || choice.query}</Btn>{choice.id && <Btn small aria-label={`Delete saved search ${choice.name || choice.query}`} onClick={() => void deleteSavedSearch(choice.id!)}>Delete</Btn>}</span>)}</div></div>)}
      </div>}
      <div className="row between wrap mt"><p>Changes are checked by the server and must include the current revision.</p>{!createHiddenKinds.includes(kind) && (state === 'available' || state === 'no-data') && <Btn small data-primary-action="finance-create" onClick={() => openForm()}>Create {kind === 'ledger-entry' ? 'Ledger Entry' : kinds.find(option => option.id === kind)?.label.replace(/s$/, '')}</Btn>}</div>
      {formOpen && <form id="commercial-finance-create-form" className="stack mt" onSubmit={saveRecord} aria-label={`${editing ? 'Edit' : 'Create'} ${kind}`}>
        <h3>{editing ? 'Edit Record' : `Create ${kind === 'ledger-entry' ? 'Ledger Entry' : kind}`}</h3>
        <div className="grid2">{fields[kind].map(field => <label className="field" key={field.key}><span>{editing && kind === 'customer' && field.key === 'customerCode' ? 'Customer code (fixed)' : field.label}</span>{inputOptions(field) ? <select required={!field.optional || (field.key === 'sourceId' && ((kind === 'revenue' && formData.sourceType !== 'other') || (kind === 'ledger-entry' && formData.sourceType !== 'manual')))} value={formData[field.key] || ''} onChange={event => setFormData(current => ({ ...current, [field.key]: event.target.value, ...(field.key === 'sourceType' && (kind === 'revenue' || kind === 'ledger-entry') && event.target.value !== current.sourceType ? { sourceId: '' } : {}) }))}><option value="">Select…</option>{inputOptions(field)!.map(option => <option key={option} value={option}>{inputOptionLabel(field, option)}</option>)}</select> : <input required={!field.optional || (field.key === 'sourceId' && ((kind === 'revenue' && formData.sourceType !== 'other') || (kind === 'ledger-entry' && formData.sourceType !== 'manual')))} disabled={Boolean(editing && kind === 'customer' && field.key === 'customerCode') || Boolean(kind === 'revenue' && field.key === 'sourceId' && formData.sourceType === 'other') || Boolean(kind === 'ledger-entry' && field.key === 'sourceId' && formData.sourceType === 'manual')} type={field.type || 'text'} step={field.type === 'number' ? 'any' : undefined} value={formData[field.key] || ''} onChange={event => setFormData(current => ({ ...current, [field.key]: event.target.value }))}/>}</label>)}</div>
        <div className="row wrap"><Btn primary type="submit" disabled={saving} aria-busy={saving}><AsyncButtonLabel busy={saving} idle="Save" busyText="Saving record…"/></Btn><Btn type="button" onClick={() => setFormOpen(false)}>Cancel</Btn></div>
      </form>}
      <div className="row between wrap mt" aria-live="polite"><Chip tone={state === 'available' ? 'blue' : state === 'no-data' ? 'gray' : 'amber'}>{state === 'loading' ? 'Loading authorized records…' : state === 'available' ? 'Records available' : state === 'no-data' ? (search ? 'No matches' : 'No records') : state === 'hidden' ? 'Unavailable in this scope' : state === 'authentication-required' ? 'Sign in required' : state === 'validation' ? 'Search needs attention' : 'Service unavailable'}</Chip><Btn small onClick={() => void load()} disabled={state === 'loading'}>Refresh</Btn></div>
      {state === 'hidden' && <p className="mt" role="status">This collection is unavailable in your authorized scope. No record details or counts are shown.</p>}
      {state === 'authentication-required' && <p className="mt" role="status">Sign in to load authorized finance records. No record details or counts are shown.</p>}
      {state === 'validation' && <p className="mt" role="alert">The search text was not accepted. Use 1 to 120 characters and try again.</p>}
      {state === 'unavailable' && <p className="mt" role="alert">The finance service could not be reached. No records are shown as a fallback.</p>}
      {state === 'no-data' && <p className="mt">No authorized records are available for this collection.</p>}
      {state === 'available' && <div className="stack mt">{items.map(item => { const availableActions = (actions[kind][item.state] || []).filter(action => !hiddenActions.includes(`${item.id}:${action.to}`)); return <article className="record-row" key={item.id} aria-label={`${kind} ${item.state}`}><span className="grow"><strong>{String(item.data.name || item.data.orderCode || item.data.revenueCode || item.data.expenseCode || item.data.entryCode || item.resourceType)}</strong><small>{item.state} · Revision {item.revision}</small></span><span className="row wrap">{editableStates[kind].includes(item.state) && !hiddenRecordControls.includes(`${item.id}:edit`) && <Btn small disabled={busyId === item.id} onClick={() => openForm(item)}>Edit</Btn>}{!hiddenRecordControls.includes(`${item.id}:remove`) && <Btn small disabled={busyId === item.id} onClick={() => void removeRecord(item)}>Remove</Btn>}{(kind === 'customer' || kind === 'sales-order') && <ContextualCommunicationAction person={person} detail={detail} go={go} useCaseId={kind === 'customer' ? 'customer-order-update' : 'finance-contact'} recordLabel={String(item.data.name || item.data.orderCode || 'Authorized Record')} recordId={item.id}/>}{availableActions.map(action => <Btn key={action.to} small disabled={busyId === item.id} aria-busy={busyId === item.id} onClick={() => void transition(item, action.to)}><AsyncButtonLabel busy={busyId === item.id} idle={action.label} busyText="Applying workflow…"/></Btn>)}</span><CommercialFinanceActivity kind={kind} id={item.id}/></article>; })}</div>}
      {state === 'available' && nextCursor && <div className="row mt"><Btn small onClick={() => void loadMore()} disabled={loadingMore} aria-busy={loadingMore}><AsyncButtonLabel busy={loadingMore} idle="Load more" busyText="Loading more records…"/></Btn></div>}
      {notice && <p className="mt" role="status">{notice}</p>}
      <p className="form-note mt">Bank reconciliation requires Owner approval of a non-production provider and verified transaction evidence. Provider data is not connected here.</p>
    </Panel>
    <Panel title="Authorization" description="The server decides access for each request. This screen does not use preview personas, role labels or cached permissions.">
      <p>Actions are hidden after the server denies them. No client permission list is available for prechecking access.</p>
    </Panel>
  </div>;
}
