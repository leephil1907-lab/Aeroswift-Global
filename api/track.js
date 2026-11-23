const json = (res, status, body) => {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.json(body);
};

const normalizeTracker = (tracker) => ({
  id: tracker.id,
  trackingNumber: tracker.tracking_number,
  carrier: tracker.carrier_name,
  carrierName: tracker.carrier_id || tracker.carrier_name,
  status: tracker.status || "unknown",
  delivered: Boolean(tracker.delivered),
  estimatedDelivery: tracker.estimated_delivery || tracker.info?.expected_delivery || null,
  info: tracker.info || {},
  events: Array.isArray(tracker.events) ? tracker.events.map((event) => ({
    date: event.date || null,
    time: event.time || null,
    description: event.description || event.code || "Shipment update",
    location: event.location || null,
    code: event.code || null,
    latitude: Number.isFinite(Number(event.latitude)) ? Number(event.latitude) : null,
    longitude: Number.isFinite(Number(event.longitude)) ? Number(event.longitude) : null,
  })) : [],
  source: tracker.info?.source || "Carrier tracking network",
  testMode: Boolean(tracker.test_mode),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed." });
  }

  const apiUrl = process.env.KARRIO_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.KARRIO_API_KEY;
  if (!apiUrl || !apiKey) {
    return json(res, 503, {
      error: "Shipment tracking is not connected yet.",
      code: "TRACKING_NOT_CONFIGURED",
      message: "AeroSwift's carrier tracking service is being connected. Please contact the shipping team for an update.",
    });
  }

  const trackingNumber = String(req.body?.trackingNumber || "").trim();
  const carrier = String(req.body?.carrier || "").trim().toLowerCase();
  if (!trackingNumber || trackingNumber.length < 4 || trackingNumber.length > 80) {
    return json(res, 400, { error: "Enter a valid tracking or air waybill reference." });
  }

  const headers = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const existing = await fetch(`${apiUrl}/v1/trackers/${encodeURIComponent(trackingNumber)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });

    if (existing.ok) {
      const tracker = await existing.json();
      return json(res, 200, { tracker: normalizeTracker(tracker) });
    }

    if (existing.status !== 404 && existing.status !== 400) {
      const detail = await existing.text();
      console.error("Karrio tracker lookup failed:", existing.status, detail.slice(0, 500));
      return json(res, 502, { error: "The carrier tracking service could not complete this lookup. Try again shortly." });
    }

    if (!carrier) {
      return json(res, 409, {
        code: "CARRIER_REQUIRED",
        needsCarrier: true,
        message: "This reference is not in AeroSwift's tracking records yet. Select the carrier printed on your receipt or air waybill to request a live carrier lookup.",
      });
    }

    const created = await fetch(`${apiUrl}/v1/trackers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tracking_number: trackingNumber,
        carrier_name: carrier,
      }),
      signal: AbortSignal.timeout(18000),
    });

    const payload = await created.json().catch(() => ({}));
    if (!created.ok) {
      const message = payload?.detail || payload?.message || "The carrier did not return tracking information for this reference.";
      return json(res, created.status === 404 ? 404 : 422, {
        error: typeof message === "string" ? message : "The carrier could not locate this shipment.",
        code: "CARRIER_LOOKUP_FAILED",
      });
    }

    return json(res, 200, { tracker: normalizeTracker(payload) });
  } catch (error) {
    console.error("AeroSwift tracking request failed:", error);
    return json(res, 502, { error: "Tracking service temporarily unavailable. Please try again." });
  }
}
