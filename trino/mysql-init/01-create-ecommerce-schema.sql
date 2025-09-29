-- Create ecommerce database schema for MySQL catalog

USE ecommerce;

-- User authentication and profiles
CREATE TABLE user_accounts (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender ENUM('M', 'F', 'Other'),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    account_status ENUM('Active', 'Suspended', 'Deleted') DEFAULT 'Active',
    email_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    bio TEXT,
    profile_picture_url VARCHAR(500),
    preferences JSON,
    newsletter_subscription BOOLEAN DEFAULT TRUE,
    privacy_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
);

-- Shopping and cart management
CREATE TABLE shopping_carts (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cart_status ENUM('Active', 'Abandoned', 'Converted') DEFAULT 'Active',
    total_items INT DEFAULT 0,
    estimated_total DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT,
    product_sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES shopping_carts(cart_id) ON DELETE CASCADE
);

-- Product reviews and ratings
CREATE TABLE product_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_sku VARCHAR(50) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(200),
    review_text TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_votes INT DEFAULT 0,
    total_votes INT DEFAULT 0,
    review_status ENUM('Published', 'Pending', 'Rejected') DEFAULT 'Pending',
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
);

-- Wishlist and favorites
CREATE TABLE wishlists (
    wishlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    wishlist_name VARCHAR(100) DEFAULT 'My Wishlist',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
);

CREATE TABLE wishlist_items (
    wishlist_item_id INT AUTO_INCREMENT PRIMARY KEY,
    wishlist_id INT,
    product_sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    notes TEXT,
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(wishlist_id) ON DELETE CASCADE
);

-- Customer support and tickets
CREATE TABLE support_tickets (
    ticket_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('Order Issue', 'Product Question', 'Technical Support', 'Billing', 'Other') NOT NULL,
    priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
    status ENUM('Open', 'In Progress', 'Resolved', 'Closed') DEFAULT 'Open',
    assigned_agent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO user_accounts (username, email, password_hash, first_name, last_name, phone, gender, email_verified) VALUES
('johndoe', 'john.doe@example.com', 'hashed_password_1', 'John', 'Doe', '555-0201', 'M', TRUE),
('janesmth', 'jane.smith@example.com', 'hashed_password_2', 'Jane', 'Smith', '555-0202', 'F', TRUE),
('mikejones', 'mike.jones@example.com', 'hashed_password_3', 'Mike', 'Jones', '555-0203', 'M', FALSE),
('sarahwilson', 'sarah.wilson@example.com', 'hashed_password_4', 'Sarah', 'Wilson', '555-0204', 'F', TRUE),
('alexbrown', 'alex.brown@example.com', 'hashed_password_5', 'Alex', 'Brown', '555-0205', 'Other', TRUE);

INSERT INTO user_profiles (user_id, bio, newsletter_subscription) VALUES
(1, 'Tech enthusiast and gadget lover', TRUE),
(2, 'Fashion blogger and style consultant', TRUE),
(3, 'Outdoor adventure seeker', FALSE),
(4, 'Home chef and cooking enthusiast', TRUE),
(5, 'Fitness trainer and wellness coach', TRUE);

INSERT INTO shopping_carts (user_id, cart_status, total_items, estimated_total) VALUES
(1, 'Active', 3, 299.97),
(2, 'Abandoned', 1, 149.99),
(3, 'Active', 2, 189.98),
(4, 'Converted', 0, 0.00),
(5, 'Active', 1, 79.99);

INSERT INTO cart_items (cart_id, product_sku, product_name, quantity, unit_price, total_price) VALUES
(1, 'TECH-001', 'Wireless Bluetooth Headphones', 1, 149.99, 149.99),
(1, 'TECH-002', 'Smartphone Case', 2, 29.99, 59.98),
(1, 'TECH-003', 'Phone Charger', 3, 29.99, 89.97),
(2, 'FASH-001', 'Designer Handbag', 1, 149.99, 149.99),
(3, 'OUT-001', 'Hiking Backpack', 1, 79.99, 79.99),
(3, 'OUT-002', 'Water Bottle', 1, 24.99, 24.99),
(5, 'FIT-001', 'Yoga Mat', 1, 79.99, 79.99);

INSERT INTO product_reviews (user_id, product_sku, rating, review_title, review_text, verified_purchase) VALUES
(1, 'TECH-001', 5, 'Amazing sound quality!', 'These headphones exceeded my expectations. Great bass and crystal clear highs.', TRUE),
(2, 'FASH-001', 4, 'Beautiful bag, good quality', 'Love the design and craftsmanship. Only wish it had more pockets.', TRUE),
(3, 'OUT-001', 5, 'Perfect for hiking', 'Used this on a 3-day hiking trip. Comfortable and spacious.', TRUE),
(4, 'TECH-002', 3, 'Decent protection', 'Does the job but feels a bit flimsy. Good for the price though.', FALSE),
(5, 'FIT-001', 5, 'Best yoga mat ever!', 'Great grip and cushioning. Perfect thickness for all poses.', TRUE);

INSERT INTO wishlists (user_id, wishlist_name, is_public) VALUES
(1, 'Tech Gadgets', FALSE),
(2, 'Fashion Favorites', TRUE),
(3, 'Adventure Gear', FALSE),
(4, 'Kitchen Essentials', FALSE),
(5, 'Fitness Equipment', TRUE);

INSERT INTO wishlist_items (wishlist_id, product_sku, product_name, priority) VALUES
(1, 'TECH-004', 'Gaming Laptop', 'High'),
(1, 'TECH-005', 'Mechanical Keyboard', 'Medium'),
(2, 'FASH-002', 'Designer Shoes', 'High'),
(3, 'OUT-003', 'Camping Tent', 'Medium'),
(4, 'COOK-001', 'Stand Mixer', 'Low'),
(5, 'FIT-002', 'Dumbbells Set', 'High');

INSERT INTO support_tickets (user_id, ticket_number, subject, description, category, priority, status) VALUES
(1, 'TKT-2024-001', 'Order not received', 'I placed an order 5 days ago but haven\'t received it yet.', 'Order Issue', 'Medium', 'In Progress'),
(2, 'TKT-2024-002', 'Product size question', 'What are the dimensions of the Designer Handbag?', 'Product Question', 'Low', 'Resolved'),
(3, 'TKT-2024-003', 'Website login issue', 'Cannot log into my account, password reset not working.', 'Technical Support', 'High', 'Open'),
(4, 'TKT-2024-004', 'Billing discrepancy', 'Charged twice for the same order.', 'Billing', 'High', 'Open'),
(5, 'TKT-2024-005', 'Return request', 'Want to return the yoga mat, not the right color.', 'Order Issue', 'Medium', 'Resolved');
