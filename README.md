# Facebook ID Finder — Apify V1

Versi ini memakai Apify Actor:

axiomworks~facebook-id-finder

Actor tersebut menerima input:
{
  "urls": ["https://www.facebook.com/nasa"],
  "maxItems": 1
}

dan mengembalikan data seperti:
{
  "id": "100044561550831",
  "type": "page",
  "name": "NASA - National Aeronautics and Space Administration",
  "vanity": "NASA",
  "imageUrl": "...",
  "status": "ok"
}

## Vercel

Environment Variable yang wajib:

APIFY_API_TOKEN

Masukkan API token Apify Anda di:
Vercel > Project > Settings > Environment Variables

Jangan memasukkan token ke src/main.jsx.

## Apify

Actor page:
https://apify.com/axiomworks/facebook-id-finder

Apify API docs:
https://docs.apify.com/api/v2

Endpoint yang dipakai:
POST https://api.apify.com/v2/actors/axiomworks~facebook-id-finder/run-sync-get-dataset-items

## Deploy

Build command:
npm run build

Output directory:
dist

Tidak perlu GitHub untuk deployment pertama jika menggunakan Vercel Drop.
