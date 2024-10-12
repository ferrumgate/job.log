import { ActivityLog, ConfigService, ESService, ESServiceExtended, logger, RedisService, Util, WatchGroupService, WatchItem } from "rest.portal";
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

        return ESServiceExtended.create(this.configService);
    }

    async start() {
        await this.fakeData();
        await this.watchGroup.start(true);
    }
    async stop() {
        await this.watchGroup.stop(true);
    }

    async fakeData() {
        try {
            const base64 = Util.jencode({ insertDate: new Date().toISOString() }).toString('base64url');// Buffer.from(JSON.stringify(act)).toString('base64url')
            await this.redis.xadd(this.activityStreamKey, { val: base64, type: 'b64' });
        } catch (ignore) { }
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