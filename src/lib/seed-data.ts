export const SEED_PARENTS = [
  {
    id: "AL-RES123-20260925",
    first_name: "ALICE",
    last_name: "LEE",
    residential_id: "RES123",
    email: "alice@example.com",
  },
  {
    id: "BO-RES456-20260925",
    first_name: "BOB",
    last_name: "OLSEN",
    residential_id: "RES456",
    email: "bob@example.com",
  },
];

export const SEED_STUDENTS = [
  {
    id: "CH-RES789-20260925",
    parent_id: "AL-RES123-20260925",
    first_name: "CHARLIE",
    last_name: "LEE",
    residential_id: "RES789",
  },
  {
    id: "DA-RES321-20260925",
    parent_id: "AL-RES123-20260925",
    first_name: "DAISY",
    last_name: "LEE",
    residential_id: "RES321",
  },
  {
    id: "ET-RES654-20260925",
    parent_id: "BO-RES456-20260925",
    first_name: "ETHAN",
    last_name: "OLSEN",
    residential_id: "RES654",
  },
];

export const SEED_TRIAL_CLASSES = [
  {
    id: "MT-M-20261001T1000-4",
    class_name: "MATH TRIAL",
    subject: "MATH",
    start_time: "2026-10-01T10:00:00Z",
    max_seats: 4,
  },
  {
    id: "SC-S-20261002T1400-4",
    class_name: "SCIENCE TRIAL",
    subject: "SCIENCE",
    start_time: "2026-10-02T14:00:00Z",
    max_seats: 4,
  },
];

export const SEED_BOOKINGS = [
  {
    id: "BOOKING001-20260925",
    student_id: "CH-RES789-20260925",
    trial_class_id: "SC-S-20261002T1400-4",
    status: "CONFIRMED",
  },
  {
    id: "BOOKING002-20260925",
    student_id: "DA-RES321-20260925",
    trial_class_id: "SC-S-20261002T1400-4",
    status: "CONFIRMED",
  },
  {
    id: "BOOKING003-20260925",
    student_id: "ET-RES654-20260925",
    trial_class_id: "SC-S-20261002T1400-4",
    status: "CONFIRMED",
  },
  {
    id: "BOOKING004-20260925",
    student_id: "CH-RES789-20260925",
    trial_class_id: "SC-S-20261002T1400-4",
    status: "PENDING_PAYMENT",
  },
  {
    id: "BOOKING005-20260925",
    student_id: "ET-RES654-20260925",
    trial_class_id: "MT-M-20261001T1000-4",
    status: "PAYMENT_FAILED",
  },
];

export const SEED_PAYMENT_ATTEMPTS = [
  {
    id: "ATTEMPT001-20260925",
    booking_id: "BOOKING005-20260925",
    status: "FAILED",
    txn_id: "TXN-FAIL-001",
  },
];
