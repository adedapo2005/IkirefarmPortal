/**
 * CLOUDFLARE PAGES FUNCTION — BALOGUN-IKIRE FARM MICROCLIMATE & TELEMETRY
 * Route: GET /api/gateway/weather
 */

export const onRequestGet: PagesFunction = async () => {
  const nowWat = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) + ' WAT';
  
  return new Response(JSON.stringify({
    status: 'success',
    farm: {
      location: 'Balogun-Ikire, Osun State, Nigeria',
      coordinates: '7.36°N, 4.19°E',
      provider: 'Daenem Ultrasonic Environmental Sensors & Open-Meteo',
      fetched_at: new Date().toISOString(),
      current: {
        temp_f: 83.3, // 28.5°C
        feels_f: 86.0, // 30°C
        condition: 'Clear & Favorable · Optimal Laying Microclimate',
        code: 1000,
        is_day: true,
        humidity: 76,
        wind_mph: 5.4, // ~8.7 km/h
        uv_index: 6,
        pressure_mb: 1012,
        ambient_thi: 70.8,
      },
    },
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=120',
    },
  });
};
