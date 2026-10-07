# Facebook ID Finder v3

Tool sederhana untuk mencoba menemukan Facebook Numeric ID dari URL atau username menggunakan metadata publik yang dapat diakses tanpa login.

## Deploy ke Vercel

1. Upload folder ini ke repository GitHub.
2. Import repository tersebut ke Vercel.
3. Framework Preset: **Other** (atau biarkan Vercel mendeteksi sebagai static site).
4. **Build Command:** kosongkan. Proyek ini tidak membutuhkan `npm run build`.
5. **Output Directory:** kosongkan.
6. Deploy.

API tersedia melalui `/facebook?input=USERNAME` dan diarahkan ke `/api/facebook` oleh `vercel.json`.

## Catatan penting

Facebook dapat memblokir request otomatis, mengarahkan ke login/checkpoint, atau tidak mengirim Numeric ID di halaman publik. Dalam kondisi tersebut aplikasi akan menampilkan alasan yang lebih jelas daripada `[object Object]`; aplikasi tidak melakukan login, bypass CAPTCHA, atau bypass pembatasan akses Facebook.
