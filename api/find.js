// Vercel Serverless Function
// Tidak membutuhkan token Facebook untuk percobaan membaca HTML publik.
// Facebook dapat memblokir request otomatis; jika itu terjadi, API akan mengembalikan pesan error.

export default async function handler(req, res) {
  const input = String(req.query.id || '').trim();
  if (!input) return res.status(400).json({success:false,message:'URL Facebook belum diisi.'});

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : 'https://' + input);
  } catch {
    return res.status(400).json({success:false,message:'URL tidak valid.'});
  }

  if (!/(^|\.)facebook\.com$/i.test(url.hostname.replace(/^www\./i,''))) {
    return res.status(400).json({success:false,message:'Masukkan URL dari facebook.com.'});
  }

  // Format profile.php?id=...
  const qp = url.searchParams.get('id');
  if (qp && /^\d+$/.test(qp)) {
    return res.status(200).json({success:true,id:qp,source:'url'});
  }

  // URL langsung berupa angka
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    return res.status(200).json({success:true,id:parts[0],source:'url'});
  }

  // Coba membaca halaman publik Facebook.
  try {
    const response = await fetch(url.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        success:false,
        message:`Facebook menolak/menggagalkan permintaan (HTTP ${response.status}). Coba lagi nanti atau gunakan ID dari URL profile.php.`
      });
    }

    const html = await response.text();

    // Beberapa pola yang pernah muncul pada HTML Facebook.
    const patterns = [
      /"entity_id":"(\d+)"/i,
      /"profile_id":"(\d+)"/i,
      /"profileID":"(\d+)"/i,
      /"userID":"(\d+)"/i,
      /"user_id":"(\d+)"/i,
      /"owner_id":"(\d+)"/i,
      /"page_id":"(\d+)"/i
    ];

    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        return res.status(200).json({
          success:true,
          id:m[1],
          username: parts[0],
          source:'facebook-html'
        });
      }
    }

    return res.status(404).json({
      success:false,
      message:'ID numerik tidak ditemukan. Facebook mungkin tidak menampilkan ID pada halaman tersebut atau akses otomatis sedang dibatasi.'
    });
  } catch (err) {
    return res.status(502).json({
      success:false,
      message:'Tidak dapat mengakses halaman Facebook dari server. Coba lagi beberapa saat.'
    });
  }
}