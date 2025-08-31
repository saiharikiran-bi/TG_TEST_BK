// Abnormality detection utilities (exactly like TGNPDCL_Backend)
// These functions check for various meter abnormalities based on power readings

/**
 * Check if a value is effectively zero (very close to 0)
 * @param {number|string} value - The value to check
 * @returns {boolean} - True if value is effectively zero
 */
export const isZero = (value) => {
    if (value === null || value === undefined || value === '') return true;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return Math.abs(numValue) < 0.001;
};

/**
 * Check if a value is negative
 * @param {number|string} value - The value to check
 * @returns {boolean} - True if value is negative
 */
export const isNegative = (value) => {
    if (value === null || value === undefined || value === '') return false;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue < 0;
};

/**
 * Check if there's a load imbalance based on neutral current
 * @param {number|string} neutralCurrent - The neutral current value
 * @returns {boolean} - True if load is imbalanced
 */
export const isLoadImbalance = (neutralCurrent) => {
    if (neutralCurrent === null || neutralCurrent === undefined || neutralCurrent === '') return false;
    const numValue = typeof neutralCurrent === 'string' ? parseFloat(neutralCurrent) : neutralCurrent;
    return numValue > 15;
};

/**
 * Check if power factor is low
 * @param {number|string} powerFactor - The power factor value
 * @returns {boolean} - True if power factor is low
 */
export const isLowPowerFactor = (powerFactor) => {
    if (powerFactor === null || powerFactor === undefined || powerFactor === '') return false;
    const numValue = typeof powerFactor === 'string' ? parseFloat(powerFactor) : powerFactor;
    return numValue >= -0.8 && numValue <= 0.8;
};

/**
 * Check if voltage is low (below 180V)
 * @param {number|string} voltage - The voltage value
 * @returns {boolean} - True if voltage is low
 */
export const isLowVoltage = (voltage) => {
    if (voltage === null || voltage === undefined || voltage === '') return false;
    const numValue = typeof voltage === 'string' ? parseFloat(voltage) : voltage;
    return numValue < 180;
};

/**
 * Analyze meter readings for abnormalities
 * @param {Object} reading - The meter reading object
 * @returns {Object} - Object containing all detected abnormalities
 */
export const analyzeMeterReadings = (reading) => {
    const abnormalities = {
        // Power Factor Issues
        'Meter Power Fail (R - Phase)': isZero(reading.rphPowerFactor || reading.powerFactor),
        'Meter Power Fail (Y - Phase)': isZero(reading.yphPowerFactor),
        'Meter Power Fail (B - Phase)': isZero(reading.bphPowerFactor),
        
        // Phase Missing Issues
        'R_PH Missing': isZero(reading.voltageR),
        'Y_PH Missing': isZero(reading.voltageY),
        'B_PH Missing': isZero(reading.voltageB),
        
        // Current Issues (LT Fuse Blown)
        'LT Fuse Blown (R - Phase)': isZero(reading.currentR),
        'LT Fuse Blown (Y - Phase)': isZero(reading.currentY),
        'LT Fuse Blown (B - Phase)': isZero(reading.currentB),
        
        // CT Reversed Issues
        'R_PH CT Reversed': isNegative(reading.currentR),
        'Y_PH CT Reversed': isNegative(reading.currentY),
        'B_PH CT Reversed': isNegative(reading.currentB),
        
        // Load Imbalance
        'Unbalanced Load': isLoadImbalance(reading.neutralCurrent),
        
        // Low Power Factor Issues
        'Low PF (R - Phase)': isLowPowerFactor(reading.rphPowerFactor || reading.powerFactor),
        'Low PF (Y - Phase)': isLowPowerFactor(reading.yphPowerFactor),
        'Low PF (B - Phase)': isLowPowerFactor(reading.bphPowerFactor),
        
        // HT Fuse Blown (Low Voltage)
        'HT Fuse Blown (R - Phase)': isLowVoltage(reading.voltageR),
        'HT Fuse Blown (Y - Phase)': isLowVoltage(reading.voltageY),
        'HT Fuse Blown (B - Phase)': isLowVoltage(reading.voltageB),
    };

    return abnormalities;
};

/**
 * Check if any abnormalities are detected
 * @param {Object} abnormalities - The abnormalities object
 * @returns {boolean} - True if any abnormalities exist
 */
export const hasAbnormalities = (abnormalities) => {
    return Object.values(abnormalities).some(value => value === true);
};

/**
 * Get a summary of detected abnormalities
 * @param {Object} abnormalities - The abnormalities object
 * @returns {Array} - Array of abnormality descriptions
 */
export const getAbnormalitySummary = (abnormalities) => {
    return Object.entries(abnormalities)
        .filter(([_, isDetected]) => isDetected)
        .map(([abnormalityType, _]) => abnormalityType);
};

/**
 * Format power data for alert messages
 * @param {Object} reading - The meter reading object
 * @returns {Object} - Formatted power data for alerts
 */
export const formatPowerDataForAlerts = (reading) => {
    return {
        powerFactor: reading.powerFactor || '0.000',
        pfYPh: reading.yphPowerFactor || '0.000',
        pfBPh: reading.bphPowerFactor || '0.000',
        vRPh: reading.voltageR || '0.000',
        vYPh: reading.voltageY || '0.000',
        vBPh: reading.voltageB || '0.000',
        cRPh: reading.currentR || '0.000',
        cYPh: reading.currentY || '0.000',
        cBPh: reading.currentB || '0.000',
        neutral_current: reading.neutralCurrent || '0.000',
        frequency: reading.frequency || '0.000',
        tamper_datetime: reading.readingDate || new Date().toISOString()
    };
};

/**
 * Convert date to IST format for email alerts
 * @param {string|Date} dateString - The date to convert
 * @returns {string} - Formatted date string
 */
export const convertToISTMail = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Generate error signature for tracking duplicate alerts
 * @param {Object} abnormalities - The abnormalities object
 * @param {Object} powerData - The power data object
 * @returns {string} - Error signature string
 */
export const generateErrorSignature = (abnormalities, powerData) => {
    let signature = '';

    const sortedKeys = Object.keys(abnormalities).sort();
    
    for (const key of sortedKeys) {
        if (abnormalities[key] === true) {
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
};
