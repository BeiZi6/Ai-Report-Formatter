# Web (Next.js)

## Install

```bash
npm install
```

## Run (development)

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

## Desktop (Electron)

Install desktop backend build dependency once:

```bash
python3 -m pip install -r ../api/requirements-desktop.txt
```

Run web + local FastAPI + Electron shell in development:

```bash
npm run dev:desktop
```

Build offline desktop installers (dmg/nsis/AppImage):

```bash
npm run build:desktop
```

Build unpacked offline desktop bundle only:

```bash
npm run pack:desktop
```

Build and publish desktop artifacts (for tagged release CI):

```bash
npm run release:desktop
```

Notes:

- The UI is exported as static files (`out/`) during desktop build.
- `build:desktop` and `pack:desktop` compile FastAPI into a local executable and bundle it.
- Packaged app starts bundled backend automatically at `http://127.0.0.1:8000`.
- Electron security defaults are enabled (`contextIsolation`, `sandbox`, `nodeIntegration: false`).
- Release workflow is defined in `.github/workflows/release-desktop.yml`.

## Tests

```bash
npm run test:electron
npx playwright test
```

## Environment

- `NEXT_PUBLIC_API_BASE`: FastAPI base URL (example: `http://localhost:8000`)
- `CSC_LINK`: base64 or file URL for code signing certificate used by electron-builder.
- `CSC_KEY_PASSWORD`: password for signing certificate.
- `APPLE_ID`: Apple Developer account email for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for Apple notarization.
- `APPLE_TEAM_ID`: Apple Team ID for notarization.

## Compliance Documents

- License: `LICENSE`
- Privacy policy: `docs/privacy-policy.md`
- EULA: `docs/eula.md`
- Release history: `CHANGELOG.md`
