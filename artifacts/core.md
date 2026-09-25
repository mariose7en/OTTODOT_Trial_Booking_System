Update complete.md in folder artifacts:

Create comprehensives plan to update seed.sql and all code for these features:
A. database and features:
1. user registration dan login with email and password.
2. class
3. trial class from class, 
4. trial class booking with seats available.
5. payment header, payment detail with email notification.

B. What To Build
Implement trial class booking only. Do not implement regular enrollment.
Your solution should allow:
1. A parent to choose a child and pick an available trial class.
2. A parent to submit a trial booking.
3. A mock payment step or payment result to be recorded.
4. The booking status to be shown after submission.
5. An admin or teacher to see the trial class roster or a simple roster API/output.

C. Your solution must prevent or handle:
1. duplicate confirmed bookings for the same child and class
2. overbooking beyond 4 confirmed students
3. payment failure without incorrectly adding the child to the confirmed roster
4. Required Technical Scenario: Last-Seat Race
4.1. User A selects the last available slot and moves to payment.
4.2. User B selects the same slot.
4.3. User B completes payment first and confirms the booking.
4.4. User A then tries to complete payment.