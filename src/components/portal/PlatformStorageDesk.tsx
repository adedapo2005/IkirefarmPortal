'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CloudOff, FolderLock, RefreshCw, ShieldCheck } from 'lucide-react';
import { has, isOwnerPrincipal, type Persona } from '@/lib/portal-model';
import { Btn, Chip, Panel } from './Common';
import LoggedTimestamp from './LoggedTimestamp';

type StorageView = {
  primary?: { provider?: string; state?: string; authoritative?: boolean };
  queue?: { provider?: string; state?: string };
  oneDrive?: { state?: string; auth?: string; health?: { pending?: number; retrying?: number; failed?: number; lastSuccessAt?: string | null; lastFailureAt?: string | null } };
  weather?: { state?: string; configured?: boolean; secretReturned?: false };
};
type State = 'loading' | 'ready' | 'hidden' | 'unavailable';
const api = '/api/admin/platform/storage';
const time = (value?: string | null) => value ? <LoggedTimestamp value={value}/> : 'Not available';

export default function PlatformStorageDesk({ person }: { person: Persona }) {
  const [state, setState] = useState<State>('loading');
  const [data, setData] = useState<StorageView | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [apiKey, setApiKey] = useState('');
  const owner = isOwnerPrincipal(person);
  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch(api, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } });
      if (response.status === 403 || response.status === 404) { setData(null); setState('hidden'); return; }
      if (!response.ok) throw new Error('unavailable');
      const result = await response.json() as StorageView;
      setData(result); setState('ready');
    } catch { setData(null); setState('unavailable'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function mutate(method: 'POST' | 'DELETE' | 'PUT', body: Record<string, unknown>, label: string) {
    setBusy(label); setNotice('');
    try {
      const response = await fetch(api, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(result.state === 'PROVIDER_REQUIRED' ? 'The required provider is not configured.' : 'The authorized storage service could not complete this request.');
      if (label === 'connect') {
        const authUrl = typeof result.authorizationUrl === 'string' ? new URL(result.authorizationUrl) : null;
        if (!authUrl || authUrl.protocol !== 'https:' || authUrl.hostname !== 'login.microsoftonline.com' || authUrl.pathname !== '/common/oauth2/v2.0/authorize') throw new Error('The service did not return an official Microsoft authorization link.');
        window.location.assign(authUrl.toString()); return;
      }
      setNotice(label === 'weather-key' ? 'Weather credential submitted securely. The secret is not returned.' : label === 'weather-remove' ? 'Weather credential removed.' : label === 'destination' ? 'OneDrive destination updated.' : 'OneDrive connection disconnected.');
      if (label === 'weather-key' || label === 'weather-remove') setApiKey('');
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The authorized storage service is unavailable.'); }
    finally { if (label.startsWith('weather-')) setApiKey(''); setBusy(''); }
  }

  if (state === 'loading') return <Panel title="Cloud Storage & Backup"><p role="status">Loading authorized storage status…</p></Panel>;
  if (state === 'hidden') return <Panel title="Cloud Storage & Backup"><p role="status">This storage workspace is unavailable in your authorized scope.</p></Panel>;
  if (state === 'unavailable' || !data) return <Panel title="Cloud Storage & Backup"><div role="alert"><CloudOff size={18}/> Storage status is unavailable. No provider status is assumed.</div><Btn className="mt" onClick={() => void load()}>Retry</Btn></Panel>;
  const health = data.oneDrive?.health;
  return <div className="stack">
    <Panel title="Cloud Storage & Backup" description="Platform storage status and provider controls. Secret values are never returned by the service." action={<Btn small onClick={() => void load()}><RefreshCw size={15}/>Refresh</Btn>}>
      <div className="grid2">
        <section aria-labelledby="r2-title"><h3 id="r2-title">Primary storage · Cloudflare R2</h3><div className="row wrap mt"><Chip tone={data.primary?.state === 'AVAILABLE' ? 'blue' : 'amber'}>{data.primary?.state === 'AVAILABLE' ? 'Available' : data.primary?.state === 'UNAVAILABLE' ? 'Unavailable' : 'Provider required'}</Chip><Chip>Production activation off</Chip>{data.primary?.authoritative && <Chip>Primary evidence store</Chip>}</div><p className="mt">R2 is the primary evidence store. Queue: {data.queue?.state === 'AVAILABLE' ? 'available' : data.queue?.state === 'PROVIDER_REQUIRED' ? 'provider required' : data.queue?.state === 'UNAVAILABLE' ? 'unavailable' : 'status not reported'}.</p><p>Backup retention default: keep the backup after portal deletion. Retention and recovery administration is not available in this frontend.</p><p>Mirror operations create audit events; audit record details are not shown in this view.</p></section>
        <section aria-labelledby="drive-title"><h3 id="drive-title">Secondary storage · OneDrive</h3><div className="row wrap mt"><Chip tone={data.oneDrive?.state === 'CONNECTED' ? 'blue' : 'amber'}>{data.oneDrive?.state === 'CONNECTED' ? 'Connected' : data.oneDrive?.state === 'DISCONNECTED' ? 'Disconnected' : data.oneDrive?.state === 'PROVIDER_REQUIRED' ? 'Provider required' : data.oneDrive?.state === 'UNAVAILABLE' ? 'Unavailable' : 'Status not reported'}</Chip><small>{data.oneDrive?.auth === 'CONNECTED' ? 'Microsoft authorization connected' : data.oneDrive?.auth === 'PROVIDER_REQUIRED' ? 'Microsoft authorization required' : 'Authorization status not reported'}</small></div><dl className="identity-facts">{([['Pending', health?.pending], ['Retrying', health?.retrying], ['Failed', health?.failed]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === 'number' ? value : 'Not reported'}</dd></div>)}<div><dt>Last successful mirror</dt><dd>{time(health?.lastSuccessAt)}</dd></div><div><dt>Last failure</dt><dd>{time(health?.lastFailureAt)}</dd></div></dl>
          {owner && <div className="stack mt"><div className="row wrap">{data.oneDrive?.state === 'CONNECTED' ? <><Btn disabled={!!busy} onClick={() => void mutate('POST', {}, 'connect')}>Reconnect OneDrive</Btn><Btn disabled={!!busy} onClick={() => void mutate('DELETE', {}, 'disconnect')}>Disconnect OneDrive</Btn></> : data.oneDrive?.state === 'PROVIDER_REQUIRED' || data.oneDrive?.state === 'DISCONNECTED' ? <Btn disabled={!!busy} onClick={() => void mutate('POST', {}, 'connect')}>Connect OneDrive</Btn> : <span>Connection controls unavailable until provider status is confirmed.</span>}</div><p>Connection opens Microsoft authorization. This source-ready integration has not been verified with a live provider.</p></div>}
        </section>
      </div>
    </Panel>
    <Panel title="Google Weather" description="The API credential is sent only to the authorized server endpoint. It is never shown again or stored in browser storage.">
      <div className="row wrap"><Chip tone={data.weather?.configured ? 'blue' : 'amber'}>{data.weather?.configured ? 'Configured' : data.weather?.state === 'UNAVAILABLE' ? 'Unavailable' : 'Provider required'}</Chip><small><ShieldCheck size={15}/> Secret returned: no</small><Chip>Production activation off</Chip></div>
          {owner && <form className="stack mt" onSubmit={event => { event.preventDefault(); void mutate('PUT', { provider: 'google-weather', apiKey }, 'weather-key'); }}><label className="field">Replace Google Weather API credential<input type="password" name="google-weather-api-key" value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="new-password" spellCheck={false} disabled={!!busy} /></label><div className="row wrap"><Btn type="submit" disabled={!!busy || !apiKey.trim()}>Validate and save credential</Btn><Btn type="button" disabled={!!busy || !data.weather?.configured} onClick={() => void mutate('DELETE', { provider: 'google-weather' }, 'weather-remove')}>Remove credential</Btn></div></form>}
    </Panel>
    {notice && <p role="status" aria-live="polite">{notice}</p>}
    <p className="form-note"><FolderLock size={15}/> OneDrive is a secondary mirror. A connection alone does not verify a copied file. Owner OAuth and non-production copy verification remain required. Provider errors, identifiers, paths, counts, and audit details are not exposed here.</p>
  </div>;
}
