import { ActivityLog, ConfigService, ESService, ESServiceLimited, logger, RedisService, RedisWatcherService, Util, WatchGroupService, WatchItem } from "rest.portal";
import { Leader } from "./leader";


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
    es: ESService;
    watchGroup: WatchGroupService;
    constructor(private redis: RedisService, private redisStream: RedisService,
        private leader: Leader) {
        this.watchGroup = new WatchGroupService(this.redis, this.redisStream, "job.log",
            Util.randomNumberString(16),
            this.activityStreamKey, '0', 12 * 60 * 60 * 1000, '', 10000, async (data: any[]) => {
                await this.processData(data);
            })
        this.es = this.createESService();

    }
    createESService() {
        if (process.env.LIMITED_MODE == 'true')
            return new ESServiceLimited(process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
        else
            return new ESService(process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
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