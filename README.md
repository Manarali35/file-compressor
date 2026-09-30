# File Compressor

## Requirements

- Node.js 18+
- Ghostscript installed and available in PATH

## Run

Open a terminal inside `backend`:

```bash
npm install
npm start
```

Then open:

http://localhost:3000

## Ghostscript

Windows:
- Install Ghostscript.
- Make sure `gswin64c.exe` is available in PATH.

Linux:
```bash
sudo apt install ghostscript
```

macOS:
```bash
brew install ghostscript
```

## Notes

- Images are compressed in the browser.
- PDFs are sent to the backend and processed by Ghostscript.
- The backend deletes the uploaded input after processing.
- The output is deleted after a download attempt.
- This is a development-ready starter, not a production deployment. Before publishing publicly, add HTTPS, authentication if needed, rate limiting, stronger file validation, logging, resource limits, and a privacy policy.
