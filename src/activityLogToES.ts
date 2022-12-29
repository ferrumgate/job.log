import { ActivityLog, ConfigService, ESService, ESServiceLimited, logger, RedisService, RedisWatcherService, Util } from "rest.portal";
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

    constructor(private redis: RedisService,
        private leader: Leader) {
        this.es = this.createESService();

    }
    createESService() {
        if (process.env.LIMITED_MODE == 'true')
            return new ESServiceLimited(process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
        else
            return new ESService(process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
    }



    async start() {
        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check()
        }, 5000)
    }
    async stop() {
        if (this.timer)
            clearIntervalAsync(this.timer);
        this.timer = null;
    }

    async check() {
        try {

            if (!this.leader.isMe) {
                return;
            }
            if (!this.lastPos) {
                const pos = await this.redis.get('/logs/activity/pos', false) as string;
                if (pos)
                    this.lastPos = pos;
                else
                    this.lastPos = '0';

            }
            while (this.leader.isMe) {
                const items = await this.redis.xread(this.activityStreamKey, 10000, this.lastPos, 5000);
                logger.info(`activity logs getted size: ${items.length}`);
                let pushItems = [];
                let unknownItemsCount = 0;
                for (const item of items) {
                    if (!this.leader.isMe) return;

                    this.lastPos = item.xreadPos;
                    try {
                        if (item.type == 'b64') {
                            const message = Buffer.from(item.data, 'base64').toString();
                            const log = JSON.parse(message) as ActivityLog;

                            const nitem = await this.es.activityCreateIndexIfNotExits(log)
                            pushItems.push(nitem);
                        } else {
                            logger.warn(`unknown type for activity log ${item.type}, skipping`);
                            unknownItemsCount++;

                        }


                    } catch (err) {
                        logger.error(err);

                    }
                }
                if (pushItems.length) {
                    await this.es.activitySave(pushItems);
                    await this.redis.set('/logs/activity/pos', this.lastPos);
                    logger.info(`activity logs written to es size: ${pushItems.length}`)
                } else
                    if (unknownItemsCount) {//save only new pos
                        await this.redis.set('/logs/activity/pos', this.lastPos);
                    }

                if (!items.length)
                    break;
            }

        } catch (err) {
            logger.error(err);
        }
    }


}