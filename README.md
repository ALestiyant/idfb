# Facebook ID Finder

Versi sederhana untuk Vercel. Struktur resolver mengikuti pendekatan open-source
`refatbd/info-facebook-user` (MIT), tetapi UI dan endpoint dibuat ulang untuk proyek ini.

## File
- index.html
- api/facebook.js
- vercel.json
- package.json

## Deploy
Upload seluruh file ke GitHub, lalu import repository ke Vercel.
Tidak perlu Build Command dan tidak perlu Environment Variable.

## Endpoint
GET /facebook?input=USERNAME_OR_URL

Contoh:
`/facebook?input=putri.bhogell.777`

## Catatan
Facebook dapat memblokir atau mengubah halaman publiknya. Resolver hanya mengembalikan
ID jika ID tersebut benar-benar ditemukan pada response yang diterima server.
Tidak ada ID yang ditebak.

Referensi open-source:
https://github.com/refatbd/info-facebook-user
