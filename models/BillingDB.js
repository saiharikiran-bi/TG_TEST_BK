import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat, generateBillNumber, getCategoryInt } from '../utils/utils.js';

const prisma = new PrismaClient();

class BillingDB {
    static async getPostpaidBillingStats() {
        try {
            const bills = await prisma.bills.findMany({
                include: {
                    consumers: true,
                    meters: true,
                    payments: true
                }
            });

            const totalBills = bills.length;
            const totalAmount = bills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);
            
            const outstandingAmount = bills.reduce((sum, bill) => {
                const totalPaid = bill.payments.reduce((paymentSum, payment) => 
                    paymentSum + Number(payment.amount || 0), 0);
                const outstanding = Number(bill.totalAmount || 0) - totalPaid;
                return sum + (outstanding > 0 ? outstanding : 0);
            }, 0);
            
            const overdueAmount = bills.reduce((sum, bill) => {
                const totalPaid = bill.payments.reduce((paymentSum, payment) => 
                    paymentSum + Number(payment.amount || 0), 0);
                const outstanding = Number(bill.totalAmount || 0) - totalPaid;
                const isOverdue = bill.dueDate < new Date(getDateInYMDFormat()) && outstanding > 0;
                return sum + (isOverdue ? outstanding : 0);
            }, 0);
            
            const paidAmount = bills.reduce((sum, bill) => {
                const totalPaid = bill.payments.reduce((paymentSum, payment) => 
                    paymentSum + Number(payment.amount || 0), 0);
                return sum + totalPaid;
            }, 0);

            const realizationPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

            
            const pendingCount = bills.filter(bill => bill.status === 'GENERATED').length;
            const overdueCount = bills.filter(bill => {
                const totalPaid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                const outstanding = Number(bill.totalAmount || 0) - totalPaid;
                return bill.dueDate < new Date(getDateInYMDFormat()) && outstanding > 0;
            }).length;
            const paidCount = bills.filter(bill => {
                const totalPaid = bill.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                return totalPaid >= Number(bill.totalAmount || 0);
            }).length;

            const stats = {
                totalBills,
                totalAmount: Number(totalAmount.toFixed(2)),
                outstandingAmount: Number(outstandingAmount.toFixed(2)),
                overdueAmount: Number(overdueAmount.toFixed(2)),
                paidAmount: Number(paidAmount.toFixed(2)),
                realizationPercentage: Number(realizationPercentage.toFixed(2)),
                pendingCount,
                overdueCount,
                paidCount
            };
            
            return stats;
        } catch (error) {
            console.error(' BillingDB.getPostpaidBillingStats: Database error:', error);
            throw error;
        }
    }

    static async getPostpaidBillingTable(page = 1, limit = 10, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const whereClause = {};

            if (filters.status) {
                whereClause.status = filters.status;
            }

            if (filters.consumerNumber) {
                whereClause.consumers = {
                    consumerNumber: {
                        contains: filters.consumerNumber,
                        mode: 'insensitive'
                    }
                };
            }

            if (filters.billNumber) {
                whereClause.billNumber = {
                    contains: filters.billNumber,
                    mode: 'insensitive'
                };
            }

            const totalCount = await prisma.bills.count({
                where: whereClause
            });

            const bills = await prisma.bills.findMany({
                where: whereClause,
                include: {
                    consumers: {
                        select: {
                            consumerNumber: true,
                            name: true,
                            primaryPhone: true,
                            email: true
                        }
                    },
                    meters: {
                        select: {
                            serialNumber: true,
                            type: true
                        }
                    },
                    payments: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            const billingData = bills.map(bill => {
                const totalAmount = Number(bill.totalAmount || 0);
                const paidAmount = bill.payments.reduce((sum, payment) => 
                    sum + Number(payment.amount || 0), 0);
                const outstandingAmount = totalAmount - paidAmount;
                
                let daysOverdue = 0;
                if (bill.dueDate && outstandingAmount > 0) {
                    const dueDate = new Date(bill.dueDate);
                    const today = new Date();
                    daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                }

                return {
                    id: bill.id,
                    billNumber: bill.billNumber,
                    consumerNumber: bill.consumers?.consumerNumber,
                    consumerName: bill.consumers?.name,
                    consumerPhone: bill.consumers?.primaryPhone,
                    consumerEmail: bill.consumers?.email,
                    meterSerial: bill.meters?.serialNumber,
                    meterType: bill.meters?.type,
                    billingPeriod: `${bill.billMonth}/${bill.billYear}`,
                    dueDate: bill.dueDate,
                    totalAmount,
                    paidAmount,
                    outstandingAmount,
                    status: bill.status,
                    daysOverdue,
                    createdAt: bill.createdAt,
                    updatedAt: bill.updatedAt
                };
            });

            const totalPages = Math.ceil(totalCount / limit);

            const result = {
                data: billingData,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
            return result;
        } catch (error) {
            console.error('BillingDB.getPostpaidBillingTable: Database error:', error);
            throw error;
        }
    }

    static async getBillById(billId) {
        try {
            return await prisma.bills.findUnique({
                where: { id: billId },
                include: {
                    consumers: {
                        include: {
                            locations: true
                        }
                    },
                    meters: {
                        include: {
                            locations: true,
                            dtrs: true
                        }
                    },
                    payments: true
                }
            });
        } catch (error) {
            console.error('BillingDB.getBillById: Database error:', error);
            throw error;
        }
    }

    static async getBillsByConsumerId(consumerId) {
        try {
            return await prisma.bills.findMany({
                where: { consumerId },
                include: {
                    meters: {
                        select: {
                            serialNumber: true,
                            type: true
                        }
                    },
                    payments: true
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            console.error('BillingDB.getBillsByConsumerId: Database error:', error);
            throw error;
        }
    }

    static async getLastBillByConsumerId(consumerId) {
        try {
            return await prisma.bills.findFirst({
                where: { consumerId },
                include: {
                    meters: {
                        select: {
                            serialNumber: true,
                            type: true
                        }
                    },
                    payments: true
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            console.error('BillingDB.getLastBillByConsumerId: Database error:', error);
            throw error;
        }
    }

    static async updateBillStatus(billId, status) {
        try {
            return await prisma.bills.update({
                where: { id: billId },
                data: { 
                    status,
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('BillingDB.updateBillStatus: Database error:', error);
            throw error;
        }
    }

    static async createBill(billData) {
        try {
            return await prisma.bills.create({
                data: billData,
                include: {
                    consumers: true,
                    meters: true
                }
            });
        } catch (error) {
            console.error('BillingDB.createBill: Database error:', error);
            throw error;
        }
    }

    static async generateMonthlyBills() {
        try {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

            let previousMonth = currentMonth - 1;
            let previousYear = currentYear;

            if (previousMonth === 0) {
                previousMonth = 12;
                previousYear -= 1;
            }

            const previousMonthFormatted = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;

            const startOfMonth = new Date(previousYear, previousMonth - 1, 1);
            const endOfMonth = new Date(previousYear, previousMonth, 0);
            const dueDate = new Date(currentYear, currentMonth - 1, 9);

            // Get all active meters with their consumers
            const meters = await prisma.meters.findMany({
                where: {
                    status: 'ACTIVE',
                    isInUse: true
                },
                include: {
                    consumers: true,
                    meter_readings: {
                        where: {
                            readingDate: {
                                gte: startOfMonth,
                                lte: endOfMonth
                            }
                        },
                        orderBy: {
                            readingDate: 'asc'
                        }
                    }
                }
            });

            const generatedBills = [];

            for (const meter of meters) {
                try {
                    // Convert consumer category enum to integer for tariff lookup
                    const categoryInt = getCategoryInt(meter.consumers.category);
                    
                    // Get tariff settings for the consumer category
                    const tariff = await prisma.tariff.findFirst({
                        where: {
                            category: categoryInt,
                            type: {
                                mode: 'insensitive',
                                equals: meter.type.toLowerCase()
                            },
                            valid_from: {
                                lte: startOfMonth
                            },
                            OR: [
                                { valid_to: null },
                                { valid_to: { gte: endOfMonth } }
                            ]
                        },
                        orderBy: {
                            created_at: 'desc'
                        }
                    });

                    if (!tariff) {
                        console.warn(`⚠️ [BILLING] No tariff found for meter ${meter.meterNumber} with category ${meter.consumers.category}`);
                        continue;
                    }

                    // Get meter readings for the billing period
                    const readings = meter.meter_readings;
                    
                    if (readings.length === 0) {
                        console.warn(`⚠️ [BILLING] No readings found for meter ${meter.meterNumber}`);
                        continue;
                    }

                    let openingUnits = 0;
                    let closingUnits = 0;
                    let unitsConsumed = 0;

                    if (readings.length === 1) {
                        // Single reading - use it as closing reading and estimate opening
                        const singleReading = readings[0];
                        closingUnits = singleReading.kVAh || 0;
                        
                        // Try to get previous month's last reading as opening
                        const previousMonth = new Date(startOfMonth);
                        previousMonth.setMonth(previousMonth.getMonth() - 1);
                        
                        const previousReadings = await prisma.meter_readings.findMany({
                            where: {
                                meterId: meter.id,
                                readingDate: {
                                    gte: new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1),
                                    lte: new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)
                                }
                            },
                            orderBy: {
                                readingDate: 'desc'
                            },
                            take: 1
                        });

                        if (previousReadings.length > 0) {
                            openingUnits = previousReadings[0].kVAh || 0;
                        } else {
                            // No previous reading, estimate based on consumption pattern
                            // For now, assume 80% of current reading as opening
                            openingUnits = closingUnits * 0.8;
                        }
                        
                        unitsConsumed = parseFloat((closingUnits - openingUnits).toFixed(2));
                    } else {
                        // Multiple readings - use first and last
                        const firstReading = readings[0];
                        const lastReading = readings[readings.length - 1];

                        openingUnits = firstReading.kVAh || 0;
                        closingUnits = lastReading.kVAh || 0;
                        unitsConsumed = parseFloat((closingUnits - openingUnits).toFixed(2));
                    }

                    if (unitsConsumed <= 0) {
                        console.warn(`⚠️ [BILLING] Invalid consumption for meter ${meter.meterNumber}: ${unitsConsumed}`);
                        continue;
                    }

                    // Calculate demand charges
                    let recordedMD = 0;
                    
                    if (readings.length === 1) {
                        // Use the single reading for demand calculation
                        recordedMD = readings[0].kVA || 0;
                    } else {
                        // Use the last reading for demand calculation
                        recordedMD = readings[readings.length - 1].kVA || 0;
                    }
                    
                    const contractMD = meter.consumers.sanctionedLoad;
                    const minBillingDemand = contractMD * 0.8;
                    
                    const demandPenaltyFlag = recordedMD > minBillingDemand;
                    const billedMD = demandPenaltyFlag ? recordedMD : minBillingDemand;



                    let demandCharge = 0;
                    let demandPenaltyCharge = 0;

                    // Only calculate demand charges if tariff has demand charges configured
                    if (tariff.min_demand > 0) {
                        if (!demandPenaltyFlag) {
                            demandCharge = billedMD * tariff.min_demand_unit_rate;
                        } else if (billedMD <= contractMD) {
                            demandCharge = billedMD * tariff.min_demand_unit_rate;
                        } else {
                            demandCharge = contractMD * tariff.min_demand_unit_rate;
                            demandPenaltyCharge = (billedMD - contractMD) * tariff.min_demand_excess_unit_rate;
                        }
                    }

                    const totalDemandCharge = demandCharge + demandPenaltyCharge;

                    // Calculate energy charges based on dynamic slabs
                    let unitRate = tariff.base_unit_rate;
                    
                    // Determine which slab to use based on consumption or demand
                    let slabDeterminer = 0;
                    
                    if (tariff.min_demand > 0) {
                        // Use demand (kVA) for slab determination when demand charges exist
                        slabDeterminer = recordedMD;
                    } else {
                        // Use consumption (kVAh) for slab determination when no demand charges
                        slabDeterminer = unitsConsumed;
                    }
                    
                    // Dynamic slab calculation - fetch slabs from tariff_slabs table
                    
                    const tariffSlabs = await prisma.tariff_slabs.findMany({
                        where: {
                            tariff_id: tariff.id
                        },
                        orderBy: {
                            slab_order: 'asc'
                        }
                    });
                    
                    const slabs = tariffSlabs.map(slab => {
                        const slabLimit = tariff.min_demand > 0 ? 
                            (slab.unit_limit / 100) * contractMD : slab.unit_limit;
                        
                        return {
                            name: `Slab${slab.slab_order}`,
                            limit: slabLimit,
                            rate: slab.unit_rate,
                            originalLimit: slab.unit_limit,
                            order: slab.slab_order
                        };
                    });
                    
                    // Log each slab
                    slabs.forEach(slab => {
                    });
                    
                    
                    // Determine which slab to use
                    let selectedSlab = null;
                    for (const slab of slabs) {
                        if (slabDeterminer <= slab.limit) {
                            selectedSlab = slab;
                            break;
                        }
                    }
                    
                    // If no slab matches, use the last slab (highest tier) or base rate
                    if (!selectedSlab && slabs.length > 0) {
                        selectedSlab = slabs[slabs.length - 1];
                    }
                    
                    if (selectedSlab) {
                        unitRate = selectedSlab.rate;
                    }

                    const energyCharge = parseFloat((unitsConsumed * unitRate).toFixed(2));
                    const electricityDutyCharge = parseFloat((unitsConsumed * tariff.elec_duty_unit_rate).toFixed(2));
                    const imsCharge = parseFloat((unitsConsumed * unitRate * (tariff.ims / 100)).toFixed(2));
                    const gstCharge = parseFloat(((energyCharge + electricityDutyCharge + imsCharge) * (tariff.gst / 100)).toFixed(2));

                    const subTotal = energyCharge + electricityDutyCharge + imsCharge + totalDemandCharge;
                    const totalAmount = subTotal + gstCharge;

                    // Generate bill number
                    const billNumber = generateBillNumber(meter.meterNumber, startOfMonth);

                    // Check if bill already exists
                    const existingBill = await prisma.bills.findFirst({
                        where: {
                            meterId: meter.id,
                            billMonth: previousMonth,
                            billYear: previousYear
                        }
                    });

                    if (existingBill) {
                        console.warn(`⚠️ [BILLING] Bill already exists for meter ${meter.meterNumber} for ${previousMonth}/${previousYear}`);
                        continue;
                    }

                    // Create bill data
                    const billData = {
                        billNumber,
                        meterId: meter.id,
                        consumerId: meter.consumers.id,
                        billMonth: previousMonth,
                        billYear: previousYear,
                        fromDate: startOfMonth,
                        toDate: endOfMonth,
                        dueDate,
                        previousReading: openingUnits,
                        currentReading: closingUnits,
                        unitsConsumed,
                        fixedCharge: totalDemandCharge,
                        energyCharge,
                        powerFactorCharge: 0, // Can be calculated if power factor data is available
                        otherCharges: {
                            electricityDuty: electricityDutyCharge,
                            ims: imsCharge,
                            gst: gstCharge,
                            demandPenalty: demandPenaltyCharge
                        },
                        subTotal,
                        taxes: {
                            gst: gstCharge
                        },
                        totalAmount,
                        status: 'GENERATED',
                        isPaid: false,
                        paidAmount: 0,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    const newBill = await prisma.bills.create({
                        data: billData,
                        include: {
                            consumers: true,
                            meters: true
                        }
                    });

                    generatedBills.push(newBill);

                } catch (error) {
                    console.error(`❌ [BILLING] Error generating bill for meter ${meter.meterNumber}:`, error);
                    console.error(`   🔍 [BILLING] Error details:`, error.message);
                }
            }

            const totalAmount = generatedBills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);

            return {
                success: true,
                message: `Generated ${generatedBills.length} bills for ${previousMonth}/${previousYear}`,
                bills: generatedBills
            };

        } catch (error) {
            console.error('BillingDB.generateMonthlyBills: Error generating bills:', error);
            throw error;
        }
    }

    
}

export default BillingDB; 