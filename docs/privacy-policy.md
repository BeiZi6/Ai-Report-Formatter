# Privacy Policy

Last updated: 2026-02-09

This document describes how AI Report Formatter handles user data.

## 1. Data Processing Scope

- The desktop app processes Markdown and generated DOCX content locally on the user device.
- The bundled FastAPI backend runs on `127.0.0.1` and is only used by the local app process.
- By default, document content is not uploaded to external services by the desktop workflow.

## 2. Diagnostic Logs

- The app stores runtime logs locally under the operating system user data directory.
- Logs may contain technical error metadata (for example stack traces and file paths).
- Logs are used only for troubleshooting and can be exported manually by the user.

## 3. Data Retention

- Temporary files created for document generation are removed after request handling.
- Runtime logs are retained locally until the user deletes them or uninstalls the app.

## 4. Network Access

- In packaged desktop mode, the app backend is expected to run locally.
- Any external navigation from the app is opened in the system browser.

## 5. Third-Party Components

- The application depends on open-source libraries (Electron, Next.js, FastAPI, and others).
- Third-party licenses and obligations apply according to each dependency license.

## 6. User Rights

- Users may remove generated documents and logs from their local machine at any time.
- Users may stop using the product and uninstall it without additional account actions.

## 7. Contact

For privacy questions, contact the maintainer listed in the repository metadata.
