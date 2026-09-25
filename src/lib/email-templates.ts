interface BookingConfirmedEmailProps {
  studentName: string;
  parentName: string;
  className: string;
  subject: string;
  startTime: string;
  endTime: string;
  location: string;
  bookingId: string;
}

export function bookingConfirmedTemplate(props: BookingConfirmedEmailProps): string {
  const { studentName, parentName, className, subject, startTime, endTime, location, bookingId } = props;
  
  const formattedDate = new Date(startTime).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const formattedStartTime = new Date(startTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  
  const formattedEndTime = new Date(endTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #faaf22; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: #1a1a1a; font-size: 24px; }
        .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .success-icon { text-align: center; margin-bottom: 20px; }
        .success-icon span { font-size: 48px; }
        .details { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #374151; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { color: #6b7280; }
        .detail-value { font-weight: 600; color: #111827; }
        .footer { background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: 0; }
        .footer p { margin: 0; font-size: 14px; color: #6b7280; }
        .btn { display: inline-block; background-color: #69cce1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .btn:hover { background-color: #5bb8d1; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
        </div>
        <div class="content">
          <div class="success-icon">
            <span>✅</span>
          </div>
          <p>Hi ${parentName},</p>
          <p>Great news! ${studentName}'s trial class booking has been confirmed.</p>
          
          <div class="details">
            <h3>Class Details</h3>
            <div class="detail-row">
              <span class="detail-label">Class:</span>
              <span class="detail-value">${className}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Subject:</span>
              <span class="detail-value">${subject}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${formattedStartTime} - ${formattedEndTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${location || "Online (link will be sent before class)"}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Booking Reference:</span>
              <span class="detail-value">${bookingId}</span>
            </div>
          </div>
          
          <p>Please save this email for your records. We'll send you a reminder 24 hours before the class.</p>
          
          <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/bookings" class="btn">View My Bookings</a>
          </p>
        </div>
        <div class="footer">
          <p>OTTODOT - Fun Learning for Kids</p>
          <p>Questions? Contact us at support@ottodot.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface PaymentFailedEmailProps {
  parentName: string;
  studentName: string;
  className: string;
  bookingId: string;
}

export function paymentFailedTemplate(props: PaymentFailedEmailProps): string {
  const { parentName, studentName, className, bookingId } = props;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e7344a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .error-icon { text-align: center; margin-bottom: 20px; }
        .error-icon span { font-size: 48px; }
        .footer { background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: 0; }
        .footer p { margin: 0; font-size: 14px; color: #6b7280; }
        .btn { display: inline-block; background-color: #69cce1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .btn:hover { background-color: #5bb8d1; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Failed</h1>
        </div>
        <div class="content">
          <div class="error-icon">
            <span>❌</span>
          </div>
          <p>Hi ${parentName},</p>
          <p>We're sorry, but the payment for ${studentName}'s booking for <strong>${className}</strong> was unsuccessful.</p>
          
          <p>This could happen due to:</p>
          <ul>
            <li>Insufficient funds</li>
            <li>Card declined by your bank</li>
            <li>Expired card</li>
            <li>Incorrect card details</li>
          </ul>
          
          <p>Please try booking again or use a different payment method.</p>
          
          <p style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/bookings" class="btn">Book Again</a>
          </p>
          
          <p><small>Booking Reference: ${bookingId}</small></p>
        </div>
        <div class="footer">
          <p>OTTODOT - Fun Learning for Kids</p>
          <p>Questions? Contact us at support@ottodot.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface BookingReminderEmailProps {
  parentName: string;
  studentName: string;
  className: string;
  subject: string;
  startTime: string;
  location: string;
}

export function bookingReminderTemplate(props: BookingReminderEmailProps): string {
  const { parentName, studentName, className, subject, startTime, location } = props;
  
  const formattedDate = new Date(startTime).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const formattedTime = new Date(startTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #82c340; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; color: white; font-size: 24px; }
        .content { background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .reminder-icon { text-align: center; margin-bottom: 20px; }
        .reminder-icon span { font-size: 48px; }
        .details { background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .details h3 { margin-top: 0; color: #374151; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { color: #6b7280; }
        .detail-value { font-weight: 600; color: #111827; }
        .footer { background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: 0; }
        .footer p { margin: 0; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Class Reminder</h1>
        </div>
        <div class="content">
          <div class="reminder-icon">
            <span>📚</span>
          </div>
          <p>Hi ${parentName},</p>
          <p>This is a friendly reminder that ${studentName}'s trial class is coming up <strong>tomorrow</strong>!</p>
          
          <div class="details">
            <h3>Class Details</h3>
            <div class="detail-row">
              <span class="detail-label">Class:</span>
              <span class="detail-value">${className}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Subject:</span>
              <span class="detail-value">${subject}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${formattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${location || "Online (check your email for the link)"}</span>
            </div>
          </div>
          
          <p>Please make sure ${studentName} is ready a few minutes before the class starts.</p>
          <p>See you there! 🎉</p>
        </div>
        <div class="footer">
          <p>OTTODOT - Fun Learning for Kids</p>
          <p>Questions? Contact us at support@ottodot.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
