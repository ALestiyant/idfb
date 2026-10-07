# IDFB — Facebook ID Finder + FB Check

Versi ini menambahkan menu **FB Check** ke project Facebook ID Finder.

## Fitur

### ID Finder
Masukkan URL Facebook publik untuk mendapatkan numeric Facebook ID.

### FB Check
Masukkan numeric Facebook ID. Sistem akan memeriksa URL:

`https://www.facebook.com/profile.php?id=ID`

melalui Apify Actor `axiomworks~facebook-id-finder`.

Status yang ditampilkan:

- **FOUND** — ID dapat ditemukan dan diakses secara publik.
- **NOT FOUND** — ID tidak ditemukan atau tidak dapat diakses.
- **RESTRICTED** — Facebook meminta login atau membatasi akses, sehingga belum dapat diverifikasi.
- **CHECK FAILED** — pemeriksaan gagal.

> FOUND tidak berarti pemilik akun sedang online. RESTRICTED juga tidak otomatis berarti akun sudah mati/dihapus.

## Environment Variable Vercel

Wajib tetap menggunakan:

`APIFY_API_TOKEN`

Token dimasukkan di Vercel → Project → Settings → Environment Variables.
Jangan memasukkan token ke file frontend.

## API endpoint

- `/api/find` — URL Facebook → ID
- `/api/check` — Facebook ID → status publik

Apify endpoint:

`POST https://api.apify.com/v2/actors/axiomworks~facebook-id-finder/run-sync-get-dataset-items`

## Deploy

Build command: `npm run build`

Output directory: `dist`
