-- ============================================================
-- HISAB KITAB — Database Schema
-- Multi-tenant restaurant billing & khata system
-- Every business-data table carries restaurant_id for isolation
-- ============================================================

CREATE DATABASE IF NOT EXISTS hisab_kitab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hisab_kitab;

-- ------------------------------------------------------------
-- restaurants: one row per paying tenant (the "owner" account)
-- ------------------------------------------------------------
CREATE TABLE restaurants (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  owner_name    VARCHAR(100) NOT NULL,
  phone         VARCHAR(15)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  plan          ENUM('trial','basic','pro') NOT NULL DEFAULT 'trial',
  plan_expiry   DATE NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- staff: waiters / cashiers under a restaurant, PIN-based login
-- (owner himself can also operate without a staff row)
-- ------------------------------------------------------------
CREATE TABLE staff (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(15)  NULL,
  pin_hash      VARCHAR(255) NOT NULL,
  role          ENUM('owner','cashier','waiter') NOT NULL DEFAULT 'waiter',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_staff_restaurant (restaurant_id)
);

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
CREATE TABLE menu_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  category      VARCHAR(60) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_menu_restaurant (restaurant_id)
);

-- ------------------------------------------------------------
-- orders: one row per table/customer order (the digital register line)
-- ------------------------------------------------------------
CREATE TABLE orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id   INT NOT NULL,
  table_no        VARCHAR(20) NULL,
  customer_name   VARCHAR(100) NULL,
  customer_phone  VARCHAR(15) NULL,
  status          ENUM('open','billed','cancelled') NOT NULL DEFAULT 'open',
  payment_status  ENUM('unpaid','paid','partial','credit') NOT NULL DEFAULT 'unpaid',
  payment_mode    ENUM('cash','upi','credit','split') NULL,
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by      INT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  billed_at       TIMESTAMP NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_orders_restaurant_date (restaurant_id, created_at)
);

-- ------------------------------------------------------------
-- order_items: line items, price/name snapshotted at order time
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  menu_item_id  INT NULL,
  item_name     VARCHAR(120) NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  qty           INT NOT NULL DEFAULT 1,
  line_total    DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
);

-- ------------------------------------------------------------
-- payments: every cash/UPI/credit movement against an order
-- ------------------------------------------------------------
CREATE TABLE payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  order_id      INT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  mode          ENUM('cash','upi','credit_given','credit_settled') NOT NULL,
  note          VARCHAR(255) NULL,
  paid_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_payments_restaurant_date (restaurant_id, paid_at)
);

-- ------------------------------------------------------------
-- khata: running credit balance per regular customer
-- ------------------------------------------------------------
CREATE TABLE khata (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id   INT NOT NULL,
  customer_name   VARCHAR(100) NOT NULL,
  customer_phone  VARCHAR(15) NOT NULL,
  balance         DECIMAL(10,2) NOT NULL DEFAULT 0, -- positive = customer owes restaurant
  last_updated    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_restaurant_phone (restaurant_id, customer_phone)
);

-- ------------------------------------------------------------
-- expenses: daily kharcha log
-- ------------------------------------------------------------
CREATE TABLE expenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  category      VARCHAR(60) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  note          VARCHAR(255) NULL,
  expense_date  DATE NOT NULL,
  created_by    INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_expenses_restaurant_date (restaurant_id, expense_date)
);
