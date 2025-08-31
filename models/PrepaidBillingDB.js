import { PrismaClient } from '@prisma/client';
import { getDateInYMDFormat } from '../utils/utils.js';

const prisma = new PrismaClient();

class PrepaidBillingDB {
    static async getPrepaidBillingStats() {
        try {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const prepaidAccounts = await prisma.prepaid_accounts.findMany();

            const todayRecharges = await prisma.prepaid_recharges.findMany({
                where: {
                    createdAt: {
                        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                    },
                    paymentStatus: 'SUCCESS'
                }
            });

            const yesterdayRecharges = await prisma.prepaid_recharges.findMany({
                where: {
                    createdAt: {
                        gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
                        lt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
                    },
                    paymentStatus: 'SUCCESS'
                }
            });

            const todayTransactions = await prisma.prepaid_transactions.findMany({
                where: {
                    createdAt: {
                        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                    },
                    transactionType: 'CONSUMPTION',
                    status: 'COMPLETED'
                }
            });

            const yesterdayTransactions = await prisma.prepaid_transactions.findMany({
                where: {
                    createdAt: {
                        gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
                        lt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
                    },
                    transactionType: 'CONSUMPTION',
                    status: 'COMPLETED'
                }
            });

            const todayAlerts = await prisma.prepaid_alerts.findMany({
                where: {
                    createdAt: {
                        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
                    }
                }
            });

            const yesterdayAlerts = await prisma.prepaid_alerts.findMany({
                where: {
                    createdAt: {
                        gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
                        lt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
                    }
                }
            });

            const cumulativeCurrentBalance = prepaidAccounts.reduce((sum, account) => 
                sum + Number(account.currentBalance || 0), 0);

            const lowBalanceConsumers = prepaidAccounts.filter(account => 
                Number(account.currentBalance || 0) < 100).length;

            const adhocCreditIssued = prepaidAccounts.reduce((sum, account) => 
                sum + Number(account.totalRecharged || 0), 0);

            const adhocCreditRecovered = prepaidAccounts.reduce((sum, account) => 
                sum + Number(account.totalConsumed || 0), 0);

            const todayTotalRecharge = todayRecharges.reduce((sum, recharge) => 
                sum + Number(recharge.amount || 0), 0);

            const yesterdayTotalRecharge = yesterdayRecharges.reduce((sum, recharge) => 
                sum + Number(recharge.amount || 0), 0);

            const todayUnitsConsumed = todayTransactions.reduce((sum, transaction) => 
                sum + Number(transaction.consumptionKWh || 0), 0);

            const yesterdayUnitsConsumed = yesterdayTransactions.reduce((sum, transaction) => 
                sum + Number(transaction.consumptionKWh || 0), 0);

            const todayAmountDeducted = todayTransactions.reduce((sum, transaction) => 
                sum + Number(transaction.amount || 0), 0);

            const yesterdayAmountDeducted = yesterdayTransactions.reduce((sum, transaction) => 
                sum + Number(transaction.amount || 0), 0);

            const todayAutoDisconnects = todayAlerts.filter(alert => 
                alert.alertType === 'LOW_BALANCE' || alert.alertType === 'EMERGENCY_LOW').length;

            const yesterdayAutoDisconnects = yesterdayAlerts.filter(alert => 
                alert.alertType === 'LOW_BALANCE' || alert.alertType === 'EMERGENCY_LOW').length;

            return {
                row1: {
                    cumulativeCurrentBalance: Number(cumulativeCurrentBalance.toFixed(2)),
                    consumersCount: prepaidAccounts.length,
                    lowBalanceConsumers,
                    adhocCreditIssued: Number(adhocCreditIssued.toFixed(2)),
                    adhocCreditRecovered: Number(adhocCreditRecovered.toFixed(2)),
                    remainingCredit: Number((adhocCreditIssued - adhocCreditRecovered).toFixed(2))
                },
                row2: {
                    daily: {
                        totalRechargeCollection: Number(todayTotalRecharge.toFixed(2)),
                        yesterdayRechargeCollection: Number(yesterdayTotalRecharge.toFixed(2)),
                        rechargesProcessed: todayRecharges.length,
                        rechargeConsumers: new Set(todayRecharges.map(r => r.accountId)).size,
                        
                        totalUnitsConsumed: Number(todayUnitsConsumed.toFixed(2)),
                        yesterdayUnitsConsumed: Number(yesterdayUnitsConsumed.toFixed(2)),
                        metersWithConsumption: new Set(todayTransactions.map(t => t.accountId)).size,
                        
                        totalAmountDeducted: Number(todayAmountDeducted.toFixed(2)),
                        yesterdayAmountDeducted: Number(yesterdayAmountDeducted.toFixed(2)),
                        transactionsCount: todayTransactions.length,
                        transactionConsumers: new Set(todayTransactions.map(t => t.accountId)).size,
                        
                        alertsTriggered: todayAlerts.length,
                        yesterdayAlerts: yesterdayAlerts.length,
                        alertsSentToday: todayAlerts.length,
                        
                        autoDisconnectsTriggered: todayAutoDisconnects,
                        yesterdayAutoDisconnects: yesterdayAutoDisconnects,
                        disconnectConsumers: todayAutoDisconnects
                    },
                    monthly: {
                        totalRechargeCollection: Number(todayTotalRecharge.toFixed(2)),
                        yesterdayRechargeCollection: Number(yesterdayTotalRecharge.toFixed(2)),
                        rechargesProcessed: todayRecharges.length,
                        rechargeConsumers: new Set(todayRecharges.map(r => r.accountId)).size,
                        
                        totalUnitsConsumed: Number(todayUnitsConsumed.toFixed(2)),
                        yesterdayUnitsConsumed: Number(yesterdayUnitsConsumed.toFixed(2)),
                        metersWithConsumption: new Set(todayTransactions.map(t => t.accountId)).size,
                        
                        totalAmountDeducted: Number(todayAmountDeducted.toFixed(2)),
                        yesterdayAmountDeducted: Number(yesterdayAmountDeducted.toFixed(2)),
                        transactionsCount: todayTransactions.length,
                        transactionConsumers: new Set(todayTransactions.map(t => t.accountId)).size,
                        
                        alertsTriggered: todayAlerts.length,
                        yesterdayAlerts: yesterdayAlerts.length,
                        alertsSentToday: todayAlerts.length,
                        
                        autoDisconnectsTriggered: todayAutoDisconnects,
                        yesterdayAutoDisconnects: yesterdayAutoDisconnects,
                        disconnectConsumers: todayAutoDisconnects
                    }
                }
            };
        } catch (error) {
            console.error('PrepaidBillingDB.getPrepaidBillingStats: Database error:', error);
            throw error;
        }
    }



    static async getPrepaidBillingTable(page = 1, limit = 10, filters = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const whereClause = {};

            if (filters.status) {
                whereClause.isActive = filters.status === 'ACTIVE';
            }

            if (filters.consumerNumber) {
                whereClause.consumers = {
                    consumerNumber: {
                        contains: filters.consumerNumber,
                        mode: 'insensitive'
                    }
                };
            }

            if (filters.accountNumber) {
                whereClause.accountNumber = {
                    contains: filters.accountNumber,
                    mode: 'insensitive'
                };
            }

            const totalCount = await prisma.prepaid_accounts.count({
                where: whereClause
            });

            const accounts = await prisma.prepaid_accounts.findMany({
                where: whereClause,
                include: {
                    consumers: {
                        select: {
                            consumerNumber: true,
                            name: true,
                            primaryPhone: true,
                            email: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            });

            const billingData = accounts.map(account => {
                return {
                    id: account.id,
                    accountNumber: account.accountNumber,
                    consumerNumber: account.consumers?.consumerNumber,
                    consumerName: account.consumers?.name,
                    consumerPhone: account.consumers?.primaryPhone,
                    consumerEmail: account.consumers?.email,
                    currentBalance: Number(account.currentBalance || 0),
                    totalRecharged: Number(account.totalRecharged || 0),
                    totalConsumed: Number(account.totalConsumed || 0),
                    isActive: account.isActive,
                    isBlocked: account.isBlocked,
                    blockReason: account.blockReason,
                    lowBalanceThreshold: Number(account.lowBalanceThreshold || 0),
                    emergencyThreshold: Number(account.emergencyThreshold || 0),
                    createdAt: account.createdAt,
                    updatedAt: account.updatedAt
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
            console.error('PrepaidBillingDB.getPrepaidBillingTable: Database error:', error);
            throw error;
        }
    }

}

export default PrepaidBillingDB; 