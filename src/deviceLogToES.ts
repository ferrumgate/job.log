import { ConfigService, DeviceLog, ESService, ESServiceExtended, logger, RedisService, Util, WatchGroupService, WatchItem } from "rest.portal";
import { Leader } from "./leader";
import { ESServiceLimitedExtended } from "./service/esServiceExtended";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * @summary a class that watches device logs and writes them to es
 */
export class DeviceLogToES {

    /**
     *
     */
    lastPos = '';
    timer: any;
    deviceStreamKey = '/logs/device';
    es!: ESService;
    watchGroup: WatchGroupService;
    interval: any;

    constructor(protected redis: RedisService, protected redisStream: RedisService,
        protected leader: Leader, protected configService: ConfigService) {
        this.watchGroup = new WatchGroupService(this.redis, this.redisStream, "job.log",
            Util.randomNumberString(16),
            this.deviceStreamKey, '0', 12 * 60 * 60 * 1000, '', 10000, async (data: any[]) => {
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
        await this.fakeData();//so much error if /logs/devicenot exits
        await this.watchGroup.start(true);
    }
    async fakeData() {
        try {
            const base64 = Util.jencode({ insertDate: new Date().toISOString() }).toString('base64url');// Buffer.from(JSON.stringify(act)).toString('base64url')
            await this.redis.xadd('/logs/device', { val: base64, type: 'b64' });
        } catch (ignore) { }
    }
    async stop() {
        await this.watchGroup.stop(true);
    }

    async processData(datas: WatchItem<DeviceLog>[]) {
        let pushItems = [];
        for (const data of datas) {
            const log = data.val;
            try {
                if (!data.val.id)
                    continue;
                const nitem = await this.es.deviceCreateIndexIfNotExits(log);
                pushItems.push(nitem);

            } catch (err) {
                logger.error(err);
            }

        }
        if (pushItems.length) {
            await this.es.deviceSave(pushItems);
            logger.info(`device logs written to es size: ${pushItems.length}`)
        }
    }

}