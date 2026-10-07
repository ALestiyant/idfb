export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "APIFY_API_TOKEN belum dikonfigurasi di Vercel."
    });
  }

  const url = String(req.body?.url || "").trim();

  if (!url) {
    return res.status(400).json({ error: "URL Facebook wajib diisi." });
  }

  const actorId = "axiomworks~facebook-id-finder";
  const endpoint =
    `https://api.apify.com/v2/actors/${actorId}/run-sync-get-dataset-items`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        urls: [url],
        maxItems: 1
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(502).json({
        error: data?.error?.message || "Apify API mengembalikan error."
      });
    }

    const item = Array.isArray(data) ? data[0] : null;

    if (!item || !item.id || item.status !== "ok") {
      return res.status(404).json({
        error: item?.error || "Facebook ID tidak ditemukan untuk URL tersebut."
      });
    }

    return res.status(200).json({
      id: String(item.id),
      type: item.type || null,
      name: item.name || null,
      vanity: item.vanity || null,
      canonicalUrl: item.canonicalUrl || null,
      imageUrl: item.imageUrl || null,
      pageId: item.pageId || null,
      sourceUrl: item.inputUrl || url
    });
  } catch (error) {
    return res.status(502).json({
      error:
        error?.name === "AbortError"
          ? "Proses terlalu lama. Silakan coba lagi."
          : "Tidak dapat menghubungi Apify."
    });
  }
}
