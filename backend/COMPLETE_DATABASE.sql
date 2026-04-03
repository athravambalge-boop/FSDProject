-- ============================================================
-- MESSMATE DATABASE - COMPLETE SETUP SCRIPT
-- Full schema with all tables and relationships
-- ============================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS messmate_db;
USE messmate_db;

-- ============================================================
-- 1. USERS TABLE (For authentication - admin/owner/visitor)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150),
    role ENUM('admin', 'owner', 'visitor') DEFAULT 'visitor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_users_phone (phone),
    INDEX idx_users_email (email),
    INDEX idx_role (role)
);

-- ============================================================
-- 2. MESS TABLE (For mess listings)
-- ============================================================
CREATE TABLE IF NOT EXISTS mess (
    mess_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location VARCHAR(200) NOT NULL,
    monthly_price DECIMAL(10, 2) NOT NULL,
    veg_type ENUM('Veg', 'Non-Veg', 'Mixed') NOT NULL,
    contact_number VARCHAR(20),
    rating DECIMAL(3, 1) DEFAULT 0,
    owner_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(user_id),
    INDEX idx_name (name),
    INDEX idx_location (location),
    INDEX idx_rating (rating)
);

-- ============================================================
-- 3. MENU_ITEMS TABLE (For food menu)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    mess_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (mess_id) REFERENCES mess(mess_id) ON DELETE CASCADE,
    INDEX idx_mess_id (mess_id),
    INDEX idx_category (category)
);

-- ============================================================
-- 4. ORDERS TABLE (For order tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    mess_id INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100),
    items JSON NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    wallet_used DECIMAL(10, 2) DEFAULT 0,
    cashback_earned DECIMAL(10, 2) DEFAULT 0,
    status ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('cash', 'online') DEFAULT 'cash',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_provider VARCHAR(50),
    payment_order_id VARCHAR(100),
    payment_id VARCHAR(100),
    payment_signature VARCHAR(255),
    paid_at DATETIME,
    refunded_at DATETIME,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (mess_id) REFERENCES mess(mess_id),
    INDEX idx_mess_id (mess_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_phone (customer_phone),
    INDEX idx_payment_status (payment_status),
    INDEX idx_payment_order_id (payment_order_id)
);

-- ============================================================
-- 5. CUSTOMERS TABLE (For customer profiles & history)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    wallet_balance DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
);

-- ============================================================
-- 6. WALLET_TRANSACTIONS TABLE (For wallet credits/debits)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_phone VARCHAR(20) NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reference_order_id INT,
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet_customer_phone (customer_phone),
    INDEX idx_wallet_created_at (created_at)
);

-- ============================================================
-- 7. PAYMENT_EVENTS TABLE (For gateway event logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_order_id VARCHAR(100),
    payment_id VARCHAR(100),
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    gateway_payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_payment_events_order_id (order_id),
    INDEX idx_payment_events_payment_id (payment_id)
);

-- ============================================================
-- 8. FAVORITES TABLE (For saved messes)
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
    favorite_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_phone VARCHAR(20) NOT NULL,
    mess_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mess_id) REFERENCES mess(mess_id) ON DELETE CASCADE,
    UNIQUE KEY unique_favorite (customer_phone, mess_id),
    INDEX idx_phone (customer_phone)
);

-- ============================================================
-- 9. PROMOS TABLE (For discount codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS promos (
    promo_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent INT DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_uses INT,
    used_count INT DEFAULT 0,
    valid_from DATETIME,
    valid_until DATETIME,
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_active (active)
);

-- ============================================================
-- 10. REVIEWS TABLE (For ratings & feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    mess_id INT NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mess_id) REFERENCES mess(mess_id) ON DELETE CASCADE,
    INDEX idx_mess_id (mess_id),
    INDEX idx_rating (rating)
);

-- ============================================================
-- 11. VISITOR_OTPS TABLE (For OTP-based visitor signup)
-- ============================================================
CREATE TABLE IF NOT EXISTS visitor_otps (
    otp_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    identifier VARCHAR(150) NOT NULL,
    contact_type ENUM('phone', 'email') NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_visitor_otps_identifier (identifier),
    INDEX idx_visitor_otps_contact_type (contact_type),
    INDEX idx_visitor_otps_expires_at (expires_at)
);

-- ============================================================
-- INSERT SAMPLE DATA
-- ============================================================

-- Insert admin user
INSERT INTO users (username, password, phone, role) VALUES 
('admin', 'admin123', '9999999999', 'admin');

-- Insert sample messes
INSERT INTO mess (name, location, monthly_price, veg_type, contact_number, rating, owner_id) VALUES 
('Golden Mess', 'Near Station', 3000, 'Mixed', '9876543210', 4.5, NULL),
('Pure Veg Mess', 'City Center', 2500, 'Veg', '9876543211', 4.2, NULL),
('Non-Veg Paradise', 'Market Area', 3500, 'Non-Veg', '9876543212', 4.8, NULL);

-- Insert sample menu items
INSERT INTO menu_items (mess_id, item_name, item_price, category, description) VALUES 
(1, 'Chicken Biryani', 150, 'Main Course', 'Fragrant basmati rice with chicken'),
(1, 'Paneer Butter Masala', 120, 'Curry', 'Creamy paneer in tomato gravy'),
(1, 'Dal Makhani', 80, 'Curry', 'Creamed lentils cooked overnight'),
(2, 'Aloo Gobi', 60, 'Curry', 'Potato and cauliflower dry curry'),
(2, 'Chana Masala', 70, 'Curry', 'Spiced chickpea curry'),
(3, 'Mutton Curry', 200, 'Main Course', 'Tender mutton in rich gravy'),
(3, 'Fish Fry', 180, 'Main Course', 'Crispy fried fish pieces');

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT '✅ Complete database setup successfully!' as Result;

-- ============================================================
-- VERIFY ALL TABLES
-- ============================================================
SHOW TABLES;
DESCRIBE users;
DESCRIBE mess;
DESCRIBE menu_items;
DESCRIBE orders;
DESCRIBE customers;
DESCRIBE wallet_transactions;
DESCRIBE payment_events;
DESCRIBE favorites;
DESCRIBE promos;
DESCRIBE reviews;
DESCRIBE visitor_otps;
