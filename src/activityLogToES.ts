import { createSecretKey } from "crypto";
import { ActivityLog, ConfigService, ESService, ESServiceExtended, ESServiceLimited, logger, RedisService, RedisWatcherService, Util, WatchGroupService, WatchItem } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";

import { Leader } from "./leader";
import { ESServiceLimitedExtended } from "./service/esServiceExtended";


const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * @summary a class that watches activity logs and writes them to es
 */
export class ActivityLogToES {

    /**
     *
     */
    lastPos = '';
    timer: any;
    activityStreamKey = '/logs/activity';
    es!: ESService;
    watchGroup: WatchGroupService;
    interval: any;

    constructor(protected redis: RedisService, protected redisStream: RedisService,
        protected leader: Leader, protected configService: ConfigService) {
        this.watchGroup = new WatchGroupService(this.redis, this.redisStream, "job.log",
            Util.randomNumberString(16),
            this.activityStreamKey, '0', 12 * 60 * 60 * 1000, '', 10000, async (data: any[]) => {
                await this.processData(data);
            })
        this.es = this.createESService();

    }





    createESService(): ESService {

        if (process.env.LIMITED_MODE == 'true')
            return new ESServiceLimitedExtended(this.configService);
        else
            return new ESServiceExtended(this.configService);
    }



    async start() {
        await this.watchGroup.start(true);
    }
    async stop() {
        await this.watchGroup.stop(true);
    }



    async processData(datas: WatchItem<ActivityLog>[]) {
        let pushItems = [];
        for (const data of datas) {
            const log = data.val;
            try {

                const nitem = await this.es.activityCreateIndexIfNotExits(log);
                pushItems.push(nitem);

            } catch (err) {
                logger.error(err);
            }

        }
        if (pushItems.length) {
            await this.es.activitySave(pushItems);
            logger.info(`activity logs written to es size: ${pushItems.length}`)
        }
    }


}