import { getTransporter, resetTransporter } from '../config/emailTransporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { escalationLevels } from '../cron/utils/escalationLevels.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const msg91 = require('msg91');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email configuration
const EMAIL_CONFIG = {
    APP_NAME: process.env.APP_NAME || 'Admin Module',
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_USER,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [
        'admin@example.com'
    ],
    SUPPORT_EMAILS: process.env.SUPPORT_EMAILS ? process.env.SUPPORT_EMAILS.split(',') : [
        'support@example.com'
    ]
};

// Notification levels and their email configurations
const NOTIFICATION_LEVELS = {
    LOW: {
        priority: 'low',
        subjectPrefix: 'ℹ️',
        delayMinutes: 60, // Send after 1 hour
        maxEmailsPerHour: 10
    },
    MEDIUM: {
        priority: 'normal',
        subjectPrefix: '📢',
        delayMinutes: 30, // Send after 30 minutes
        maxEmailsPerHour: 20
    },
    HIGH: {
        priority: 'high',
        subjectPrefix: '⚠️',
        delayMinutes: 15, // Send after 15 minutes
        maxEmailsPerHour: 30
    },
    URGENT: {
        priority: 'high',
        subjectPrefix: '🚨',
        delayMinutes: 5, // Send after 5 minutes
        maxEmailsPerHour: 50
    }
};

// Email rate limiting
const emailRateLimit = new Map();
const lastEmailSent = new Map();
const MIN_EMAIL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Error state tracking (exactly like TGNPDCL)
const previousErrorStates = new Map();

// MSG91 SMS Configuration (exactly like TGNPDCL_Backend)
const MSG91_CONFIG = {
    AUTH_TOKEN: process.env.MSG_AUTH_TOKEN,
    SENDER_ID: process.env.MSG_SENDER_ID,
    TEMPLATE_ID: process.env.MSG_TEMPLATE_ID,
    DLT_TE_ID: process.env.DLT_TE_ID
};

// Initialize MSG91 client
let msg91Client = null;
if (msg91 && msg91.default) {
    try {
        // MSG91 exports a singleton instance in the default property
        msg91Client = msg91.default;
        if (MSG91_CONFIG.AUTH_TOKEN) {
            msg91Client.initialize({
                authKey: MSG91_CONFIG.AUTH_TOKEN
            });
        }
    } catch (error) {
        console.error('Failed to initialize MSG91 client:', error);
    }
}

// Helper function to get all unique phone numbers from escalation levels
const getAllEscalationPhoneNumbers = () => {
    const phoneNumbers = new Set();
    console.log('🔍 [DEBUG] Escalation levels:', escalationLevels.length);
    
    escalationLevels.forEach((level, index) => {
        console.log(`🔍 [DEBUG] Level ${index}: ${level.name}, Contacts: ${level.contacts.length}`);
        level.contacts.forEach((contact, contactIndex) => {
            console.log(`🔍 [DEBUG] Contact ${contactIndex}: ${contact.name} - ${contact.phone}`);
            if (contact.phone) {
                phoneNumbers.add(contact.phone);
            }
        });
    });
    
    const result = Array.from(phoneNumbers);
    console.log('🔍 [DEBUG] Total unique phone numbers:', result);
    return result;
};

class EmailService {
    // Static properties for error state tracking
    static previousErrorStates = new Map();
    static lastEmailSent = new Map();

    // Send verification email
    static async sendVerificationEmail(email, code, isRegistration = false, type = 'verification') {
        try {
            let subject, message, html;

            if (type === 'reset') {
                subject = 'Reset Your Password';
                message = `Click the following link to reset your password: ${code}\nThis link will expire in 1 hour.`;
                html = this.getPasswordResetTemplate(code);
            } else {
                subject = isRegistration
                    ? 'Verify Your Email Address'
                    : 'Login Verification Code';

                message = isRegistration
                    ? `Welcome! Your verification code is: ${code}\nPlease use this code to verify your email address.`
                    : `Your login verification code is: ${code}\nPlease use this code to complete your login.`;

                html = this.getVerificationTemplate(code, isRegistration);
            }

            const transporter = await getTransporter();
            await transporter.sendMail({
                from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.EMAIL_FROM}>`,
                to: email,
                subject,
                text: message,
                html,
            });

            console.log(`✅ Verification email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            resetTransporter();
            return false;
        }
    }

    // Send notification email based on type and priority
    static async sendNotificationEmail(notification, recipients = []) {
        try {
            const { type, title, message, priority, channels } = notification;
            
            // Check if email is in channels
            if (!channels.includes('EMAIL')) {
                return false;
            }

            // Check rate limiting
            if (!this.checkRateLimit(notification.id, priority)) {
                console.log(`⏳ Rate limit reached for notification ${notification.id}, skipping email`);
                return false;
            }

            const levelConfig = NOTIFICATION_LEVELS[priority] || NOTIFICATION_LEVELS.MEDIUM;
            const subject = `${levelConfig.subjectPrefix} ${title}`;
            
            let html;
            let toEmails = [];

            // Determine recipients based on notification type
            switch (type) {
                case 'BILL_GENERATED':
                    html = this.getBillNotificationTemplate(notification);
                    toEmails = recipients.length > 0 ? recipients : [notification.consumerEmail];
                    break;
                case 'PAYMENT_DUE':
                    html = this.getPaymentDueTemplate(notification);
                    toEmails = recipients.length > 0 ? recipients : [notification.consumerEmail];
                    break;
                case 'TICKET_ESCALATION':
                    html = this.getTicketEscalationTemplate(notification);
                    toEmails = [...EMAIL_CONFIG.ADMIN_EMAILS, ...EMAIL_CONFIG.SUPPORT_EMAILS];
                    break;
                case 'SYSTEM_ALERT':
                    html = this.getSystemAlertTemplate(notification);
                    toEmails = [...EMAIL_CONFIG.ADMIN_EMAILS, ...EMAIL_CONFIG.SUPPORT_EMAILS];
                    break;
                case 'METER_ALERT':
                    html = this.getMeterAlertTemplate(notification);
                    toEmails = [...EMAIL_CONFIG.SUPPORT_EMAILS, ...recipients];
                    break;
                default:
                    html = this.getGenericNotificationTemplate(notification);
                    toEmails = recipients.length > 0 ? recipients : [notification.consumerEmail];
            }

            // Filter out undefined emails
            toEmails = toEmails.filter(email => email && email.includes('@'));

            if (toEmails.length === 0) {
                console.log('⚠️ No valid email addresses found for notification');
                return false;
            }

            const transporter = await getTransporter();
            await transporter.sendMail({
                from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.EMAIL_FROM}>`,
                to: toEmails,
                subject,
                html,
                priority: levelConfig.priority
            });

            // Update rate limiting
            this.updateRateLimit(notification.id, priority);
            lastEmailSent.set(notification.id, new Date());

            console.log(`✅ Notification email sent to ${toEmails.join(', ')}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send notification email:', error);
            resetTransporter();
            return false;
        }
    }

    // Send bulk notification emails
    static async sendBulkNotificationEmails(notifications, recipients = []) {
        try {
            const results = [];
            for (const notification of notifications) {
                try {
                    const result = await this.sendNotificationEmail(notification, recipients);
                    results.push({ success: true, notificationId: notification.id, result });
                } catch (error) {
                    results.push({ success: false, notificationId: notification.id, error: error.message });
                }
            }
            return results;
        } catch (error) {
            console.error('❌ Bulk email sending failed:', error);
            throw error;
        }
    }

    // Send system maintenance email
    static async sendSystemMaintenanceEmail(maintenanceData) {
        try {
            const { title, message, scheduledTime, duration, affectedServices } = maintenanceData;
            
            const html = this.getSystemMaintenanceTemplate(maintenanceData);
            const subject = `🔧 System Maintenance: ${title}`;

            const transporter = await getTransporter();
            await transporter.sendMail({
                from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.EMAIL_FROM}>`,
                to: [...EMAIL_CONFIG.ADMIN_EMAILS, ...EMAIL_CONFIG.SUPPORT_EMAILS],
                subject,
                html,
                priority: 'high'
            });

            console.log('✅ System maintenance email sent');
            return true;
        } catch (error) {
            console.error('❌ Failed to send system maintenance email:', error);
            resetTransporter();
            return false;
        }
    }

    // Send alert email (similar to TGNPDCL zero value alert)
    static async sendAlertEmail(alertData) {
        try {
            const { alertType, location, severity, details, timestamp } = alertData;
            
            const html = this.getAlertTemplate(alertData);
            const subject = `🚨 ${severity} Alert: ${alertType} at ${location}`;

            const transporter = await getTransporter();
            await transporter.sendMail({
                from: `"${EMAIL_CONFIG.APP_NAME}" <${EMAIL_CONFIG.EMAIL_FROM}>`,
                to: [...EMAIL_CONFIG.ADMIN_EMAILS, ...EMAIL_CONFIG.SUPPORT_EMAILS],
                subject,
                html,
                priority: 'high'
            });

            console.log('✅ Alert email sent');
            return true;
        } catch (error) {
            console.error('❌ Failed to send alert email:', error);
            resetTransporter();
            return false;
        }
    }

    // Send zero value alert (exactly like TGNPDCL_Backend)
    static async sendZeroValueAlert(meterSerial, feederName, dtrName, zeroValues, powerData, lastCommDate) {
        try {
            console.log(`🚨 Starting zero value alert for meter ${meterSerial}`);
            
            // Check if we need to send alert (similar to TGNPDCL logic)
            const currentErrorSignature = this.generateErrorSignature(zeroValues, powerData);
            const previousSignature = this.previousErrorStates.get(meterSerial);

            if (previousSignature && previousSignature === currentErrorSignature) {
                console.log(`⏳ Skipping alert for meter ${meterSerial}: No change in error state`);
                return null;
            }

            this.previousErrorStates.set(meterSerial, currentErrorSignature);

            // Send email alert
            const transporter = await getTransporter();
            const templatePath = path.join(__dirname, '../templates/emails/zeroAlertMail.html');
            
            let template = fs.readFileSync(templatePath, 'utf8');
            template = template.replace(/\${DTRName}/g, dtrName);
            template = template.replace(/\${feederName}/g, feederName);
            template = template.replace(/\${last_comm_date}/g, lastCommDate);

            const propertyMap = {
                'Meter Power Fail (R - Phase)': 'powerFactor',
                'Meter Power Fail (Y - Phase)': 'pfYPh',
                'Meter Power Fail (B - Phase)': 'pfBPh',
                'R_PH Missing': 'vRPh',
                'Y_PH Missing': 'vYPh',
                'B_PH Missing': 'vBPh',
                'LT Fuse Blown (R - Phase)': 'cRPh',
                'LT Fuse Blown (Y - Phase)': 'cYPh',
                'LT Fuse Blown (B - Phase)': 'cBPh',
                'R_PH CT Reversed': 'cRPh',
                'Y_PH CT Reversed': 'cYPh',
                'B_PH CT Reversed': 'cBPh',
                'Unbalanced Load': 'neutral_current',
                'Low PF (R - Phase)': 'powerFactor',
                'Low PF (Y - Phase)': 'pfYPh',
                'Low PF (B - Phase)': 'pfBPh',
                'HT Fuse Blown (R - Phase)': 'vRPh',
                'HT Fuse Blown (Y - Phase)': 'vYPh',
                'HT Fuse Blown (B - Phase)': 'vBPh'
            };

            const unitMap = {
                powerFactor: '',
                pfYPh: '',
                pfBPh: '',
                vRPh: 'V',
                vYPh: 'V',
                vBPh: 'V',
                cRPh: 'A',
                cYPh: 'A',
                cBPh: 'A',
                neutral_current: 'I<sub>n</sub>'
            };

            let alertMessage = '';
            let zeroValuesList = '';
            const zeroEntries = Object.entries(zeroValues).filter(([key, value]) => value === true);

            if (zeroEntries.length > 0) {
                const alertLines = zeroEntries.map(([key]) => {
                    const dataKey = propertyMap[key] || key;
                    const value = powerData[dataKey] || '0.000';
                    const unit = unitMap[dataKey] || '';

                    if (key === 'Load Imbalance' || key === 'Unbalanced Load') {
                        return `${key} : Neutral Current = ${value} A`;
                    }
                    if (key === 'Power Failure') {
                        return `Power Failure Occured @${powerData.tamper_datetime || 'Unknown time'}`;
                    }

                    return `${key} : ${value} ${unit}`;
                });

                zeroValuesList = alertLines.join('\n');
                alertMessage = `
                    <p style="margin: 0; padding: 0; color: black !important">
                        ${alertLines.join('<br>')}
                    </p>
                `;
            }

            template = template.replace('<!-- POWER_DATA_TABLE -->', alertMessage);

            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = ` ${day}-${month}-${year} at ${hours}:${minutes}:${seconds}`;

            template = template.replace('<!-- TIMESTAMP -->', timestamp);

            const mailOptions = {
                from: EMAIL_CONFIG.EMAIL_FROM || EMAIL_CONFIG.SMTP_USER,
                to: [
                    'madhu.bestinfra@gmail.com'
                ],
                subject: `⚠️ Important Alert: Abnormality Detected for ${dtrName} (${feederName})`,
                html: template
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('📧 Zero value alert email sent successfully');

            // Send SMS alerts using integrated MSG91 (exactly like TGNPDCL)
            try {
                // Note: dtrName and feederName are now dtrNumber and meterNumber respectively
                await this.sendZeroValueAlertSMS(dtrName, feederName, zeroValues, powerData, lastCommDate);
                console.log('📱 Zero value alert SMS sent successfully');
            } catch (smsError) {
                console.error('❌ Failed to send SMS alert:', smsError);
            }

            this.lastEmailSent.set(meterSerial, now);
            return info;

        } catch (error) {
            console.error(`❌ Failed to send zero value alert for meter ${meterSerial}:`, error);
            throw error;
        }
    }

    // Generate error signature (exactly like TGNPDCL)
    static generateErrorSignature(zeroValues, powerData) {
        let signature = '';

        const sortedKeys = Object.keys(zeroValues).sort();

        for (const key of sortedKeys) {
            if (zeroValues[key] === true) {
                const propertyMap = {
                    'Meter Power Fail (R - Phase)': 'powerFactor',
                    'Meter Power Fail (Y - Phase)': 'pfYPh',
                    'Meter Power Fail (B - Phase)': 'pfBPh',
                    'R_PH Missing': 'vRPh',
                    'Y_PH Missing': 'vYPh',
                    'B_PH Missing': 'vBPh',
                    'LT Fuse Blown (R - Phase)': 'cRPh',
                    'LT Fuse Blown (Y - Phase)': 'cYPh',
                    'LT Fuse Blown (B - Phase)': 'cBPh',
                    'R_PH CT Reversed': 'cRPh',
                    'Y_PH CT Reversed': 'cYPh',
                    'B_PH CT Reversed': 'cBPh',
                    'Unbalanced Load': 'neutral_current',
                    'Low PF (R - Phase)': 'powerFactor',
                    'Low PF (Y - Phase)': 'pfYPh',
                    'Low PF (B - Phase)': 'pfBPh',
                    'HT Fuse Blown (R - Phase)': 'vRPh',
                    'HT Fuse Blown (Y - Phase)': 'vYPh',
                    'HT Fuse Blown (B - Phase)': 'vBPh'
                };

                const dataKey = propertyMap[key] || key;
                const value = powerData[dataKey] || '0.000';

                signature += `${key}:${value};`;
            }
        }

        return signature;
    }

    // MSG91 SMS Methods (exactly like TGNPDCL_Backend)
    
    // Send SMS using MSG91 package
    static async sendSMS(mobile, templateId, variables = {}) {
        try {
            if (!MSG91_CONFIG.AUTH_TOKEN) {
                throw new Error('MSG91_AUTH_TOKEN not configured');
            }

            if (!msg91Client || !msg91Client.initialized) {
                throw new Error('MSG91 client not initialized properly');
            }

            // Extract variables from the variables object
            const var1 = variables.var || '';
            const var2 = variables.var1 || '';
            const var3 = variables.var2 || '';
            const var4 = variables.var3 || '';
            const DLT_TE_ID = variables.DLT_TE_ID;

            // Debug logging to troubleshoot template variable mapping
            console.log('📱 [SMS DEBUG] Template variables:', {
                templateId: templateId || MSG91_CONFIG.TEMPLATE_ID,
                VAR1: var1 || '',
                VAR2: var2 || '',
                VAR3: var3 || '',
                VAR4: var4 || ''
            });
            
            // Debug: Log MSG91 configuration
            console.log('📱 [SMS DEBUG] MSG91 Config:', {
                AUTH_TOKEN: MSG91_CONFIG.AUTH_TOKEN ? '***' : 'NOT_SET',
                SENDER_ID: MSG91_CONFIG.SENDER_ID,
                TEMPLATE_ID: MSG91_CONFIG.TEMPLATE_ID,
                DLT_TE_ID: MSG91_CONFIG.DLT_TE_ID
            });

            // Use MSG91 package to send SMS with template
            const smsInstance = msg91Client.getSMS();
            
            // Prepare the recipient data with variables
            // Try different variable formats that MSG91 might expect
            const recipientData = {
                mobile: mobile,
                // Format 1: Standard VAR1, VAR2, etc.
                VAR1: var1 || '',      // Maps to ##var## in template (DTR Number)
                VAR2: var2 || '',      // Maps to ##var1## in template (Meter Number)
                VAR3: var3 || '',      // Maps to ##var2## in template (Abnormality Values)
                VAR4: var4 || '',      // Maps to ##var3## in template (Timestamp)
                
                // Format 2: Alternative variable names (some templates use these)
                var1: var1 || '',
                var2: var2 || '',
                var3: var3 || '',
                var4: var4 || '',
                
                // Format 3: Direct template variable names
                '##var##': var1 || '',
                '##var1##': var2 || '',
                '##var2##': var3 || '',
                '##var3##': var4 || ''
            };
            
            // Debug: Log the exact data being sent to MSG91
            console.log('📱 [SMS DEBUG] Recipient data for MSG91:', recipientData);
            console.log('📱 [SMS DEBUG] Template ID:', templateId || MSG91_CONFIG.TEMPLATE_ID);
            console.log('📱 [SMS DEBUG] Sender ID:', MSG91_CONFIG.SENDER_ID);
            
            const result = await smsInstance.send(
                templateId || MSG91_CONFIG.TEMPLATE_ID, // flow_id
                recipientData,
                {
                    senderId: MSG91_CONFIG.SENDER_ID,
                    shortURL: false
                }
            );
            
            // Debug logging for MSG91 response
            console.log('📱 [SMS DEBUG] MSG91 Package Response:', {
                mobile,
                response: result
            });
            
            if (result && result.message) {
                console.log(`✅ SMS sent successfully to ${mobile}:`, result.message);
                return result;
            } else {
                console.error(`❌ SMS failed for ${mobile}:`, result?.message || 'Unknown error');
                
                // Additional debugging for template variable issues
                if (result?.message && result.message.includes('template')) {
                    console.error('📱 [SMS DEBUG] Template configuration issue detected. Please check:');
                    console.error('   - Template ID is correct');
                    console.error('   - Template is configured to accept variables');
                    console.error('   - Template variables are properly set up in MSG91 dashboard');
                }
                
                throw new Error(result?.message || 'SMS sending failed');
            }
        } catch (error) {
            console.error('❌ SMS service error:', error);
            throw error;
        }
    }

    // Send bulk SMS to multiple recipients
    static async sendBulkSMS(templateId, recipients, options = {}) {
        try {
            const results = [];
            const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            for (const recipient of recipients) {
                try {
                    const result = await this.sendSMS(recipient.mobile, templateId, recipient);
                    results.push({ success: true, mobile: recipient.mobile, result });
                } catch (error) {
                    results.push({ success: false, mobile: recipient.mobile, error: error.message });
                }

                // Add delay between SMS to avoid rate limiting
                if (recipients.indexOf(recipient) < recipients.length - 1) {
                    await delay(1000); // 1 second delay
                }
            }

            return results;
        } catch (error) {
            console.error('❌ Bulk SMS sending failed:', error);
            throw error;
        }
    }

    // Test MSG91 connection and template
    static async testMSG91Connection() {
        try {
            console.log('🧪 Testing MSG91 connection...');
            
            if (!MSG91_CONFIG.AUTH_TOKEN) {
                throw new Error('MSG91_AUTH_TOKEN not configured');
            }
            
            if (!msg91Client || !msg91Client.initialized) {
                throw new Error('MSG91 client not initialized properly');
            }

            // Test with a dummy number and template
            const smsInstance = msg91Client.getSMS();
            const testResult = await smsInstance.send(
                MSG91_CONFIG.TEMPLATE_ID, // flow_id
                {
                    mobile: '9999999999', // Dummy number for testing
                    VAR1: 'TEST_DTR',
                    VAR2: 'TEST_METER',
                    VAR3: 'TEST_ABNORMALITY',
                    VAR4: 'TEST_TIME'
                },
                {
                    senderId: MSG91_CONFIG.SENDER_ID,
                    shortURL: false
                }
            );

            console.log('✅ MSG91 connection test successful:', testResult);
            return testResult;
        } catch (error) {
            console.error('❌ MSG91 connection test failed:', error);
            throw error;
        }
    }

    // Test SMS with actual template variables
    static async testSMSTemplate() {
        try {
            console.log('🧪 Testing SMS template with variables...');
            
            if (!MSG91_CONFIG.AUTH_TOKEN) {
                throw new Error('MSG91_AUTH_TOKEN not configured');
            }
            
            if (!msg91Client || !msg91Client.initialized) {
                throw new Error('MSG91 client not initialized properly');
            }

            // Test with actual values that should appear in SMS
            const smsInstance = msg91Client.getSMS();
            const testResult = await smsInstance.send(
                MSG91_CONFIG.TEMPLATE_ID, // flow_id
                {
                    mobile: '9999999999', // Dummy number for testing
                    // Test all variable formats
                    VAR1: 'DTR001',
                    VAR2: 'MTR1001',
                    VAR3: 'Test Abnormality',
                    VAR4: 'Test Time',
                    var1: 'DTR001',
                    var2: 'MTR1001',
                    var3: 'Test Abnormality',
                    var4: 'Test Time',
                    '##var##': 'DTR001',
                    '##var1##': 'MTR1001',
                    '##var2##': 'Test Abnormality',
                    '##var3##': 'Test Time'
                },
                {
                    senderId: MSG91_CONFIG.SENDER_ID,
                    shortURL: false
                }
            );

            console.log('✅ SMS template test successful:', testResult);
            return testResult;
        } catch (error) {
            console.error('❌ SMS template test failed:', error);
            throw error;
        }
    }

    // Test SMS sending to real phone numbers
    static async testRealSMSSending() {
        try {
            console.log('🧪 Testing real SMS sending...');
            
            // Get phone numbers from escalation levels
            const phoneNumbers = getAllEscalationPhoneNumbers();
            console.log('📱 [TEST] Phone numbers found:', phoneNumbers);
            
            if (!phoneNumbers || phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in escalation levels');
            }
            
            // Test with first phone number
            const testPhone = phoneNumbers[0];
            console.log('📱 [TEST] Testing with phone:', testPhone);
            
            const result = await this.sendSMS(
                testPhone,
                MSG91_CONFIG.TEMPLATE_ID,
                {
                    var: 'TEST_DTR',
                    var1: 'TEST_METER',
                    var2: 'TEST_ABNORMALITY',
                    var3: 'TEST_TIME'
                }
            );
            
            console.log('✅ Real SMS test successful:', result);
            return result;
        } catch (error) {
            console.error('❌ Real SMS test failed:', error);
            throw error;
        }
    }

    // Get MSG91 configuration status
    static getMSG91Status() {
        return {
            authToken: MSG91_CONFIG.AUTH_TOKEN ? 'Configured' : 'Not Configured',
            senderId: MSG91_CONFIG.SENDER_ID || 'Not Set',
            templateId: MSG91_CONFIG.TEMPLATE_ID || 'Not Set',
            dltTeId: MSG91_CONFIG.DLT_TE_ID || 'Not Set',
            clientInitialized: msg91Client ? msg91Client.initialized : false,
            packageLoaded: !!msg91
        };
    }

    // Troubleshoot MSG91 template issues
    static troubleshootMSG91Template() {
        console.log('🔍 MSG91 Template Troubleshooting Guide:');
        console.log('');
        console.log('1. Check Template Configuration in MSG91 Dashboard:');
        console.log('   - Go to MSG91 Dashboard > Templates');
        console.log('   - Verify Template ID:', MSG91_CONFIG.TEMPLATE_ID);
        console.log('   - Ensure template is "Approved" and "Active"');
        console.log('');
        console.log('2. Verify Template Variables:');
        console.log('   - Template should contain: ##var##, ##var1##, ##var2##, ##var3##');
        console.log('   - Variables should be properly configured in template');
        console.log('');
        console.log('3. Check DLT Approval:');
        console.log('   - Template might need DLT approval');
        console.log('   - Contact MSG91 support if template is pending approval');
        console.log('');
        console.log('4. Test Template Variables:');
        console.log('   - Use EmailService.testSMSTemplate() to test with dummy data');
        console.log('   - Check if variables are being replaced in test SMS');
        console.log('');
        console.log('5. Common Issues:');
        console.log('   - Template not approved by DLT');
        console.log('   - Wrong variable format in template');
        console.log('   - Template inactive or expired');
        console.log('   - Variables not properly mapped in MSG91 dashboard');
        
        return {
            templateId: MSG91_CONFIG.TEMPLATE_ID,
            status: 'Check MSG91 Dashboard for template approval status'
        };
    }

    // Send zero value alert SMS (exactly like TGNPDCL)
    static async sendZeroValueAlertSMS(dtrNumber, meterNumber, zeroValues, powerData, lastCommDate) {
        try {
            console.log('📱 [SMS] Starting zero value alert SMS...');
            
            // Get phone numbers from escalation levels
            const phoneNumbers = getAllEscalationPhoneNumbers();
            
            if (!phoneNumbers || phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in escalation levels');
            }
            
            console.log('📱 [SMS] Phone numbers to send SMS:', phoneNumbers);
            
            const recipients = phoneNumbers.map(phone => ({
                mobile: phone,
                var: dtrNumber,        // VAR1: DTR Number
                var1: meterNumber,     // VAR2: Meter Number
                    var2: this.formatZeroValuesForSMS(zeroValues, powerData),
                    var3: lastCommDate,
                    DLT_TE_ID: MSG91_CONFIG.DLT_TE_ID
            }));

            console.log('📱 [SMS] Recipients prepared:', recipients);
            return await this.sendBulkSMS(MSG91_CONFIG.TEMPLATE_ID, recipients);
        } catch (error) {
            console.error('❌ Failed to send zero value alert SMS:', error);
            throw error;
        }
    }

    // Format zero values for SMS (exactly like TGNPDCL)
    static formatZeroValuesForSMS(zeroValues, powerData) {
        const propertyMap = {
            'Meter Power Fail (R - Phase)': 'powerFactor',
            'Meter Power Fail (Y - Phase)': 'pfYPh',
            'Meter Power Fail (B - Phase)': 'pfBPh',
            'R_PH Missing': 'vRPh',
            'Y_PH Missing': 'vYPh',
            'B_PH Missing': 'vBPh',
            'LT Fuse Blown (R - Phase)': 'cRPh',
            'LT Fuse Blown (Y - Phase)': 'cYPh',
            'LT Fuse Blown (B - Phase)': 'cBPh',
            'R_PH CT Reversed': 'cRPh',
            'Y_PH CT Reversed': 'cYPh',
            'B_PH CT Reversed': 'cBPh',
            'Unbalanced Load': 'neutral_current',
            'Low PF (R - Phase)': 'powerFactor',
            'Low PF (Y - Phase)': 'pfYPh',
            'Low PF (B - Phase)': 'pfBPh',
            'HT Fuse Blown (R - Phase)': 'vRPh',
            'HT Fuse Blown (Y - Phase)': 'vYPh',
            'HT Fuse Blown (B - Phase)': 'vBPh'
        };

        const unitMap = {
            powerFactor: '',
            pfYPh: '',
            pfBPh: '',
            vRPh: 'V',
            vYPh: 'V',
            vBPh: 'V',
            cRPh: 'A',
            cYPh: 'A',
            cBPh: 'A',
            neutral_current: 'A'
        };

        const zeroEntries = Object.entries(zeroValues).filter(([key, value]) => value === true);
        
        if (zeroEntries.length === 0) {
            return 'No abnormalities detected';
        }

        const alertLines = zeroEntries.map(([key]) => {
            const dataKey = propertyMap[key] || key;
            const value = powerData[dataKey] || '0.000';
            const unit = unitMap[dataKey] || '';

            if (key === 'Load Imbalance' || key === 'Unbalanced Load') {
                return `${key}: Neutral Current = ${value} A`;
            }
            if (key === 'Power Failure') {
                return `Power Failure @${powerData.tamper_datetime || 'Unknown time'}`;
            }

            return `${key}: ${value} ${unit}`;
        });

        return alertLines.join(', ');
    }

    // Rate limiting methods
    static checkRateLimit(notificationId, priority) {
        const levelConfig = NOTIFICATION_LEVELS[priority] || NOTIFICATION_LEVELS.MEDIUM;
        const currentTime = Date.now();
        
        if (!emailRateLimit.has(notificationId)) {
            emailRateLimit.set(notificationId, {
                count: 0,
                resetTime: currentTime + (60 * 60 * 1000) // 1 hour
            });
        }

        const rateLimit = emailRateLimit.get(notificationId);
        
        // Reset counter if hour has passed
        if (currentTime > rateLimit.resetTime) {
            rateLimit.count = 0;
            rateLimit.resetTime = currentTime + (60 * 60 * 1000);
        }

        // Check if limit exceeded
        if (rateLimit.count >= levelConfig.maxEmailsPerHour) {
            return false;
        }

        return true;
    }

    static updateRateLimit(notificationId, priority) {
        if (emailRateLimit.has(notificationId)) {
            emailRateLimit.get(notificationId).count++;
        }
    }

    // Email template methods
    static getVerificationTemplate(code, isRegistration) {
        const subject = isRegistration ? 'Verify Your Email Address' : 'Login Verification Code';
        const message = isRegistration 
            ? 'Welcome! Your verification code is:' 
            : 'Your login verification code is:';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${subject}</h2>
                <p style="font-size: 16px; color: #666;">${message}</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 24px; font-weight: bold; color: #333;">${code}</span>
                </div>
                <p style="font-size: 14px; color: #666;">
                    This code will expire in 5 minutes.<br>
                    If you didn't request this code, please ignore this email.
                </p>
            </div>
        `;
    }

    static getPasswordResetTemplate(resetLink) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p style="font-size: 16px; color: #666;">Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
                </div>
                <p style="font-size: 14px; color: #666;">
                    This link will expire in 1 hour.<br>
                    If you didn't request this password reset, please ignore this email.
                </p>
            </div>
        `;
    }

    static getBillNotificationTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">Notification Details:</p>
                    <p style="margin: 5px 0;">Type: ${notification.type}</p>
                    <p style="margin: 5px 0;">Priority: ${notification.priority}</p>
                    <p style="margin: 5px 0;">Created: ${new Date(notification.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `;
    }

    static getPaymentDueTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">Payment Reminder</p>
                    <p style="margin: 5px 0; color: #856404;">Please ensure timely payment to avoid any late fees or service interruptions.</p>
                </div>
            </div>
        `;
    }

    static getTicketEscalationTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                    <p style="margin: 0; font-weight: bold; color: #721c24;">Escalation Notice</p>
                    <p style="margin: 5px 0; color: #721c24;">This ticket requires immediate attention. Please review and take appropriate action.</p>
                </div>
            </div>
        `;
    }

    static getSystemAlertTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #856404;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">System Alert</p>
                    <p style="margin: 5px 0; color: #856404;">This is an automated system alert. Please review and take necessary action if required.</p>
                </div>
            </div>
        `;
    }

    static getMeterAlertTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                    <p style="margin: 0; font-weight: bold; color: #721c24;">Meter Alert</p>
                    <p style="margin: 5px 0; color: #721c24;">A meter-related issue has been detected. Please investigate and resolve promptly.</p>
                </div>
            </div>
        `;
    }

    static getGenericNotificationTemplate(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${notification.title}</h2>
                <p style="font-size: 16px; color: #666;">${notification.message}</p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold;">Notification Details:</p>
                    <p style="margin: 5px 0;">Type: ${notification.type}</p>
                    <p style="margin: 5px 0;">Priority: ${notification.priority}</p>
                    <p style="margin: 5px 0;">Created: ${new Date(notification.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `;
    }

    static getSystemMaintenanceTemplate(maintenanceData) {
        const { title, message, scheduledTime, duration, affectedServices } = maintenanceData;
        
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #856404;">🔧 System Maintenance: ${title}</h2>
                <p style="font-size: 16px; color: #666;">${message}</p>
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">Maintenance Details:</p>
                    <p style="margin: 5px 0; color: #856404;">Scheduled Time: ${scheduledTime}</p>
                    <p style="margin: 5px 0; color: #856404;">Duration: ${duration}</p>
                    ${affectedServices ? `<p style="margin: 5px 0; color: #856404;">Affected Services: ${affectedServices}</p>` : ''}
                </div>
            </div>
        `;
    }

    static getAlertTemplate(alertData) {
        const { alertType, location, severity, details, timestamp } = alertData;
        
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d9534f;">🚨 ${severity} Alert: ${alertType}</h2>
                <p style="font-size: 16px; color: #666;">Location: ${location}</p>
                <p style="font-size: 16px; color: #666;">${details}</p>
                <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
                    <p style="margin: 0; font-weight: bold; color: #721c24;">Alert Information:</p>
                    <p style="margin: 5px 0; color: #721c24;">Type: ${alertType}</p>
                    <p style="margin: 5px 0; color: #721c24;">Severity: ${severity}</p>
                    <p style="margin: 5px 0; color: #721c24;">Timestamp: ${timestamp}</p>
                </div>
            </div>
        `;
    }

    // Send power failure alert (exactly like TGNPDCL implementation)
    static async sendPowerFailureAlert(meterSerial, feederName, dtrName, powerData) {
        try {
            console.log(`🚨 [EMAIL] Starting power failure alert for meter ${meterSerial}`);

            // Check rate limiting
            const lastSent = this.lastEmailSent.get(meterSerial);
            if (lastSent && (Date.now() - lastSent.getTime()) < MIN_EMAIL_INTERVAL_MS) {
                console.log(`⏰ [EMAIL] Rate limit active for meter ${meterSerial}, skipping email`);
                return null;
            }

            const transporter = await getTransporter();
            if (!transporter) {
                throw new Error('Email transporter not available');
            }

            // Read email template
            const templatePath = path.join(__dirname, '../templates/emails/powerFailureAlert.html');
            let template = fs.readFileSync(templatePath, 'utf8');

            // Replace placeholders
            template = template.replace('<!-- DTR_NAME -->', dtrName);
            template = template.replace('<!-- FEEDER_NAME -->', feederName);
            template = template.replace('<!-- METER_SERIAL -->', meterSerial);
            template = template.replace('<!-- POWER_DATA -->', JSON.stringify(powerData, null, 2));

            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = ` ${day}-${month}-${year} at ${hours}:${minutes}:${seconds}`;

            template = template.replace('<!-- TIMESTAMP -->', timestamp);

            const mailOptions = {
                from: EMAIL_CONFIG.EMAIL_FROM || EMAIL_CONFIG.SMTP_USER,
                to: [
                    'madhu.bestinfra@gmail.com'
                    // 'kiran.bestinfra@gmail.com',
                    // 'Achantaster@gmail.com',
                    // 'cgmpmm@tsnpdcl.in',
                    // 'cmd@tsnpdcl.in',
                    // 'rao.gs@se.com'
                ],
                subject: `🚨 Critical Alert: Power Failure Detected for ${dtrName} (${feederName})`,
                html: template
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('📧 Power failure alert email sent successfully');

            // Send SMS alerts using integrated MSG91 (exactly like TGNPDCL)
            try {
                // Note: dtrName and feederName are now dtrNumber and meterNumber respectively
                await this.sendPowerFailureAlertSMS(dtrName, feederName, powerData);
                console.log('📱 Power failure alert SMS sent successfully');
            } catch (smsError) {
                console.error('❌ Failed to send SMS alert:', smsError);
            }

            this.lastEmailSent.set(meterSerial, now);
            return info;

        } catch (error) {
            console.error(`❌ Failed to send power failure alert for meter ${meterSerial}:`, error);
            throw error;
        }
    }

    // Send meter abnormality alert (exactly like TGNPDCL implementation)
    static async sendMeterAbnormalityAlert(meterSerial, feederName, dtrName, abnormalityType, powerData) {
        try {
            console.log(`🚨 [EMAIL] Starting meter abnormality alert for meter ${meterSerial}`);

            // Check rate limiting
            const lastSent = this.lastEmailSent.get(meterSerial);
            if (lastSent && (Date.now() - lastSent.getTime()) < MIN_EMAIL_INTERVAL_MS) {
                console.log(`⏰ [EMAIL] Rate limit active for meter ${meterSerial}, skipping email`);
                return null;
            }

            const transporter = await getTransporter();
            if (!transporter) {
                throw new Error('Email transporter not available');
            }

            // Read email template
            const templatePath = path.join(__dirname, '../templates/emails/meterAbnormalityAlert.html');
            let template = fs.readFileSync(templatePath, 'utf8');

            // Replace placeholders
            template = template.replace('<!-- DTR_NAME -->', dtrName);
            template = template.replace('<!-- FEEDER_NAME -->', feederName);
            template = template.replace('<!-- METER_SERIAL -->', meterSerial);
            template = template.replace('<!-- ABNORMALITY_TYPE -->', abnormalityType);
            template = template.replace('<!-- POWER_DATA -->', JSON.stringify(powerData, null, 2));

            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = ` ${day}-${month}-${year} at ${hours}:${minutes}:${seconds}`;

            template = template.replace('<!-- TIMESTAMP -->', timestamp);

            const mailOptions = {
                from: EMAIL_CONFIG.EMAIL_FROM || EMAIL_CONFIG.SMTP_USER,
                to: [
                    'madhu.bestinfra@gmail.com'
                    // 'kiran.bestinfra@gmail.com',
                    // 'Achantaster@gmail.com',
                    // 'cgmpmm@tsnpdcl.in',
                    // 'cmd@tsnpdcl.in',
                    // 'rao.gs@se.com'
                ],
                subject: `⚠️ Alert: Meter Abnormality Detected for ${dtrName} (${feederName})`,
                html: template
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('📧 Meter abnormality alert email sent successfully');

            // Send SMS alerts using integrated MSG91 (exactly like TGNPDCL)
            try {
                // Note: dtrName and feederName are now dtrNumber and meterNumber respectively
                await this.sendMeterAbnormalityAlertSMS(dtrName, feederName, abnormalityType, powerData);
                console.log('📱 Meter abnormality alert SMS sent successfully');
            } catch (smsError) {
                console.error('❌ Failed to send SMS alert:', smsError);
            }

            this.lastEmailSent.set(meterSerial, now);
            return info;

        } catch (error) {
            console.error(`❌ Failed to send meter abnormality alert for meter ${meterSerial}:`, error);
            throw error;
        }
    }

    static async sendPowerFailureAlertSMS(dtrNumber, meterNumber, powerData) {
        try {
            console.log('📱 [SMS] Starting power failure alert SMS...');
            
            const phoneNumbers = getAllEscalationPhoneNumbers();
            
            if (!phoneNumbers || phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in escalation levels');
            }
            
            console.log('📱 [SMS] Phone numbers to send SMS:', phoneNumbers);
            
            const recipients = phoneNumbers.map(phone => ({
                mobile: phone,
                var: dtrNumber,        // VAR1: DTR Number
                var1: meterNumber,     // VAR2: Meter Number
                    var2: 'Power Failure Detected',
                    var3: new Date().toLocaleString(),
                    DLT_TE_ID: MSG91_CONFIG.DLT_TE_ID
            }));

            console.log('📱 [SMS] Recipients prepared:', recipients);
            return await this.sendBulkSMS(MSG91_CONFIG.TEMPLATE_ID, recipients);
        } catch (error) {
            console.error('❌ Failed to send power failure alert SMS:', error);
            throw error;
        }
    }

    static async sendMeterAbnormalityAlertSMS(dtrNumber, meterNumber, abnormalityType, powerData) {
        try {
            console.log('📱 [SMS] Starting meter abnormality alert SMS...');
            
            const phoneNumbers = getAllEscalationPhoneNumbers();
            
            if (!phoneNumbers || phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in escalation levels');
            }
            
            console.log('📱 [SMS] Phone numbers to send SMS:', phoneNumbers);
            
            const recipients = phoneNumbers.map(phone => ({
                mobile: phone,
                var: dtrNumber,        // VAR1: DTR Number
                var1: meterNumber,     // VAR2: Meter Number
                    var2: `Abnormality: ${abnormalityType}`,
                    var3: new Date().toLocaleString(),
                    DLT_TE_ID: MSG91_CONFIG.DLT_TE_ID
            }));

            console.log('📱 [SMS] Recipients prepared:', recipients);
            return await this.sendBulkSMS(MSG91_CONFIG.TEMPLATE_ID, recipients);
        } catch (error) {
            console.error('❌ Failed to send meter abnormality alert SMS:', error);
            throw error;
        }
    }
}

export default EmailService;
