'use client';

import React, { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { Panel } from './Common';
import LoggedTimestamp from './LoggedTimestamp';

type Condition = { text?: string };
type Measure = { degrees?: number; unit?: string; value?: number; units?: string };
type CurrentWeather = { displayName?: Condition; weatherCondition?: { description?: Condition }; temperature?: Measure; feelsLikeTemperature?: Measure; relativeHumidity?: number; wind?: { speed?: Measure }; currentTime?: string };
type WeatherResponse = { state?: string; weather?: CurrentWeather | null };
type LocationResponse = { geolocation?: { accuracy?: string; city?: string | null; region?: string | null; country?: string | null; use?: string } };

function measure(value?: Measure) { const unit = value?.unit || value?.units || ''; if (typeof value?.degrees === 'number') return `${value.degrees}°${/FAHRENHEIT/i.test(unit) ? 'F' : /CELSIUS/i.test(unit) ? 'C' : unit}`; if (typeof value?.value === 'number') return `${value.value} ${unit.replace('KILOMETERS_PER_HOUR', 'km/h').replace('MILES_PER_HOUR', 'mph')}`.trim(); return null; }

export default function AuthorizedLocationWeather() {
  const [state, setState] = useState<'loading' | 'AVAILABLE' | 'PROVIDER_REQUIRED' | 'UNAVAILABLE' | 'LOCATION_REQUIRED'>('loading');
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [location, setLocation] = useState('');
  useEffect(() => {
    let active = true;
    const get = async () => {
      try {
        const [weatherResponse, locationResponse] = await Promise.all([
          fetch('/api/dashboard/weather', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } }),
          fetch('/api/portal/context/geolocation', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } }).catch(() => null),
        ]);
        if (!active) return;
        if (weatherResponse.status === 404 || weatherResponse.status === 403) { setState('UNAVAILABLE'); return; }
        if (!weatherResponse.ok) { setState('UNAVAILABLE'); return; }
        const result = await weatherResponse.json() as WeatherResponse;
        if (locationResponse?.ok) {
          const context = await locationResponse.json() as LocationResponse;
          const geo = context.geolocation;
          if (geo?.accuracy === 'approximate' && geo.use === 'context-only') setLocation([geo.city, geo.region, geo.country].filter(Boolean).join(', '));
        }
        if (result.state === 'AVAILABLE' && result.weather && typeof result.weather === 'object') { setWeather(result.weather); setState('AVAILABLE'); }
        else if (result.state === 'PROVIDER_REQUIRED') setState('PROVIDER_REQUIRED');
        else if (result.state === 'LOCATION_REQUIRED') setState('LOCATION_REQUIRED');
        else setState('UNAVAILABLE');
      } catch { if (active) setState('UNAVAILABLE'); }
    };
    void get();
    return () => { active = false; };
  }, []);
  const context = state === 'loading' ? 'Loading current conditions…' : state === 'AVAILABLE' ? 'Current conditions' : state === 'PROVIDER_REQUIRED' ? 'Weather provider or location required' : state === 'LOCATION_REQUIRED' ? 'Location required for weather' : 'Weather unavailable';
  const condition = weather?.weatherCondition?.description?.text || weather?.displayName?.text;
  const temperature = measure(weather?.temperature);
  return <Panel title="Your local weather" description={context}>
    <div aria-live="polite" aria-busy={state === 'loading'}>
      {state === 'loading' && <p role="status">Loading weather from the authorized server service…</p>}
      {state === 'AVAILABLE' && <div className="stack"><div className="row wrap">{condition && <strong>{condition}</strong>}{temperature && <span className="metric">{temperature}</span>}{!condition && !temperature && <span>Current conditions are available; no displayable values were returned.</span>}</div>{location && <small>Approximate visitor context · {location}</small>}<dl className="identity-facts">{measure(weather?.feelsLikeTemperature) && <div><dt>Feels like</dt><dd>{measure(weather?.feelsLikeTemperature)}</dd></div>}{typeof weather?.relativeHumidity === 'number' && <div><dt>Humidity</dt><dd>{weather.relativeHumidity}%</dd></div>}{measure(weather?.wind?.speed) && <div><dt>Wind</dt><dd>{measure(weather?.wind?.speed)}</dd></div>}{weather?.currentTime != null && <div><dt>Observation time</dt><dd><LoggedTimestamp value={weather.currentTime}/></dd></div>}</dl></div>}
      {state === 'PROVIDER_REQUIRED' && <p><CloudOff size={16}/> A weather provider or server location is required. No observation is available.</p>}
      {state === 'LOCATION_REQUIRED' && <p><CloudOff size={16}/> Weather needs an available approximate visitor context or configured server location.</p>}
      {state === 'UNAVAILABLE' && <p role="status"><CloudOff size={16}/> Current weather is unavailable. No values are estimated.</p>}
    </div>
  </Panel>;
}
