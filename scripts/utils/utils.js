// Date utility functions for backend usage

// Returns current date in YYYY-MM-DD format
export function getDateInYMDFormat(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Returns current date and time in YYYY-MM-DD HH:mm:ss format
export function getDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Adds days to current date and returns YYYY-MM-DD
export function getBillPayDate(daysToAdd = 5) {
    const currentDate = new Date();
    const millisecondsToAdd = daysToAdd * 24 * 60 * 60 * 1000;
    const billPayDate = new Date(currentDate.getTime() + millisecondsToAdd);
    return getDateInYMDFormat(billPayDate);
}

// Formats a date as DD-MM-YYYY
export function formatDateDMY(date = new Date()) {
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Generates an invoice number with date and time
export function generateInvoiceNumber() {
    const prefix = 'INV';
    const now = new Date();
    const isoString = now.toISOString();
    const datePart = isoString.slice(0, 10).replace(/-/g, '');
    const timePart = isoString.slice(11, 19).replace(/:/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${datePart.substring(2)}${timePart}${randomPart}`;
}

// Generates a bill number for a specific billing period
export function generateBillNumber(meterNumber, billingDate) {
    const year = billingDate.getFullYear();
    const month = String(billingDate.getMonth() + 1).padStart(2, '0');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `BILL-${year}${month}-${meterNumber}-${randomPart}`;
}

// Convert consumer category enum to integer for tariff lookup
export function getCategoryInt(category) {
    const categoryMapping = {
        'DOMESTIC': 0,
        'SMALL_COMMERCIAL': 3,  // Based on your tariff data
        'LARGE_COMMERCIAL': 2,
        'INDUSTRIAL': 1,
        'AGRICULTURAL': 4,
        'GOVERNMENT': 5
    };
    
    if (typeof category === 'string') {
        return categoryMapping[category] || parseInt(category) || 0;
    }
    
    return category || 0;
}

// Get category name from integer
export function getCategoryName(categoryInt) {
    const categoryNames = {
        0: 'DOMESTIC',
        3: 'SMALL_COMMERCIAL',  // Based on your tariff data
        2: 'LARGE_COMMERCIAL',
        1: 'INDUSTRIAL',
        4: 'AGRICULTURAL',
        5: 'GOVERNMENT'
    };
    
    return categoryNames[categoryInt] || 'UNKNOWN';
} 

// Returns date in MM-YYYY format
export function getDateInMYFormat(date = new Date()) {
    // Handle string dates (YYYY-MM format)
    if (typeof date === 'string') {
        const parts = date.split('-');
        if (parts.length >= 2) {
            const month = parts[1];
            const year = parts[0];
            return `${month}-${year}`;
        }
    }
    
    // Handle Date objects
    if (date instanceof Date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}-${year}`;
    }
    
    // Fallback for other cases
    return '01-2024';
}

// Fills missing dates in data for charts
export function fillMissingDatesDyno(dates, values, format = 'DD MMM, YYYY', type = 'day') {
    if (!dates || !values || dates.length === 0) {
        return { dates: [], values: [] };
    }

    const result = { dates: [], values: [] };
    
    // For now, return the original data
    // This function can be enhanced later for proper date filling
    result.dates = dates;
    result.values = values;
    
    return result;
}

// Generates a ticket number with prefix and sequential numbering
export function generateTicketNumber(count) {
    return `TCKT-${String(count + 1).padStart(4, '0')}`;
} 