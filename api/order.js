// Tar emot en beställning, ger den nästa ordernummer (QR-001, QR-002 ...),
// sparar den i Vercel Blob och skickar den vidare till Formspree som mejl.
const { put, list } = require("@vercel/blob");

const FORMSPREE = "https://formspree.io/f/maeoozal";
const PREFIX = "ordrar/QR-";

const nextNumber = async () => {
  let highest = 0;
  let cursor;
  do {
    const res = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of res.blobs) {
      const n = parseInt(b.pathname.slice(PREFIX.length), 10);
      if (n > highest) highest = n;
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return highest + 1;
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Använd POST" });
  }
  const body = await readBody(req);
  if (body._gotcha) return res.status(200).json({ ok: true });

  const falt = ["paket", "namn", "foretag", "epost", "telefon", "ort", "antal", "meddelande", "belopp"];
  const order = {};
  for (const k of falt) if (body[k] != null && body[k] !== "") order[k] = String(body[k]).slice(0, 2000);
  if (!order.namn || !order.foretag || !order.epost) {
    return res.status(400).json({ error: "Namn, företag och e-post krävs" });
  }

  // Ge ordern ett nummer. Om två beställningar kommer exakt samtidigt tar den andra nästa nummer.
  let nr = await nextNumber();
  let id;
  for (let i = 0; i < 5; i++, nr++) {
    id = `QR-${String(nr).padStart(3, "0")}`;
    try {
      await put(`${PREFIX}${String(nr).padStart(3, "0")}.json`,
        JSON.stringify({ ordernummer: id, skapad: new Date().toISOString(), ...order }, null, 2),
        { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false });
      break;
    } catch (e) {
      if (i === 4) throw e;
    }
  }

  const mejl = {
    ordernummer: id,
    ...order,
    _replyto: order.epost,
    _subject: `Beställning ${id}: ${order.foretag}`,
  };
  const fs = await fetch(FORMSPREE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(mejl),
  });
  if (!fs.ok) {
    console.error("Formspree svarade", fs.status, await fs.text());
    return res.status(502).json({ error: "Kunde inte skicka mejlet", ordernummer: id });
  }
  return res.status(200).json({ ok: true, ordernummer: id });
};
