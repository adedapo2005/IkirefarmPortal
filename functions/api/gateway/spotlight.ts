/**
 * CLOUDFLARE PAGES FUNCTION — DAILY MANAGEMENT SPOTLIGHT
 * Route: GET /api/gateway/spotlight
 */

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify([
    {
      id: 'spot-01',
      title: 'Precision Layer Nutrition & Peak HDEP Calibration',
      body: 'Houses 1 to 3 are maintaining a 92.4% Hen-Day Egg Production rate through balanced crude protein (17.5%) and dietary calcium grit timing. Automated nipple line flow velocity is calibrated at 2.4 m/s to prevent heat stress in afternoon peaks.',
      theme: 'Flock Husbandry · Biosecurity Protocol Level 3',
      publishedAt: new Date().toISOString(),
    },
  ]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
