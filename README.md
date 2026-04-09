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

## Deploying To Render

The simplest Render setup is a single Node.js web service that serves both the API and the static frontend from the same domain.

1. Create a MySQL database that Render can reach.

   Render does not provide MySQL as a built-in managed database, so use an external MySQL host and copy its credentials into the Render service environment.

2. Deploy the backend as a Render Web Service.

   Use `backend/` as the root directory, `npm install` as the build command, and `npm start` as the start command.

3. Add these environment variables in Render.

   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT` are required. You can also set `ALLOWED_ORIGINS` if you plan to use an additional frontend domain.

4. Open the Render service URL.

   The backend now serves the frontend from `/`, so the same Render URL will load the site and the API will be available under `/api`.

5. If you keep a separate static frontend anywhere else, set the browser API origin to the Render backend URL.

   The frontend will default to the current site origin when it is served by the backend, but you can still override it through the browser prompt or `localStorage` if needed.

## Render Blueprint

The repository includes a `render.yaml` blueprint for the backend service.

## Environment Variables

The backend expects MySQL settings such as `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Payment-related values for PhonePe and optional Razorpay settings are also supported through `backend/.env.example`.

## Notes

- The backend initializes and updates parts of the schema on startup.
- CORS is configured for common local development origins and the deployed GitHub Pages origin.
- The root of the app is a static landing page that links into the student and owner flows.
