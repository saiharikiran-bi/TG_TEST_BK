# Email Service Documentation

## Overview
The Email Service provides comprehensive email functionality for the notification system, including verification emails, notification emails, system alerts, and maintenance notices. It's based on the TGNPDCL_Backend implementation and includes advanced features like rate limiting, priority-based delivery, and HTML templates.

## Features
- **Multiple email types**: Verification, notifications, alerts, maintenance
- **Priority-based delivery**: LOW, MEDIUM, HIGH, URGENT levels
- **Rate limiting**: Prevents email spam and abuse
- **HTML templates**: Professional, responsive email designs
- **SMTP configuration**: Support for Gmail, Outlook, and custom SMTP servers
- **Bulk email support**: Send multiple emails efficiently
- **Error handling**: Comprehensive error handling and retry mechanisms

## Configuration

### Environment Variables
```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Application Configuration
APP_NAME="Admin Module"
FRONTEND_URL=http://localhost:3000

# Email Recipients
ADMIN_EMAILS=admin@example.com,manager@example.com
SUPPORT_EMAILS=support@example.com,tech@example.com

# SMS Configuration (optional)
MSG_AUTH_TOKEN=your_msg91_auth_token
MSG_SENDER_ID=your_sender_id
MSG_TEMPLATE_ID=your_template_id
DLT_TE_ID=your_dlt_te_id
```

### Email Configuration File
The service uses `config/email.config.js` for centralized configuration management.

## Notification Levels

### Level Configuration
```javascript
const NOTIFICATION_LEVELS = {
    LOW: {
        priority: 'low',
        subjectPrefix: 'ℹ️',
        delayMinutes: 60,        // Send after 1 hour
        maxEmailsPerHour: 10     // Max 10 emails per hour
    },
    MEDIUM: {
        priority: 'normal',
        subjectPrefix: '📢',
        delayMinutes: 30,        // Send after 30 minutes
        maxEmailsPerHour: 20     // Max 20 emails per hour
    },
    HIGH: {
        priority: 'high',
        subjectPrefix: '⚠️',
        delayMinutes: 15,        // Send after 15 minutes
        maxEmailsPerHour: 30     // Max 30 emails per hour
    },
    URGENT: {
        priority: 'high',
        subjectPrefix: '🚨',
        delayMinutes: 5,         // Send after 5 minutes
        maxEmailsPerHour: 50     // Max 50 emails per hour
    }
};
```

## API Methods

### 1. Send Verification Email
```javascript
import EmailService from '../utils/emailService.js';

// Send verification code
await EmailService.sendVerificationEmail(
    'user@example.com',
    '123456',
    false,  // isRegistration
    'verification'
);

// Send password reset
await EmailService.sendVerificationEmail(
    'user@example.com',
    'https://example.com/reset?token=abc123',
    false,
    'reset'
);
```

### 2. Send Notification Email
```javascript
const notification = {
    id: 1,
    type: 'BILL_GENERATED',
    title: 'New Bill Generated',
    message: 'Your monthly bill has been generated',
    priority: 'MEDIUM',
    channels: ['PUSH', 'EMAIL'],
    consumerEmail: 'consumer@example.com'
};

await EmailService.sendNotificationEmail(notification, ['user@example.com']);
```

### 3. Send Bulk Notification Emails
```javascript
const notifications = [notification1, notification2, notification3];
const results = await EmailService.sendBulkNotificationEmails(notifications);
```

### 4. Send System Maintenance Email
```javascript
const maintenanceData = {
    title: 'Scheduled Maintenance',
    message: 'System will be unavailable for maintenance',
    scheduledTime: '2024-01-15 02:00 AM',
    duration: '2 hours',
    affectedServices: 'User authentication, API endpoints'
};

await EmailService.sendSystemMaintenanceEmail(maintenanceData);
```

### 5. Send Alert Email
```javascript
const alertData = {
    alertType: 'Power Failure',
    location: 'DTR-001 (Feeder-A)',
    severity: 'HIGH',
    details: 'Meter has detected power failure',
    timestamp: new Date().toISOString()
};

await EmailService.sendAlertEmail(alertData);
```

## Email Templates

### 1. Verification Template
- Clean, professional design
- Verification code display
- Expiration information
- Security notice

### 2. Bill Notification Template
- Bill details and amount
- Due date information
- Payment instructions
- Contact information

### 3. Payment Due Template
- Urgent payment reminder
- Late fee warnings
- Payment methods
- Support contact

### 4. Ticket Escalation Template
- Escalation notice
- Ticket details
- Priority information
- Action required

### 5. System Alert Template
- Alert information
- Severity level
- Timestamp
- Action items

### 6. Maintenance Template
- Maintenance schedule
- Duration and affected services
- Alternative contact methods
- Status updates

## Rate Limiting

### How It Works
- **Per-notification limits**: Each notification has hourly limits
- **Time-based delays**: Higher priority notifications are sent faster
- **Global limits**: Prevents system overload
- **Configurable thresholds**: Adjustable per priority level

### Rate Limit Configuration
```javascript
const rateLimit = {
    minIntervalMs: 15 * 60 * 1000,  // 15 minutes between emails
    maxEmailsPerHour: {
        LOW: 10,
        MEDIUM: 20,
        HIGH: 30,
        URGENT: 50
    }
};
```

## Integration with Notification System

### Automatic Email Sending
The email service automatically integrates with the notification system:

1. **Bill Notifications**: Automatically sent when bills are generated
2. **Ticket Notifications**: Sent for ticket updates and escalations
3. **System Alerts**: Sent for system-wide issues
4. **Meter Alerts**: Sent for meter-related problems

### Notification Flow
```
Notification Created → Email Service → SMTP → Recipient
     ↓
Rate Limit Check → Template Selection → Email Sending → Status Update
```

## Error Handling

### SMTP Errors
- Connection failures
- Authentication errors
- Rate limit exceeded
- Invalid email addresses

### Retry Mechanism
- Automatic transporter reset
- Connection verification
- Error logging and monitoring

### Fallback Options
- Alternative SMTP servers
- Queue-based retry system
- Manual intervention triggers

## Performance Considerations

### Email Queuing
- Background processing
- Batch email sending
- Priority-based queuing
- Memory management

### Database Integration
- Notification status tracking
- Email delivery logs
- Performance metrics
- Audit trails

## Security Features

### Email Validation
- Recipient email verification
- Content sanitization
- Rate limiting protection
- Spam prevention

### Authentication
- SMTP authentication
- Secure connections (TLS/SSL)
- Credential management
- Access control

## Monitoring and Logging

### Email Delivery Tracking
```javascript
// Log successful emails
console.log(`✅ Email sent to ${recipient}`);

// Log failed emails
console.error(`❌ Email failed: ${error.message}`);

// Log rate limit hits
console.log(`⏳ Rate limit reached for notification ${id}`);
```

### Metrics Collection
- Email delivery rates
- Failure rates by type
- Performance metrics
- User engagement

## Troubleshooting

### Common Issues

1. **SMTP Connection Failed**
   - Check SMTP credentials
   - Verify network connectivity
   - Check firewall settings

2. **Authentication Failed**
   - Verify username/password
   - Check app-specific passwords
   - Enable 2FA if required

3. **Rate Limit Exceeded**
   - Check notification frequency
   - Adjust rate limit settings
   - Monitor email volume

4. **Template Rendering Issues**
   - Check HTML syntax
   - Verify template variables
   - Test email rendering

### Debug Mode
Enable debug logging:
```bash
DEBUG=email:*,notifications:*
```

## Future Enhancements

### Planned Features
- **Scheduled emails**: Send emails at specific times
- **Email templates**: User-configurable templates
- **A/B testing**: Email content optimization
- **Analytics dashboard**: Email performance metrics
- **Webhook integration**: External service notifications
- **Multi-language support**: Internationalization

### Advanced Features
- **Email tracking**: Open and click tracking
- **Personalization**: Dynamic content based on user data
- **Segmentation**: Targeted email campaigns
- **Automation**: Trigger-based email workflows

## Support and Maintenance

### Regular Tasks
- Monitor email delivery rates
- Check SMTP server status
- Review rate limit effectiveness
- Update email templates
- Monitor system performance

### Emergency Procedures
- SMTP server failure response
- Rate limit bypass procedures
- Manual email sending process
- Escalation protocols

## Best Practices

### Email Content
- Clear, concise subject lines
- Professional formatting
- Mobile-responsive design
- Clear call-to-action

### Performance
- Use appropriate priority levels
- Implement proper rate limiting
- Monitor delivery metrics
- Optimize template rendering

### Security
- Validate all email addresses
- Sanitize email content
- Use secure SMTP connections
- Implement proper authentication

## Examples

### Complete Email Service Usage
```javascript
import EmailService from '../utils/emailService.js';
import NotificationService from '../utils/notificationService.js';

// Create and send a bill notification
const billData = {
    consumerId: 123,
    totalAmount: 1500,
    dueDate: '2024-01-15',
    consumerEmail: 'consumer@example.com'
};

// This automatically creates notification and sends email
await NotificationService.createBillNotification(
    billData.consumerId,
    billData,
    'BILL_GENERATED'
);

// Send system maintenance notice
await EmailService.sendSystemMaintenanceEmail({
    title: 'Database Maintenance',
    message: 'Database will be unavailable for maintenance',
    scheduledTime: '2024-01-15 02:00 AM',
    duration: '1 hour',
    affectedServices: 'User authentication, API endpoints'
});
```

This email service provides a robust, scalable solution for all email communication needs in the application, with comprehensive features for notifications, alerts, and system communications.
