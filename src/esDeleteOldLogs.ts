import { ConfigService, ESService, ESServiceLimited, logger, RedisService, RedisWatcherService, Util, WatchGroupService, WatchItem } from "rest.portal";
import { AuditLog } from "rest.portal/model/auditLog";
import { ESServiceExtended, ESServiceLimitedExtended } from "./service/esServiceExtended";
import { Leader } from "./leader";

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * @summary deletes old elasticsearch logs
 */
export class ESDeleteOldLogs {


    es: ESService;
    interval: any;
    constructor(private configService: ConfigService) {

        this.es = this.createESService();

    }
    createESService() {

        return new ESServiceExtended(this.configService);
    }


    async start() {
        this.interval = setIntervalAsync(async () => {
            await this.deleteOldLogs();
        },
            process.env.NODE == 'development' ? 5 : 6 * 60 * 60 * 1000);
    }
    async stop() {
        if (this.interval)
            clearIntervalAsync(this.interval);
    }
    async deleteOldLogs() {
        try {

            const oldDays = (await this.configService.getES()).deleteOldRecordsMaxDays || 7;
            logger.info(`deleting old elastic search logs max days:${oldDays}`);
            const indexes = await this.es.getAllIndexes();
            const activityIndexes = indexes.filter(x => x.startsWith('ferrumgate-activity-'));
            const datesAsString = activityIndexes.map(x => {
                return { index: x, val: 0 }
            });
            const datesAsMiliseconds = datesAsString.map(x => {
                try {
                    const year = Number(x.index.replace('ferrumgate-activity-', '').substring(0, 4));
                    const month = Number(x.index.replace('ferrumgate-activity-', '').substring(4, 2));
                    const day = Number(x.index.replace('ferrumgate-activity-', '').substring(6, 2));
                    x.val = new Date(year, month, day).getTime();
                } catch (ignore) {
                    x.val = 0;//delete if not parsed correctly
                }
                return x;
            });
            const start = new Date().getTime() - (oldDays * 24 * 60 * 60 * 1000);
            for (const date of datesAsMiliseconds) {
                if (date.val < start) {
                    logger.info(`deleting es index ${date.index}`);
                    try {
                        await this.es.deleteIndexes([date.index]);
                    } catch (ignore) {
                        logger.error(ignore)
                    }
                }
            }

        } catch (err) {
            logger.error(err);
        }
    }




}