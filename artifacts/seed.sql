-- seed.sql
-- Trial Booking System with Smart IDs (uppercase), Timestamps, Indexes, Stored Procedures

DROP TABLE IF EXISTS payment_attempts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS parents CASCADE;
DROP TABLE IF EXISTS trial_classes CASCADE;

---------------------------------------------------
-- Parents
---------------------------------------------------
CREATE TABLE parents (
    id TEXT PRIMARY KEY, -- Smart ID: INITIALS + RESIDENTIAL_ID + DATE
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    residential_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IDX_PARENTS_EMAIL ON parents(email);

---------------------------------------------------
-- Students
---------------------------------------------------
CREATE TABLE students (
    id TEXT PRIMARY KEY, -- Smart ID: INITIALS + RESIDENTIAL_ID + DATE
    parent_id TEXT REFERENCES parents(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    residential_id TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IDX_STUDENTS_PARENT ON students(parent_id);

---------------------------------------------------
-- Trial Classes
---------------------------------------------------
CREATE TABLE trial_classes (
    id TEXT PRIMARY KEY, -- Smart ID: CLASS INITIALS + SUBJECT INITIALS + START_TIME + MAX_SEATS
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    max_seats INT NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IDX_TRIAL_CLASSES_START_TIME ON trial_classes(start_time);

---------------------------------------------------
-- Bookings
---------------------------------------------------
CREATE TABLE bookings (
    id TEXT PRIMARY KEY, -- Smart ID: BOOKING### + DATE (uppercase, independent)
    student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
    trial_class_id TEXT REFERENCES trial_classes(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('PENDING_PAYMENT','CONFIRMED','PAYMENT_FAILED','CANCELLED')),
    registered_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX UNIQ_CONFIRMED_BOOKING
ON bookings(student_id, trial_class_id)
WHERE status = 'CONFIRMED';
CREATE INDEX IDX_BOOKINGS_CLASS ON bookings(trial_class_id);
CREATE INDEX IDX_BOOKINGS_STUDENT ON bookings(student_id);

---------------------------------------------------
-- Payment Attempts
---------------------------------------------------
CREATE TABLE payment_attempts (
    id TEXT PRIMARY KEY, -- Smart ID: ATTEMPT### + DATE (uppercase, independent)
    booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('INITIATED','SUCCESS','FAILED')),
    txn_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IDX_PAYMENT_ATTEMPTS_BOOKING ON payment_attempts(booking_id);

---------------------------------------------------
-- Stored Procedure
---------------------------------------------------
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
    -- Lock booking row
    SELECT student_id, trial_class_id
    INTO v_student_id, v_class_id
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- Lock trial class row
    SELECT max_seats
    INTO v_max_seats
    FROM trial_classes
    WHERE id = v_class_id
    FOR UPDATE;

    -- Check duplicate confirmed booking
    SELECT id INTO v_existing_booking
    FROM bookings
    WHERE student_id = v_student_id
      AND trial_class_id = v_class_id
      AND status = 'CONFIRMED'
    LIMIT 1;

    IF v_existing_booking IS NOT NULL THEN
        UPDATE bookings SET status = 'PAYMENT_FAILED'
        WHERE id = p_booking_id;
        RETURN 'DUPLICATE_BOOKING';
    END IF;

    -- Count confirmed seats
    SELECT COUNT(*) INTO v_confirmed_count
    FROM bookings
    WHERE trial_class_id = v_class_id
      AND status = 'CONFIRMED';

    -- Handle payment result
    IF p_payment_result = 'SUCCESS' THEN
        IF v_confirmed_count < v_max_seats THEN
            UPDATE bookings SET status = 'CONFIRMED'
            WHERE id = p_booking_id;
            RETURN 'CONFIRMED';
        ELSE
            UPDATE bookings SET status = 'PAYMENT_FAILED'
            WHERE id = p_booking_id;
            RETURN 'NO_SEATS_AVAILABLE';
        END IF;
    ELSE
        UPDATE bookings SET status = 'PAYMENT_FAILED'
        WHERE id = p_booking_id;
        RETURN 'PAYMENT_FAILED';
    END IF;
END;
$$ LANGUAGE plpgsql;

---------------------------------------------------
-- Seed Data
---------------------------------------------------

-- Parents
INSERT INTO parents (id, first_name, last_name, residential_id, email, registered_at) VALUES
    ('AL-RES123-20260925', 'ALICE', 'LEE', 'RES123', 'alice@example.com', now()),
    ('BO-RES456-20260925', 'BOB', 'OLSEN', 'RES456', 'bob@example.com', now());

-- Students
INSERT INTO students (id, parent_id, first_name, last_name, residential_id, registered_at) VALUES
    ('CH-RES789-20260925', 'AL-RES123-20260925', 'CHARLIE', 'LEE', 'RES789', now()),
    ('DA-RES321-20260925', 'AL-RES123-20260925', 'DAISY', 'LEE', 'RES321', now()),
    ('ET-RES654-20260925', 'BO-RES456-20260925', 'ETHAN', 'OLSEN', 'RES654', now());

-- Trial Classes
INSERT INTO trial_classes (id, class_name, subject, start_time, max_seats, created_at) VALUES
    ('MT-M-20261001T1000-4', 'MATH TRIAL', 'MATH', '2026-10-01 10:00:00', 4, now()),
    ('SC-S-20261002T1400-4', 'SCIENCE TRIAL', 'SCIENCE', '2026-10-02 14:00:00', 4, now());

-- Bookings (IDs independent, uppercase, no B- prefix)
INSERT INTO bookings (id, student_id, trial_class_id, status, registered_at) VALUES
    ('BOOKING001-20260925', 'CH-RES789-20260925', 'SC-S-20261002T1400-4', 'CONFIRMED', now()),
    ('BOOKING002-20260925', 'DA-RES321-20260925', 'SC-S-20261002T1400-4', 'CONFIRMED', now()),
    ('BOOKING003-20260925', 'ET-RES654-20260925', 'SC-S-20261002T1400-4', 'CONFIRMED', now()),
    ('BOOKING004-20260925', 'CH-RES789-20260925', 'SC-S-20261002T1400-4', 'PENDING_PAYMENT', now()),
    ('BOOKING005-20260925', 'ET-RES654-20260925', 'MT-M-20261001T1000-4', 'PAYMENT_FAILED', now());

-- Payment Attempts (IDs independent, uppercase, no PA- prefix)
INSERT INTO payment_attempts (id, booking_id, status, txn_id, created_at) VALUES
    ('ATTEMPT001-20260925', 'BOOKING005-20260925', 'FAILED', 'TXN-FAIL-001', now());
