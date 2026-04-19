# PCCOE Campus Bites

Campus Bites is a full-stack campus food ordering platform built to solve real student pain points: long queues, slow ordering, and unclear payment confirmation.

It supports complete role-based workflows:
- Student: browse messes, view menu, place orders, upload payment proof, track status
- Owner: manage menu and update operational order status
- Admin: manage mess records and platform-level operations



## Core Features

- Role-based auth flows (visitor, owner, admin)
- Mess discovery, filtering, and menu browsing
- Cart and order placement workflow
- QR payment details with receipt upload
- Payment status and order history tracking
- Context-aware chatbot support across pages

## Architecture Snapshot

### Frontend
- Multi-page interface in plain HTML/CSS/JS
- Role-specific pages for student, owner, and admin operations
- Shared utility helpers for API integration and common UX behavior

### Backend
- Node.js + Express server with domain-based route modules
- Route groups: auth, mess, menu, orders, payments
- Middleware for CORS, JSON parsing, and static serving

### Database
- MySQL relational schema
- Core entities: users, mess, menu_items, orders, customers, wallet_transactions, payment_events
- Server-side order amount computation based on database prices

## Technical Highlights

- Modular REST API structure for maintainability
- Practical payment verification pipeline with proof uploads
- Deployment-aware configuration (CORS, env-based setup, persistent uploads)
- Separation of concerns between presentation, application, and data layers

## Repository Structure

- frontend/: static pages, styles, JS modules, assets
- backend/: Express server, route modules, DB config
- backend/COMPLETE_DATABASE.sql: schema + base seed
- render.yaml: Render blueprint for deployment
- DESIGN_DOCUMENT.md: software design documentation
- CONTRIBUTING.md: contribution and commit guidelines

## Screenshots

### Mess and Menu Experience

![Mess browsing preview](frontend/Hostel_Mess_small.jpg)

### QR Payment Flow

![QR payment preview](frontend/QR.jpeg)

### Food Card Visuals

![White sauce pasta card image](frontend/whitesaucepasta.jpg)
![Cold coffee card image](frontend/cold%20coffee.png)

## Local Setup

1. Install prerequisites.
- Node.js 18+
- MySQL 8+

2. Install backend dependencies.
- cd backend
- npm install

3. Configure environment.
- Copy backend/.env.example to backend/.env
- Fill database and payment values

4. Import database schema.
- Load backend/COMPLETE_DATABASE.sql into MySQL

5. Start the backend.
- cd backend
- npm start

6. Open the app.
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

Use backend/.env.example as the source template.

## Deployment (Render)

Recommended setup: one Render web service serving both frontend and API.

1. Connect repository and create service from render.yaml.
2. Use blueprint commands:
- Build: cd backend && npm install
- Start: cd backend && npm start

3. Set environment variables in Render:
- DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- BACKEND_BASE_URL (Render public URL)
- UPLOADS_DIR=/var/data/uploads

If your provider gives one MySQL connection string, set DATABASE_URL and leave DB_* empty.

4. Attach persistent disk (already declared in render.yaml).

5. Verify deployment:
- Home page at /
- API under /api
- Uploaded proofs in /var/data/uploads/payment-proofs

## API Surface (High Level)

- /api/auth: login, signup OTP, password reset
- /api/mess: mess list and details
- /api/menu: menu by mess
- /api/orders: order placement and tracking
- /api/payments: QR config, proof upload, payment status

## What I Learned

- Designing modular backend APIs around real user workflows
- Building role-based product flows from idea to deployment
- Managing environment-driven deployment concerns
- Balancing feature ambition with implementation constraints

## Improvement Roadmap

- Add bcrypt-based password hashing
- Strengthen API-level authorization controls
- Add automated tests for auth, order, and payment flows
- Add pagination and caching for scale-focused endpoints
- Expand analytics for admin and chatbot performance

## Author

Atharva Prashant Ambalge

## License

MIT (see LICENSE)
