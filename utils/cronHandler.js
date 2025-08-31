import { CronJob } from 'cron';
import { PrismaClient } from '@prisma/client';

class CronJobHandler {
    constructor() {
        this.jobs = new Map();
        this.prisma = new PrismaClient();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Cron handler already initialized');
            return;
        }

        try {
            await this.prisma.$connect();
            console.log('✅ Cron handler database connection established');
            
            this.isInitialized = true;
            console.log('✅ Cron job handler initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize cron handler:', error);
            throw error;
        }
    }

    
    startAllJobs() {
        console.log('🚀 Starting all cron jobs...');
        this.jobs.forEach((jobData, name) => {
            try {
                jobData.job.start();
                console.log(`▶️ Started: ${name}`);
            } catch (error) {
                console.error(`❌ Failed to start job "${name}":`, error);
            }
        });
        console.log(`✅ Started ${this.jobs.size} cron jobs`);
    }

    removeJob(name) {
        if (this.jobs.has(name)) {
            try {
                const jobData = this.jobs.get(name);
                jobData.job.stop();
                this.jobs.delete(name);
                console.log(`🛑 Removed cron job: ${name}`);
            } catch (error) {
                console.error(`❌ Failed to remove job "${name}":`, error);
            }
        }
    }

    getNextRunTime(job) {
        try {
            // Try to get next run time safely
            if (job && typeof job.nextDate === 'function') {
                const nextDate = job.nextDate();
                if (nextDate && typeof nextDate.toDate === 'function') {
                    return nextDate.toDate();
                } else if (nextDate instanceof Date) {
                    return nextDate;
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not determine next run time:', error.message);
        }
        return new Date();
    }

    addJob(name, schedule, task, options = {}) {
        if (this.jobs.has(name)) {
            console.warn(`⚠️ Job "${name}" already exists, replacing...`);
            this.removeJob(name);
        }

        try {
            const job = new CronJob(
                schedule,
                async () => {
                    try {
                        console.log(`🕐 Executing cron job: ${name}`);
                        await task(this.prisma);
                        console.log(`✅ Cron job "${name}" completed successfully`);
                    } catch (error) {
                        console.error(`❌ Cron job "${name}" failed:`, error);
                        
                        if (options.onError) {
                            options.onError(error, name);
                        }
                    }
                },
                null,
                false, 
                options.timezone || 'UTC'
            );

            this.jobs.set(name, {
                job,
                schedule,
                task: task.toString(),
                options,
                lastRun: null,
                nextRun: this.getNextRunTime(job)
            });

            console.log(`📅 Added cron job: ${name} (${schedule})`);
            return job;
        } catch (error) {
            console.error(`❌ Failed to create cron job "${name}":`, error);
            throw error;
        }
    }
}


const cronHandler = new CronJobHandler();

export default cronHandler; 