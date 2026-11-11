# rekindledapp.com

Static site migrated from Tilda to Vercel (November 2026). The Tilda project is kept as a read-only replica until the domain cut-over is confirmed.

Pages:
- `/` (Tilda page 83587046)
- `/privacy-policy` (Tilda page 82533916)
- `/terms-of-service` (Tilda page 82536816)
- `/verified` (Tilda page 84896256)
- `/assessments/relationship-check` (Tilda page 115728486)
- `/assessments/anxious-attachment-check` (Tilda page 119456546)

- No build step: plain HTML/CSS/JS, deployed by Vercel from `main`.
- `vercel.json` enables clean URLs and redirects Tilda's `/pageNNN.html` aliases.
- Images formerly served from Tilda's CDN live in `assets/`.

Local preview: `python3 -m http.server 8080` in this folder, then open http://localhost:8080/index.html
