# Pccoe Campus Bites

Pccoe Campus Bites is a campus food ordering platform for students and mess owners at PCCOE. The app uses a static frontend and a Node.js backend that connects to MySQL, handles authentication, menu and mess data, orders, and payment proof upload.

## Project Structure

- `frontend/` - Static pages, styles, and browser-side JavaScript
- `backend/` - Express API, MySQL connection, and route handlers
- `backend/COMPLETE_DATABASE.sql` - Database schema and seed data
- `render.yaml` - Render deployment blueprint

## Features

- Student and owner authentication
- Mess and menu browsing
- Order placement and order history
- QR-based payment flow with receipt screenshot upload
- Payment status tracking and proof verification
- Chatbot help for ordering and payment questions

## Prerequisites

- Node.js 18 or newer
- MySQL 8 or compatible database
- A browser for the frontend

## Local Setup

1. Install backend dependencies.

   ```bash
   cd backend
   npm install
   ```

2. Create `backend/.env` with your database and payment values.

   The backend reads MySQL settings from environment variables. A minimal local setup is:

   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=messmate_db
   DB_PORT=3306
   ```

   Optional payment and deployment variables are listed below.

3. Import the database schema.

   Load `backend/COMPLETE_DATABASE.sql` into your MySQL instance before starting the server.

4. Start the backend.

   ```bash
   cd backend
   npm start
   ```

   The server runs on port `5000` by default and serves the frontend from the same app.

5. Open the app in a browser.

   Visit `http://localhost:5000/` after the backend starts.

## Payment Flow

The current payment flow uses a manual QR-based process rather than a live gateway integration.

- The backend returns the QR payment details from `/api/payments/receipt-config`.
- Users scan the QR, pay the shown amount, and upload a receipt screenshot.
- Uploaded proof is stored under `backend/uploads/payment-proofs/` and the order is marked paid after successful verification.

The default QR image is `frontend/QR.jpeg`. Keep that file in place or override the image URL with `MANUAL_PAYMENT_QR_IMAGE_URL`.

## Environment Variables

The backend supports the following variables:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` - MySQL connection
- `DB_CONNECTION_LIMIT` - Optional MySQL pool size
- `PORT` - Server port
- `ALLOWED_ORIGINS` - Extra comma-separated origins for CORS
- `BACKEND_BASE_URL` - Public backend URL used when building uploaded proof links
- `PAYMENT_CURRENCY` - Payment currency, default `INR`
- `MANUAL_PAYMENT_UPI_ID` - UPI ID shown in the QR payment payload
- `MANUAL_PAYMENT_ACCOUNT_NAME` - Account name shown in the QR payment payload
- `MANUAL_PAYMENT_ACCOUNT_NO` - Account number shown in the QR payment payload
- `MANUAL_PAYMENT_IFSC` - IFSC shown in the QR payment payload
- `MANUAL_PAYMENT_QR_IMAGE_URL` - QR image path or URL, default `QR.jpeg`

Legacy PhonePe variable names are still mapped for compatibility, but the active flow does not require a gateway setup.

## Deploying To Render

The recommended Render setup is one Node.js web service that serves both the API and the frontend from the same domain.

1. Connect the repository to Render as a Web Service.

2. Use these commands:

   - Build: `cd backend && npm install`
   - Start: `cd backend && npm start`

3. Add the required environment variables in Render.

   Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT`. Add `ALLOWED_ORIGINS` only if you plan to use another frontend origin.

4. Point the app to an external MySQL host.

   Render does not provide a managed MySQL service, so use an external MySQL instance and copy its credentials into the web service environment.

5. Open the Render service URL.

   The backend serves the frontend from `/`, so the same Render URL loads the app and exposes the API under `/api`.

## Notes

- The backend initializes and updates parts of the schema on startup.
- CORS is configured for local development and the deployed frontend origin.
- `backend/uploads/payment-proofs/` is used for uploaded payment screenshots.
