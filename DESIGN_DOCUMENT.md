# Pccoe Campus Bites - Software Design Document

Version: 1.0  
Date: 2026-04-06  
Project Type: Full Stack Web Application

## 1. Overview

Pccoe Campus Bites is a campus-focused food ordering platform for students and mess owners.

The system supports:
- Visitor onboarding and login
- Browsing and filtering mess listings
- Viewing menu items and placing orders
- Online and cash payment flows
- Wallet cashback and transaction tracking
- Owner dashboard for menu and order management
- Admin dashboard for mess lifecycle management

The solution is split into:
- Static frontend pages with browser-side JavaScript
- Node.js + Express backend REST APIs
- MySQL relational database

## 2. Scope and Objectives

### 2.1 In Scope
- Student/visitor ordering journey from discovery to order tracking
- Owner operations for menu availability and order status updates
- Admin operations for creating, updating, and deleting mess entries
- Payment gateway integration (PhonePe and Razorpay)
- Wallet and cashback bookkeeping

### 2.2 Out of Scope (Current Version)
- Native mobile applications
- Real-time push notifications (WebSocket-based)
- Dedicated authentication provider (OAuth/SSO)
- Automated CI/CD pipeline definition

## 3. Software Engineering Lifecycle (SDLC)

This project follows a practical iterative lifecycle. Each phase is listed below with project-specific outputs.

### 3.1 Planning and Feasibility
- Problem identified: long queues, payment friction, and unclear pickup flow in campus mess operations
- Feasibility considered: web-first platform using static frontend + Node.js backend + MySQL
- Initial constraints: low infrastructure cost, simple browser access for students and owners

### 3.2 Requirements Analysis
- Functional requirements captured:
  - Role-based user journeys (visitor, owner, admin)
  - Mess browsing, filtering, and menu visibility
  - Order placement, status tracking, and owner fulfillment updates
  - Cash and online payment support with verification/webhooks
  - Wallet and cashback bookkeeping
- Non-functional requirements captured:
  - Usability for campus users
  - Data consistency for orders/payments
  - Maintainability via modular routes and schema clarity

### 3.3 System Design
- Architecture design: layered client-server model
- Data design: relational schema for users, messes, menu, orders, wallet, and payment events
- API design: REST endpoints grouped by domain (auth, mess, menu, orders, payments)
- UI design: separate pages for student, owner, and admin workflows

### 3.4 Implementation (Development)
- Frontend implementation in HTML/CSS/JS modules
- Backend implementation in Express route modules
- Database implementation through SQL schema and startup compatibility checks
- Payment provider integration for PhonePe/Razorpay

### 3.5 Testing and Validation
- Validation present in critical flows (OTP, phone format, item quantity, order integrity)
- Transactional safety for order and wallet operations
- Recommended expanded strategy: unit, integration, and end-to-end automation

### 3.6 Deployment
- Backend deployed as Node service with environment-based configuration
- Frontend deployed as static site
- MySQL schema bootstrapped using COMPLETE_DATABASE.sql

### 3.7 Operations and Maintenance
- Ongoing activities:
  - Monitoring payment/order edge cases
  - Updating schema safely as features evolve
  - Security hardening (auth and password handling improvements)
  - Performance tuning and analytics enhancements

## 4. Stakeholders and User Roles

- Visitor/Student: discovers messes, places orders, tracks order status, uses wallet
- Mess Owner: manages menu items and operational order flow
- Admin: manages mess listings and catalog integrity
- System Administrator: deploys backend, configures DB, and manages environment variables

## 5. System Context and High-Level Architecture

### 5.1 Architectural Style
A layered client-server architecture with role-based UI and REST APIs:
- Presentation Layer: static HTML/CSS/JS pages in frontend
- Application Layer: Express route modules in backend/routes
- Data Layer: MySQL schema in backend/COMPLETE_DATABASE.sql
- Integration Layer: payment gateways and webhook handling

### 5.2 High-Level Component View

1. Frontend Module
- Multi-page app for landing, login, student browsing, ordering, owner/admin dashboards
- Local session persistence using browser localStorage
- API integration through a shared utility helper

2. Backend API Module
- Entry point in server.js
- Route groups: auth, mess, menu, orders, payments
- CORS and JSON middleware
- Startup schema safeguards for evolving columns/tables

3. Persistence Module
- MySQL connection pooling
- Core entities for users, messes, menu items, orders, wallet, payment logs, and favorites

4. Payment Module
- Creates external payment orders
- Verifies payments and records payment events
- Processes PhonePe and Razorpay webhooks

## 6. Detailed Module Design

### 6.1 Frontend Design

Main frontend concerns:
- Session bootstrap and role redirect logic
- Mess search/filter UX and card rendering
- Owner dashboard for menu CRUD + status toggling
- Admin dashboard for mess CRUD
- Common utilities:
  - API base URL selection for local/deployed mode
  - Toast and loading indicators
  - Session save/retrieval helpers
  - Date/currency formatting

Important UI entry points:
- landing.html: public project introduction and CTA
- index.html + script.js: student mess discovery page
- mess.html + menu.js: menu selection and order placement
- owner.html + owner.js: owner operations
- admin.html + admin.js: admin operations

### 6.2 Backend Design

Backend initialization responsibilities:
- Load environment variables
- Build and enforce allowed CORS origins
- Register route modules under /api/*
- Ensure schema compatibility at startup for wallet/payment/auth additions

Route-level responsibilities:
- authRoutes.js:
  - Username/password login
  - OTP request and OTP verification for visitor account creation
- messRoutes.js:
  - Mess listing with filters
  - Favorites add/remove
  - Today menu retrieval and update
  - Admin mess creation/update/deletion
- menuRoutes.js:
  - Item listing by mess
  - Owner item create/delete
  - Availability toggling
- orderRoutes.js:
  - Validated order placement
  - Wallet debit and cashback credit ledger entries
  - Customer order history and profile retrieval
  - Owner order status updates and overview stats
- paymentRoutes.js:
  - Provider order creation
  - Payment verification
  - PhonePe and Razorpay webhook processing
  - Payment status query by order

## 7. Data Design

### 7.1 Database Technology
- MySQL 8+ using mysql2 pool with promise interface

### 7.2 Core Entities

- users: auth credentials and role (admin/owner/visitor)
- mess: mess metadata, price, type, contact, rating
- menu_items: per-mess catalog items and availability
- orders: order payload, amounts, lifecycle status, payment state
- customers: profile, aggregate order stats, wallet balance
- wallet_transactions: immutable credit/debit ledger
- payment_events: payment gateway event history/audit
- favorites: customer-mess preference mapping
- promos: promo/discount definitions (future/partial use)
- reviews: ratings and comments (future/partial use)
- visitor_otps: short-lived OTP verification records

### 7.3 Data Integrity Principles
- Foreign keys for mess and order relationships
- Server-side order amount computed from DB prices, not client values
- Transaction usage for order + wallet consistency
- Indexed columns for common retrieval patterns (status, phone, timestamps)

## 8. API Design Summary

Base path: /api

- Auth APIs: /auth/*
- Mess APIs: /mess/*
- Menu APIs: /menu/*
- Order APIs: /orders/*
- Payment APIs: /payments/*

Design conventions:
- JSON request/response payloads
- HTTP status codes for validation and processing outcomes
- Server-side validation for phone/name/items/order identifiers

## 9. Core Workflows

### 9.1 Visitor Signup with OTP
1. Client submits full name + contact type/value.
2. Backend validates identity format and uniqueness.
3. OTP is generated and stored in visitor_otps with expiry.
4. Client submits OTP for verification.
5. Backend creates visitor user and customer profile record.

### 9.2 Order Placement with Wallet
1. Client sends selected mess and item quantities.
2. Backend validates item availability and fetches trusted prices.
3. Backend computes amount, optional wallet usage, cashback value.
4. Backend inserts order and wallet transactions in a DB transaction.
5. Backend returns order identifier and financial summary.

### 9.3 Online Payment
1. Client calls create-order for payment provider order.
2. Backend stores payment_order_id and pending payment status.
3. Gateway redirect/SDK flow is completed by user.
4. Verify endpoint or webhook updates order payment state.
5. Payment event audit row is inserted/updated.

### 9.4 Owner Order Operations
1. Owner fetches orders by mess and optional status.
2. Owner updates order state (pending -> preparing -> ready -> completed or cancelled).
3. Dashboard stats endpoint reflects updated operational totals.

## 10. Security and Privacy Considerations

Current protections:
- Input validation for critical fields (phone, OTP, order items)
- CORS allow-list based access control
- Payment webhook signature verification paths (provider specific)

Identified security gaps (recommended improvements):
- Plain-text password handling should be replaced with hashed passwords (bcrypt)
- Role-based authorization should be enforced server-side (currently mostly UI/localStorage driven)
- JWT/session-based authentication should be introduced for API access control
- Sensitive defaults (DB credentials, sample IDs/secrets) should be removed from code and SQL scripts

## 11. Non-Functional Design

### 11.1 Performance
- Connection pooling for DB efficiency
- Indexed query paths for frequent reads
- Server-side filtering and pagination candidates for future scaling

### 11.2 Reliability
- Try/catch guards in route handlers
- Transaction boundaries for financial consistency
- Startup schema checks reduce migration drift issues

### 11.3 Maintainability
- Route modularization by business domain
- Shared frontend utility functions
- Explicit SQL schema as source of truth

## 12. Deployment and Configuration Design

### 12.1 Runtime Dependencies
- Node.js 18+
- MySQL 8+
- npm dependencies: express, mysql2, cors, dotenv, axios, razorpay

### 12.2 Environment Configuration
Key backend variables include:
- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- PORT, ALLOWED_ORIGINS
- PAYMENT_PROVIDER, PAYMENT_CURRENCY
- PHONEPE_* and/or RAZORPAY_* keys
- APP_BASE_URL, BACKEND_BASE_URL

### 12.3 Deployment Topology
- Frontend: static hosting (local static server or GitHub Pages style hosting)
- Backend: Node runtime on cloud VM/PaaS
- Database: managed or self-hosted MySQL instance

## 13. Testing Strategy (Recommended)

- Unit tests:
  - Validation helpers and amount/wallet calculations
- Integration tests:
  - Auth OTP flow, order placement, and payment verification routes
- End-to-end tests:
  - Student order flow and owner fulfillment workflow
- Regression checks:
  - Schema compatibility checks when startup migration logic changes

## 14. Known Risks and Mitigations

- Risk: localStorage-based role checks are tamper-prone  
  Mitigation: enforce server-authenticated role checks

- Risk: payment edge cases (timeouts, duplicate callbacks)  
  Mitigation: idempotency checks and event deduplication by payment_order_id/payment_id

- Risk: growth in orders can impact query latency  
  Mitigation: add pagination, archival strategy, and additional indexes

## 15. Future Enhancements

- Token-based authentication and protected route middleware
- Password hashing migration and user reset flows
- Promo and review full feature implementation
- Better analytics dashboard and operational metrics
- Notification module (SMS/email) for order status changes
- CI/CD with automated test gates

## 16. Conclusion

The current design is a practical MVP architecture that cleanly separates frontend, API, and data layers while supporting the core campus ordering lifecycle. The project is production-leaning in feature coverage (wallet, payments, owner/admin workflows) and should prioritize authentication hardening and automated testing as the next major design evolution steps.
