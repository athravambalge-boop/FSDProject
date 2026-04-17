# PCCOE Campus Bites

Campus Bites is a full-stack web app for campus food ordering. It supports student browsing, order placement, owner workflows, and QR-based payment proof upload.

This project was built as an end-to-end academic product to practice real-world fundamentals:

- API design and routing with Express
- MySQL schema design and startup migrations
- multi-role frontend flows (student, owner, admin)
- deployment on Render with persistent file storage

## Key Highlights

- Full stack JavaScript project (frontend + backend)
- One deployed service that serves both static frontend and API
- Manual payment flow with screenshot verification pipeline
- Search/filter UX on menu and mess browsing
- Context-aware support chatbot across pages
- Animated mascot launcher with food-themed interaction loop

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express
- Database: MySQL (mysql2)
- File upload: multer
- OCR/image utilities (available in backend deps): tesseract.js, jimp, exif-parser
- Deployment: Render (Blueprint via render.yaml)

## Repository Structure

- frontend/: browser UI pages, styles, JS, and menu image assets
- frontend/chatbot.js: chatbot UI logic, intents mapping, and mascot behavior
- frontend/chatbot.css: chatbot and mascot styling/animations
- frontend/chatbot-intents.json: intent/rule customization for responses
- backend/: Express server, route modules, DB configuration
- backend/COMPLETE_DATABASE.sql: base schema and seed script
- render.yaml: Render blueprint config
- CONTRIBUTING.md: contribution and commit guide
- backend/.env.example: environment variable template
- DESIGN_DOCUMENT.md: design notes and planning

## Current Feature Set

- Role-based auth flows (visitor, owner, admin)
- Mess list and menu browsing
- Cart and order placement
- QR payment details + receipt upload
- Payment status tracking and history pages
- Frontend chatbot support on all pages (unless explicitly disabled)
- Page-specific quick actions and fallback intent handling
- Animated mascot launcher with periodic eating gesture

## Screenshots

### Mess And Menu Experience

![Mess browsing preview](frontend/Hostel_Mess_small.jpg)

### QR Payment Flow

![QR payment preview](frontend/QR.jpeg)

### Food Card Visuals

![White sauce pasta card image](frontend/whitesaucepasta.jpg)
![Cold coffee card image](frontend/cold%20coffee.png)

## Run Locally

1. Install prerequisites.

- Node.js 18+
- MySQL 8+

2. Install backend dependencies.

- cd backend
- npm install

3. Create local env file.

- Copy backend/.env.example to backend/.env
- Fill DB and payment values

4. Import database schema.

- Load backend/COMPLETE_DATABASE.sql in your MySQL instance

5. Start server.

- cd backend
- npm start

6. Open app.

- http://localhost:5000

## Environment Variables

Required:

- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME
- DB_PORT

Common optional:

- DB_CONNECTION_LIMIT
- PORT
- ALLOWED_ORIGINS
- BACKEND_BASE_URL
- UPLOADS_DIR
- PAYMENT_CURRENCY
- MANUAL_PAYMENT_UPI_ID
- MANUAL_PAYMENT_ACCOUNT_NAME
- MANUAL_PAYMENT_ACCOUNT_NO
- MANUAL_PAYMENT_IFSC
- MANUAL_PAYMENT_QR_IMAGE_URL

See backend/.env.example for a ready template.

## Deployment (Render)

Recommended setup is one Render web service serving both frontend and API.

1. Connect repository and create service from render.yaml.
2. Use default commands from blueprint:

- Build: cd backend && npm install
- Start: cd backend && npm start

3. Add env vars in Render dashboard:

- DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- BACKEND_BASE_URL (your Render URL)
- UPLOADS_DIR=/var/data/uploads

If your database provider gives you a single MySQL connection string, set `DATABASE_URL` and leave the individual `DB_*` fields empty.

4. Attach a persistent disk (already configured in render.yaml).

5. Deploy and verify:

- Home page at /
- API routes under /api
- Uploaded proofs saved under /var/data/uploads/payment-proofs

## API Surface (High Level)

- /api/auth: login, signup OTP, password reset
- /api/mess: mess list/details
- /api/menu: menu by mess
- /api/orders: order placement and tracking
- /api/payments: QR config, proof upload, payment status

## What I Learned Building This

- How to structure a modular Express backend
- Handling deployment-specific concerns (CORS, proxy, persistent disk)
- Trade-offs in payment verification UX vs implementation complexity
- Why project hygiene (docs, gitignore, env templates) matters for team work

## Known Gaps and Next Improvements

- Move from plaintext passwords to hashed passwords with bcrypt
- Add automated tests for critical auth/order/payment flows
- Introduce centralized validation for request payloads
- Add pagination and caching for scalable menu/order APIs
- Improve admin metrics dashboard with charts
- Add chatbot analytics (top intents, fallback rate, unresolved queries)
- Add multilingual support for chatbot prompts

## Project Hygiene

- License: MIT (see LICENSE)
- Contribution process: CONTRIBUTING.md
- Env template: backend/.env.example

## Author

Atharva Prashant Ambalge 
