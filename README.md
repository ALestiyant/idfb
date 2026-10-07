# Facebook ID Finder v4

Simple Vercel-ready static frontend + serverless API.

## Important limitation

A username such as `facebook.com/namauser` does not reliably expose a numeric ID to an unauthenticated server. Facebook may return HTTP 400/403/429, a login wall, or HTML without the ID. This project does not log in to Facebook or bypass access controls.

The API tries the public `www`, `m`, and `mbasic` Facebook hosts and extracts an ID only when Facebook actually exposes one in public metadata. If the input already contains a numeric ID (`profile.php?id=...`, `/groups/123...`, or a raw number), it is returned directly without requesting Facebook.

## Deploy to Vercel

1. Upload this folder to GitHub.
2. Import the repository into Vercel.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: leave empty.
6. Deploy.

No `npm install` or `npm run build` is required.
