export enum BookingStatus {
  PendingPayment = "PENDING_PAYMENT",
  Confirmed = "CONFIRMED",
  PaymentFailed = "PAYMENT_FAILED",
  Cancelled = "CANCELLED",
  DuplicateBooking = "DUPLICATE_BOOKING",
  NoSeatsAvailable = "NO_SEATS_AVAILABLE",
}

export enum PaymentAttemptStatus {
  Initiated = "INITIATED",
  Success = "SUCCESS",
  Failed = "FAILED",
}

export interface Parent {
  id: string;
  first_name: string;
  last_name: string;
  residential_id: string;
  email: string;
  registered_at: string;
}

export interface Student {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  residential_id: string;
  registered_at: string;
}

export interface TrialClass {
  id: string;
  class_name: string;
  subject: string;
  start_time: string;
  max_seats: number;
  created_at: string;
}

export interface TrialClassWithSeats extends TrialClass {
  confirmed_count: number;
  seats_remaining: number;
}

export interface Booking {
  id: string;
  student_id: string;
  trial_class_id: string;
  status: BookingStatus;
  registered_at: string;
}

export interface BookingWithStudent extends Booking {
  students: Student;
  trial_classes: TrialClass;
}

export interface PaymentAttempt {
  id: string;
  booking_id: string;
  status: PaymentAttemptStatus;
  txn_id: string | null;
  created_at: string;
}

export interface CreateBookingRequest {
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_residential_id: string;
  student_first_name: string;
  student_last_name: string;
  student_residential_id: string;
  trial_class_id: string;
}

export interface ConfirmPaymentRequest {
  booking_id: string;
  payment_result: string;
}

export interface BookingResponse {
  booking_id: string;
  status: BookingStatus;
}

export interface RosterResponse {
  class_id: string;
  class_name: string;
  subject: string;
  start_time: string;
  confirmed_students: {
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
  }[];
  seats_remaining: number;
  max_seats: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
