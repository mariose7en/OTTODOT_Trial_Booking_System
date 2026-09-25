-- seed.sql
-- OTTODOT Trial Booking System
-- Database Schema + Seed Data + Stored Procedures
-- Based on core.md requirements

-- =====================================================
-- DROP EXISTING TABLES (in correct order)
-- =====================================================
DROP TABLE IF EXISTS payment_details CASCADE;
DROP TABLE IF EXISTS payment_headers CASCADE;
DROP TABLE IF EXISTS payment_attempts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS trial_classes CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS parents CASCADE;

-- =====================================================
-- PARENTS TABLE
-- =====================================================
CREATE TABLE parents (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    residential_id TEXT NOT NULL,
    role TEXT DEFAULT 'parent' CHECK (role IN ('parent', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_parents_email ON parents(email);
CREATE INDEX idx_parents_role ON parents(role);

-- =====================================================
-- STUDENTS TABLE
-- =====================================================
CREATE TABLE students (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES parents(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    grade TEXT,
    residential_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_students_parent ON students(parent_id);

-- =====================================================
-- CLASSES TABLE (base class definition)
-- =====================================================
CREATE TABLE classes (
    id TEXT PRIMARY KEY,
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL CHECK (subject IN ('MATH', 'SCIENCE')),
    description TEXT,
    grade_level TEXT,
    duration_minutes INT DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_classes_subject ON classes(subject);

-- =====================================================
-- TRIAL CLASSES TABLE (scheduled instances)
-- =====================================================
CREATE TABLE trial_classes (
    id TEXT PRIMARY KEY,
    class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    max_seats INT NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trial_classes_start ON trial_classes(start_time);
CREATE INDEX idx_trial_classes_class ON trial_classes(class_id);
CREATE INDEX idx_trial_classes_subject ON trial_classes(subject);

-- =====================================================
-- BOOKINGS TABLE
-- =====================================================
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    trial_class_id TEXT REFERENCES trial_classes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED', 'REFUNDED')),
    registered_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: prevent duplicate confirmed bookings
CREATE UNIQUE INDEX idx_uniq_confirmed_booking
    ON bookings(student_id, trial_class_id)
    WHERE status = 'CONFIRMED';

CREATE INDEX idx_bookings_class ON bookings(trial_class_id);
CREATE INDEX idx_bookings_student ON bookings(student_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- =====================================================
-- PAYMENT ATTEMPTS TABLE
-- =====================================================
CREATE TABLE payment_attempts (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED')),
    txn_id TEXT,
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    payment_method TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payment_attempts_booking ON payment_attempts(booking_id);

-- =====================================================
-- PAYMENT HEADERS TABLE (for email notifications)
-- =====================================================
CREATE TABLE payment_headers (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id TEXT,
    invoice_number TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    payment_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    billing_name TEXT,
    billing_email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payment_headers_booking ON payment_headers(booking_id);

-- =====================================================
-- PAYMENT DETAILS TABLE (line items for email)
-- =====================================================
CREATE TABLE payment_details (
    id TEXT PRIMARY KEY,
    payment_header_id TEXT REFERENCES payment_headers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    class_name TEXT,
    class_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payment_details_header ON payment_details(payment_header_id);

-- =====================================================
-- STORED PROCEDURE: confirm_trial_booking
-- Handles race conditions with row-level locking
-- =====================================================
CREATE OR REPLACE FUNCTION confirm_trial_booking(
    p_booking_id TEXT,
    p_payment_result TEXT
) RETURNS TEXT AS $$
DECLARE
    v_class_id TEXT;
    v_student_id TEXT;
    v_confirmed_count INT;
    v_max_seats INT;
    v_existing_booking TEXT;
BEGIN
    -- Lock booking row (prevents concurrent modifications)
    SELECT student_id, trial_class_id
    INTO v_student_id, v_class_id
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- Lock trial class row (prevents overbooking)
    SELECT max_seats
    INTO v_max_seats
    FROM trial_classes
    WHERE id = v_class_id
    FOR UPDATE;

    -- Check for existing confirmed booking (duplicate prevention)
    SELECT id INTO v_existing_booking
    FROM bookings
    WHERE student_id = v_student_id
      AND trial_class_id = v_class_id
      AND status = 'CONFIRMED'
    LIMIT 1;

    IF v_existing_booking IS NOT NULL THEN
        UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = now()
        WHERE id = p_booking_id;
        RETURN 'DUPLICATE_BOOKING';
    END IF;

    -- Count current confirmed seats
    SELECT COUNT(*) INTO v_confirmed_count
    FROM bookings
    WHERE trial_class_id = v_class_id
      AND status = 'CONFIRMED';

    -- Handle payment result
    IF p_payment_result = 'SUCCESS' THEN
        IF v_confirmed_count < v_max_seats THEN
            UPDATE bookings SET status = 'CONFIRMED', updated_at = now()
            WHERE id = p_booking_id;
            RETURN 'CONFIRMED';
        ELSE
            UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = now()
            WHERE id = p_booking_id;
            RETURN 'NO_SEATS_AVAILABLE';
        END IF;
    ELSE
        UPDATE bookings SET status = 'PAYMENT_FAILED', updated_at = now()
        WHERE id = p_booking_id;
        RETURN 'PAYMENT_FAILED';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Parents (with role for admin access)
INSERT INTO parents (id, first_name, last_name, email, residential_id, role, created_at) VALUES
    ('PAR-001', 'ALICE', 'LEE', 'alice@example.com', 'RES123', 'admin', now()),
    ('PAR-002', 'BOB', 'OLSEN', 'bob@example.com', 'RES456', 'parent', now()),
    ('PAR-003', 'CAROL', 'NG', 'carol@example.com', 'RES789', 'parent', now());

-- Students
INSERT INTO students (id, parent_id, first_name, last_name, email, grade, residential_id, created_at) VALUES
    ('STU-001', 'PAR-001', 'CHARLIE', 'LEE', 'charlie@example.com', 'P4', 'RES789', now()),
    ('STU-002', 'PAR-001', 'DAISY', 'LEE', 'daisy@example.com', 'P2', 'RES321', now()),
    ('STU-003', 'PAR-002', 'ETHAN', 'OLSEN', 'ethan@example.com', 'P5', 'RES654', now()),
    ('STU-004', 'PAR-003', 'FIONA', 'NG', 'fiona@example.com', 'P3', 'RES987', now());

-- Classes (base class definitions)
INSERT INTO classes (id, class_name, subject, description, grade_level, duration_minutes) VALUES
    ('CLS-001', 'MATH TRIAL', 'MATH', 'Introduction to Primary Math concepts', 'P1-P6', 60),
    ('CLS-002', 'SCIENCE TRIAL', 'SCIENCE', 'Hands-on Science experiments', 'P1-P6', 60),
    ('CLS-003', 'ADVANCED MATH', 'MATH', 'Advanced problem solving', 'P4-P6', 90);

-- Trial Classes (scheduled instances)
INSERT INTO trial_classes (id, class_id, class_name, subject, start_time, end_time, location, max_seats) VALUES
    ('TRC-001', 'CLS-001', 'MATH TRIAL - OCT 1', 'MATH', '2026-10-01 10:00:00+08', '2026-10-01 11:00:00+08', 'Online Zoom', 4),
    ('TRC-002', 'CLS-002', 'SCIENCE TRIAL - OCT 2', 'SCIENCE', '2026-10-02 14:00:00+08', '2026-10-02 15:00:00+08', 'Online Zoom', 4),
    ('TRC-003', 'CLS-001', 'MATH TRIAL - OCT 8', 'MATH', '2026-10-08 10:00:00+08', '2026-10-08 11:00:00+08', 'Online Zoom', 4),
    ('TRC-004', 'CLS-003', 'ADVANCED MATH - OCT 10', 'MATH', '2026-10-10 15:00:00+08', '2026-10-10 16:30:00+08', 'Online Zoom', 4);

-- Bookings (various statuses for testing)
INSERT INTO bookings (id, student_id, trial_class_id, status, registered_at) VALUES
    -- Confirmed bookings (3 of 4 seats taken for TRC-002)
    ('BKG-001', 'STU-001', 'TRC-002', 'CONFIRMED', now() - interval '3 days'),
    ('BKG-002', 'STU-002', 'TRC-002', 'CONFIRMED', now() - interval '2 days'),
    ('BKG-003', 'STU-003', 'TRC-002', 'CONFIRMED', now() - interval '1 day'),
    -- Pending payment (testing last-seat race scenario)
    ('BKG-004', 'STU-004', 'TRC-002', 'PENDING_PAYMENT', now()),
    -- Failed payment
    ('BKG-005', 'STU-001', 'TRC-001', 'PAYMENT_FAILED', now() - interval '1 day'),
    -- Confirmed for different class
    ('BKG-006', 'STU-002', 'TRC-001', 'CONFIRMED', now() - interval '5 days');

-- Payment Attempts
INSERT INTO payment_attempts (id, booking_id, status, txn_id, amount, currency, payment_method, created_at) VALUES
    ('PAY-001', 'BKG-005', 'FAILED', 'TXN-FAIL-001', 20.00, 'USD', 'credit_card', now() - interval '1 day'),
    ('PAY-002', 'BKG-001', 'SUCCESS', 'TXN-SUCCESS-001', 20.00, 'USD', 'credit_card', now() - interval '3 days'),
    ('PAY-003', 'BKG-002', 'SUCCESS', 'TXN-SUCCESS-002', 20.00, 'USD', 'credit_card', now() - interval '2 days'),
    ('PAY-004', 'BKG-003', 'SUCCESS', 'TXN-SUCCESS-003', 20.00, 'USD', 'credit_card', now() - interval '1 day');

-- Payment Headers (for email notifications)
INSERT INTO payment_headers (id, booking_id, payment_id, invoice_number, total_amount, currency, status, payment_date, billing_name, billing_email, created_at) VALUES
    ('PHD-001', 'BKG-001', 'PAY-002', 'INV-2026-001', 20.00, 'USD', 'COMPLETED', now() - interval '3 days', 'ALICE LEE', 'alice@example.com', now() - interval '3 days'),
    ('PHD-002', 'BKG-002', 'PAY-003', 'INV-2026-002', 20.00, 'USD', 'COMPLETED', now() - interval '2 days', 'ALICE LEE', 'alice@example.com', now() - interval '2 days'),
    ('PHD-003', 'BKG-003', 'PAY-004', 'INV-2026-003', 20.00, 'USD', 'COMPLETED', now() - interval '1 day', 'BOB OLSEN', 'bob@example.com', now() - interval '1 day'),
    ('PHD-004', 'BKG-005', 'PAY-001', 'INV-2026-004', 20.00, 'USD', 'FAILED', now() - interval '1 day', 'ALICE LEE', 'alice@example.com', now() - interval '1 day');

-- Payment Details (line items for email)
INSERT INTO payment_details (id, payment_header_id, description, quantity, unit_price, total_price, class_name, class_date) VALUES
    ('PDT-001', 'PHD-001', 'Trial Class: SCIENCE TRIAL - OCT 2', 1, 20.00, 20.00, 'SCIENCE TRIAL - OCT 2', '2026-10-02 14:00:00+08'),
    ('PDT-002', 'PHD-002', 'Trial Class: SCIENCE TRIAL - OCT 2', 1, 20.00, 20.00, 'SCIENCE TRIAL - OCT 2', '2026-10-02 14:00:00+08'),
    ('PDT-003', 'PHD-003', 'Trial Class: SCIENCE TRIAL - OCT 2', 1, 20.00, 20.00, 'SCIENCE TRIAL - OCT 2', '2026-10-02 14:00:00+08'),
    ('PDT-004', 'PHD-004', 'Trial Class: MATH TRIAL - OCT 1', 1, 20.00, 20.00, 'MATH TRIAL - OCT 1', '2026-10-01 10:00:00+08');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check seat availability for TRC-002 (should show 1 seat remaining)
-- SELECT tc.id, tc.class_name, tc.max_seats,
--        COUNT(b.id) as confirmed_bookings,
--        tc.max_seats - COUNT(b.id) as seats_remaining
-- FROM trial_classes tc
-- LEFT JOIN bookings b ON b.trial_class_id = tc.id AND b.status = 'CONFIRMED'
-- WHERE tc.id = 'TRC-002'
-- GROUP BY tc.id, tc.class_name, tc.max_seats;

-- Check booking status flow
-- SELECT b.id, b.status, pa.status as payment_status, pa.txn_id
-- FROM bookings b
-- LEFT JOIN payment_attempts pa ON pa.booking_id = b.id
-- ORDER BY b.registered_at DESC;
