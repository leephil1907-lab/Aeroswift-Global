const json = (res, status, body) => {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.json(body);
};

const recentRequests = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.AEROSWIFT_ENQUIRY_TO;
  const sender = process.env.AEROSWIFT_ENQUIRY_FROM;
  if (!apiKey || !recipient || !sender) {
    return json(res, 503, {
      error: "The enquiry service is being configured. Please try again later.",
      code: "ENQUIRY_NOT_CONFIGURED",
    });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const last = recentRequests.get(ip) || 0;
  if (now - last < 45000) return json(res, 429, { error: "Please wait before sending another enquiry." });
  if (String(req.body?.website || "").trim()) return json(res, 200, { ok: true });

  const name = String(req.body?.name || "").trim().slice(0, 120);
  const email = String(req.body?.email || "").trim().slice(0, 180);
  const topic = String(req.body?.topic || "General enquiry").trim().slice(0, 100);
  const message = String(req.body?.message || "").trim().slice(0, 5000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
    return json(res, 400, { error: "Enter your name, a valid email address and a message." });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        reply_to: email,
        subject: "AeroSwift website enquiry — " + topic,
        text: "Name: " + name + "\nEmail: " + email + "\nEnquiry type: " + topic + "\n\n" + message,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("AeroSwift enquiry delivery failed:", response.status, result);
      return json(res, 502, { error: "Your enquiry could not be delivered. Please try again later." });
    }
    recentRequests.set(ip, now);
    return json(res, 200, { ok: true, message: "Your enquiry has been sent to the AeroSwift team." });
  } catch (error) {
    console.error("AeroSwift enquiry error:", error);
    return json(res, 502, { error: "The enquiry service is temporarily unavailable." });
  }
}
