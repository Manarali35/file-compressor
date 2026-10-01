# File Compressor

Compress PDF files through the backend and CloudConvert, and compress supported images in the browser.

## Run locally

Requirements:
- Node.js 18+
- A CloudConvert API key for PDF compression

Open a terminal inside `backend`:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deployment

The backend reads the deployment-provided `PORT` value and listens on `0.0.0.0`.

Required environment variable:

- `CLOUDCONVERT_API_KEY`

For the current Abasthan setup, use:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/healthz`

## Website information pages

The frontend includes About, Privacy Policy, Terms of Service, Contact, PDF compression guidance, and image compression guidance. `robots.txt` and `sitemap.xml` are included for search-engine discovery.

## Security notes

- Never commit `backend/.env`.
- Never publish a CloudConvert API key.
- Uploaded PDF files are stored temporarily by the backend and the temporary input is deleted after processing.
- Keep original files and do not treat the service as a backup system.
