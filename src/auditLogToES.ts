import { ConfigService, ESService, ESServiceExtended, ESServiceLimited, logger, RedisService, RedisWatcherService, Util, WatchGroupService, WatchItem } from "rest.portal";
import { AuditLog } from "rest.portal/model/auditLog";
import { ESServiceLimitedExtended } from "./service/esServiceExtended";
import { Leader } from "./leader";
import { BroadcastService } from "rest.portal/service/broadcastService";

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * @summary a class that watches audit logs and writes them to es
 */
export class AuditLogToES {

    /**
     *
     */

    auditStreamKey = '/logs/audit';
    es: ESService;
    watchGroup: WatchGroupService;
    constructor(encKey: string, protected redis: RedisService, protected redisStream: RedisService,
        protected leader: Leader, protected configService: ConfigService) {
        this.watchGroup = new WatchGroupService(this.redis, this.redisStream, "job.log", Util.randomNumberString(16), this.auditStreamKey, '0', 24 * 60 * 60 * 1000, encKey, 10000, async (data: any[]) => {
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
        await this.fakeData();
        await this.watchGroup.start(true);
    }
    async stop() {
        await this.watchGroup.stop(true);
    }
    async fakeData() {
        try {
            const base64 = Util.jencode({ insertDate: new Date().toISOString() }).toString('base64url');// Buffer.from(JSON.stringify(act)).toString('base64url')
            await this.redis.xadd(this.auditStreamKey, { val: base64, type: 'b64' });
        } catch (ignore) { }
    }



    async processData(datas: WatchItem<AuditLog>[]) {
        let pushItems = [];
        for (const data of datas) {
            const log = data.val;
            try {

                const nitem = await this.es.auditCreateIndexIfNotExits(log);
                pushItems.push(nitem);

            } catch (err) {
                logger.error(err);
            }

        }
        if (pushItems.length) {
            await this.es.auditSave(pushItems);
            logger.info(`audit logs written to es size: ${pushItems.length}`)
        }
    }


}