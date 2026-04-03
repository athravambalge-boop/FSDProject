# Pccoe Campus Bites

Pccoe Campus Bites is a campus food ordering platform for students and mess owners at PCCOE. The repository contains a static frontend and a Node.js backend that connects to MySQL, handles authentication, menu and mess data, orders, and payments.

## Project Structure

- `frontend/` - Static pages, styles, and browser-side JavaScript
- `backend/` - Express API, MySQL connection, and route handlers
- `backend/COMPLETE_DATABASE.sql` - Database schema and seed data

## Prerequisites

- Node.js 18 or newer
- MySQL 8 or compatible database
- A code editor or static file server for the frontend

## Setup

1. Install backend dependencies.

   ```bash
   cd backend
   npm install
   ```

2. Create a backend `.env` file.

   Use `backend/.env.example` as the template and provide your local database and payment values.

3. Import the database schema.

   Load `backend/COMPLETE_DATABASE.sql` into your MySQL instance before starting the server.

4. Start the backend.

   ```bash
   cd backend
   npm start
   ```

   The server runs on port `5000` by default.

5. Open the frontend.

   Use a local static server or open the frontend pages through your preferred development setup.

## Environment Variables

The backend expects MySQL settings such as `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Payment-related values for PhonePe and optional Razorpay settings are also supported through `backend/.env.example`.

## Notes

- The backend initializes and updates parts of the schema on startup.
- CORS is configured for common local development origins and the deployed GitHub Pages origin.
- The root of the app is a static landing page that links into the student and owner flows.
