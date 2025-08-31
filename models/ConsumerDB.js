import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat } from '../utils/utils.js';

const prisma = new PrismaClient();

class ConsumerDB {
    static async getAllConsumers() {
        try {
            const consumers = await prisma.consumers.findMany({
                include: {
                    locations: true,
                    bills: {
                        include: {
                            meters: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return consumers;
        } catch (error) {
            console.error('ConsumerDB.getAllConsumers: Database error:', error);
            throw error;
        }
    }

    static async getConsumerByNumber(consumerNumber) {
        try {
                    return await prisma.consumers.findUnique({
            where: { consumerNumber },
            include: {
                locations: true,
                bills: {
                    include: {
                        meters: true
                    }
                }
            }
        });
        } catch (error) {
            console.error('ConsumerDB.getConsumerByNumber: Database error:', error);
            throw error;
        }
    }

    static async getDailyConsumption(meterId) {
        try {
            const consumptions = await prisma.meter_readings.findMany({
                where: { meterId },
                orderBy: { readingDate: 'asc' },
            });
            // Group by date (YYYY-MM-DD)
            const grouped = {};
            consumptions.forEach(c => {
                const date = getDateInYMDFormat(c.readingDate);
                if (!grouped[date]) grouped[date] = 0;
                grouped[date] += Number(c.consumption);
            });
            return Object.entries(grouped).map(([date, sum]) => ({ date, sum }));
        } catch (error) {
            console.error('ConsumerDB.getDailyConsumption: Database error:', error);
            throw error;
        }
    }

    static async getMonthlyConsumption(meterId) {
        try {
            const consumptions = await prisma.meter_readings.findMany({
                where: { meterId },
                orderBy: { readingDate: 'asc' },
            });
            // Group by month (YYYY-MM)
            const grouped = {};
            consumptions.forEach(c => {
                const d = c.readingDate;
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!grouped[month]) grouped[month] = 0;
                grouped[month] += Number(c.consumption);
            });
            return Object.entries(grouped).map(([month, sum]) => ({ month, sum }));
        } catch (error) {
            console.error('ConsumerDB.getMonthlyConsumption: Database error:', error);
            throw error;
        }
    }

    static async getPowerWidgets(meterSerial) {
        try {
            const meter = await prisma.meters.findUnique({
                where: { serialNumber: meterSerial },
                include: {
                    meter_readings: {
                        orderBy: { readingDate: 'desc' },
                        take: 1 // Get the latest reading
                    }
                }
            });

            if (!meter) {
                throw new Error('Meter not found');
            }

            const lastCommDate = meter.meter_readings && meter.meter_readings.length > 0 
                ? meter.meter_readings[0].readingDate 
                : null;

            const latestReading = meter.meter_readings && meter.meter_readings.length > 0 
                ? meter.meter_readings[0] 
                : null;

            const power = latestReading ? {
                id: latestReading.id,
                meterId: latestReading.meterId,
                readingDate: latestReading.readingDate,
                readingType: latestReading.readingType,
                readingSource: latestReading.readingSource,
                
                kWh: latestReading.kWh || 0,
                kVAh: latestReading.kVAh || 0,
                kVARh: latestReading.kVARh || 0,
                
                powerFactor: latestReading.powerFactor || 0,
                averagePF: latestReading.averagePF || 0,
                minimumPF: latestReading.minimumPF || 0,
                
                voltageR: latestReading.voltageR || 0,
                voltageY: latestReading.voltageY || 0,
                voltageB: latestReading.voltageB || 0,
                averageVoltage: latestReading.averageVoltage || 0,
                
                currentR: latestReading.currentR || 0,
                currentY: latestReading.currentY || 0,
                currentB: latestReading.currentB || 0,
                averageCurrent: latestReading.averageCurrent || 0,
                
                isValid: latestReading.isValid,
                validatedBy: latestReading.validatedBy,
                validatedAt: latestReading.validatedAt,
                
                billId: latestReading.billId,
                
                createdAt: latestReading.createdAt,
                updatedAt: latestReading.updatedAt
            } : {};

            return {
                lastCommDate,
                power
            };
        } catch (error) {
            console.error('ConsumerDB.getPowerWidgets: Database error:', error);
            throw error;
        }
    }

    static async getConsumerHistory(consumerNumber) {
        try {
            const consumer = await prisma.consumers.findUnique({
                where: { consumerNumber },
                include: {
                    locations: true,
                    bills: {
                        include: {
                            meters: {
                                include: {
                                    meter_configurations: true,
                                    locations: true,
                                    dtrs: true,
                                    meter_readings: {
                                        orderBy: { readingDate: 'desc' },
                                        take: 10
                                    }
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    },
                    notifications: {
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    }
                }
            });

            if (!consumer) {
                throw new Error('Consumer not found');
            }

            const consumerHistory = {
                consumer: {
                    id: consumer.id,
                    consumerNumber: consumer.consumerNumber,
                    name: consumer.name,
                    email: consumer.email,
                    primaryPhone: consumer.primaryPhone,
                    alternatePhone: consumer.alternatePhone,
                    idType: consumer.idType,
                    idNumber: consumer.idNumber,
                    connectionType: consumer.connectionType,
                    category: consumer.category,
                    sanctionedLoad: consumer.sanctionedLoad,
                    connectionDate: consumer.connectionDate,
                    billingCycle: consumer.billingCycle,
                    billDeliveryMode: consumer.billDeliveryMode,
                    defaultPaymentMethod: consumer.defaultPaymentMethod,
                    creditScore: consumer.creditScore,
                    createdAt: consumer.createdAt,
                    updatedAt: consumer.updatedAt,
                    location: consumer.location
                },
                meters: consumer.bills.flatMap(bill => bill.meters ? [bill.meters] : []).map(meter => ({
                    id: meter.id,
                    meterNumber: meter.meterNumber,
                    serialNumber: meter.serialNumber,
                    manufacturer: meter.manufacturer,
                    model: meter.model,
                    type: meter.type,
                    phase: meter.phase,
                    status: meter.status,
                    isInUse: meter.isInUse,
                    installationDate: meter.installationDate,
                    lastMaintenanceDate: meter.lastMaintenanceDate,
                    decommissionDate: meter.decommissionDate,
                    config: meter.meter_configurations,
                    location: meter.locations,
                    dtr: meter.dtrs,
                    readings: meter.meter_readings
                })),
                bills: consumer.bills,
                notifications: consumer.notifications,
                tickets: consumer.tickets
            };

            return consumerHistory;
        } catch (error) {
            console.error('ConsumerDB.getConsumerHistory: Database error:', error);
            throw error;
        }
    }

    static async addConsumer(consumerData) {
        try {
            // Validate required fields
            const requiredFields = [
                'consumerNumber', 'name', 'primaryPhone', 'idType', 'idNumber',
                'connectionType', 'category', 'sanctionedLoad', 'connectionDate',
                'billingCycle', 'locationId'
            ];
            
            for (const field of requiredFields) {
                if (!consumerData[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            // Check if consumer number already exists
            const existingConsumer = await prisma.consumers.findUnique({
                where: { consumerNumber: consumerData.consumerNumber }
            });
            if (existingConsumer) {
                throw new Error('Consumer number already exists');
            }

            // Check if location exists
            const location = await prisma.location.findUnique({
                where: { id: parseInt(consumerData.locationId) }
            });
            if (!location) {
                throw new Error('Location not found');
            }

            // Create consumer with all related data
            const newConsumer = await prisma.consumers.create({
                data: {
                    consumerNumber: consumerData.consumerNumber,
                    name: consumerData.name,
                    email: consumerData.email || null,
                    primaryPhone: consumerData.primaryPhone,
                    alternatePhone: consumerData.alternatePhone || null,
                    idType: consumerData.idType,
                    idNumber: consumerData.idNumber,
                    connectionType: consumerData.connectionType,
                    category: consumerData.category,
                    sanctionedLoad: parseFloat(consumerData.sanctionedLoad),
                    connectionDate: new Date(getDateInYMDFormat(new Date(consumerData.connectionDate))),
                    locationId: parseInt(consumerData.locationId),
                    billingCycle: consumerData.billingCycle,
                    billDeliveryMode: consumerData.billDeliveryMode || [],
                    defaultPaymentMethod: consumerData.defaultPaymentMethod || null,
                    creditScore: consumerData.creditScore ? parseInt(consumerData.creditScore) : null,
                    
                    // Create related meters if provided
                    meters: consumerData.meters ? {
                        create: consumerData.meters.map(meter => ({
                            meterNumber: meter.meterNumber,
                            serialNumber: meter.serialNumber,
                            manufacturer: meter.manufacturer,
                            model: meter.model,
                            type: meter.type,
                            phase: parseInt(meter.phase),
                            status: meter.status || 'ACTIVE',
                            isInUse: meter.isInUse !== undefined ? meter.isInUse : true,
                            installationDate: new Date(getDateInYMDFormat(new Date(meter.installationDate))),
                            lastMaintenanceDate: meter.lastMaintenanceDate ? new Date(getDateInYMDFormat(new Date(meter.lastMaintenanceDate))) : null,
                            decommissionDate: meter.decommissionDate ? new Date(getDateInYMDFormat(new Date(meter.decommissionDate))) : null,
                            locationId: parseInt(meter.locationId),
                            dtrId: meter.dtrId ? parseInt(meter.dtrId) : null,
                            
                            // Create meter configuration if provided
                            config: meter.config ? {
                                create: {
                                    ctRatio: meter.config.ctRatio,
                                    ctRatioPrimary: parseFloat(meter.config.ctRatioPrimary),
                                    ctRatioSecondary: parseFloat(meter.config.ctRatioSecondary),
                                    adoptedCTRatio: meter.config.adoptedCTRatio || null,
                                    ctAccuracyClass: meter.config.ctAccuracyClass || null,
                                    ctBurden: meter.config.ctBurden ? parseFloat(meter.config.ctBurden) : null,
                                    ptRatio: meter.config.ptRatio,
                                    ptRatioPrimary: parseFloat(meter.config.ptRatioPrimary),
                                    ptRatioSecondary: parseFloat(meter.config.ptRatioSecondary),
                                    adoptedPTRatio: meter.config.adoptedPTRatio || null,
                                    ptAccuracyClass: meter.config.ptAccuracyClass || null,
                                    ptBurden: meter.config.ptBurden ? parseFloat(meter.config.ptBurden) : null,
                                    mf: parseFloat(meter.config.mf),
                                    vmf: parseFloat(meter.config.vmf),
                                    cmf: parseFloat(meter.config.cmf)
                                }
                            } : undefined,
                            
                            // Create current transformers if provided
                            currentTransformers: meter.currentTransformers ? {
                                create: meter.currentTransformers.map(ct => ({
                                    ratio: ct.ratio,
                                    accuracy: ct.accuracy || null,
                                    burden: ct.burden ? parseFloat(ct.burden) : null
                                }))
                            } : undefined,
                            
                            // Create potential transformers if provided
                            potentialTransformers: meter.potentialTransformers ? {
                                create: meter.potentialTransformers.map(pt => ({
                                    ratio: pt.ratio,
                                    accuracy: pt.accuracy || null,
                                    burden: pt.burden ? parseFloat(pt.burden) : null
                                }))
                            } : undefined
                        }))
                    } : undefined,
                    
                    // Create documents if provided
                    documents: consumerData.documents ? {
                        create: consumerData.documents.map(doc => ({
                            type: doc.type,
                            url: doc.url
                        }))
                    } : undefined
                },
                include: {
                    location: true,
                    meters: {
                        include: {
                            config: true,
                            location: true,
                            dtr: true,
                            currentTransformers: true,
                            potentialTransformers: true
                        }
                    },
                    documents: true
                }
            });

            return newConsumer;
        } catch (error) {
            console.error('❌ ConsumerDB.addConsumer: Database error:', error);
            throw error;
        }
    }


}

export default ConsumerDB; 