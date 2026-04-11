# Contributing Guide

Thanks for checking this project.

## Setup

1. Install Node.js 18+.
2. Install MySQL 8+.
3. Copy backend/.env.example to backend/.env and fill values.
4. Install dependencies.
   - cd backend
   - npm install
5. Start server.
   - npm start

## Branch and commit style

- Create focused branches, for example: feat/menu-image-mapping or fix/payment-proof-upload.
- Keep commits small and descriptive.
- Preferred commit format:
  - feat: add menu card image mapping for local assets
  - fix: handle upload directory on Render disk
  - docs: improve setup instructions

## Pull request checklist

- Feature works locally.
- No new console errors in browser for touched pages.
- Backend starts without crash.
- README or docs updated for behavior/config changes.
- Do not commit secrets, node_modules, or generated upload screenshots.

## Code style notes

- Keep frontend JavaScript readable and function-oriented.
- Prefer clear variable names over short abbreviations.
- Add comments only where logic is non-obvious.
- Preserve existing API route naming unless migration is planned.
