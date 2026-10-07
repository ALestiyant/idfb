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

  const id = String(req.body?.id || "").trim();

  if (!id) {
    return res.status(400).json({ error: "Facebook ID wajib diisi." });
  }

  if (!/^\d{1,30}$/.test(id)) {
    return res.status(400).json({
      error: "Facebook ID harus berupa angka saja."
    });
  }

  const sourceUrl = `https://www.facebook.com/profile.php?id=${encodeURIComponent(id)}`;
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
        urls: [sourceUrl],
        maxItems: 1,
        fetchDetails: true
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
    const status = item?.status || "error";

    const statusInfo = {
      ok: {
        found: true,
        title: "FOUND",
        message: "ID dapat ditemukan dan diakses secara publik."
      },
      not_found: {
        found: false,
        title: "NOT FOUND",
        message: "ID tidak ditemukan atau tidak dapat diakses."
      },
      login_required: {
        found: false,
        title: "RESTRICTED",
        message: "Facebook meminta login atau membatasi akses, jadi ID tidak dapat diverifikasi."
      },
      error: {
        found: false,
        title: "CHECK FAILED",
        message: item?.error || "Pemeriksaan gagal. Silakan coba lagi."
      }
    }[status] || {
      found: false,
      title: "CHECK FAILED",
      message: item?.error || "Status Facebook tidak dapat ditentukan."
    };

    return res.status(200).json({
      id,
      status,
      found: statusInfo.found,
      title: statusInfo.title,
      message: statusInfo.message,
      type: item?.type || null,
      name: item?.name || null,
      vanity: item?.vanity || null,
      canonicalUrl: item?.canonicalUrl || null,
      imageUrl: item?.imageUrl || null,
      pageId: item?.pageId || null,
      sourceUrl
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
