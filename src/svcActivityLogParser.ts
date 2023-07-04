import { ActivityLog, ESService, ESServiceExtended, ESServiceLimited, fqdnCategoriesMap, logger, RedisCachedConfigService, RedisConfigWatchCachedService, RedisConfigWatchService, RedisService, Util, WatchGroupService, WatchItem, WatchService } from "rest.portal";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { PolicyAuthzErrors } from "rest.portal/service/policyService";
import { ESServiceLimitedExtended } from "./service/esServiceExtended";
import { SystemWatchService } from "./systemWatchService";



export class SvcActivityLogParser {
    logs = `/logs/activity/svc`;
    logWatcher: WatchGroupService;


    es: ESService;
    constructor(private redis: RedisService, private redisStream: RedisService, private encKey: string,
        private configService: RedisConfigWatchCachedService, private systemWatcher: SystemWatchService) {
        this.logWatcher = new WatchGroupService(this.redis, this.redisStream,

            "job.log", Util.randomNumberString(16),
            this.logs, "0", undefined, this.encKey, 1000, async (data: any[]) => {
                logger.debug(`log parsed data received: ${data.length}`)
                await this.processData(data);
            })
        this.es = this.createESService();
        //when first install
        setTimeout(async () => {
            await this.createAFakeRecord();
        }, 5000);

    }
    protected createESService() {
        if (process.env.LIMITED_MODE == 'true')
            return new ESServiceLimitedExtended(this.configService, process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
        else
            return new ESServiceExtended(this.configService, process.env.ES_HOST, process.env.ES_USER, process.env.ES_PASS);
    }
    async createAFakeRecord() {
        try {
            //when first install, there is no queue, because of this there is some much error,
            // this code createa a fake record
            await this.logWatcher.write(',,,,,,,,,,,');
        } catch (err) {
            logger.error(err);
        }
    }
    protected parseWhy(val: number): string {
        return PolicyAuthzErrors[val];
    }
    async parse(log: string) {
        const parts = log.split(',');
        let logId = '';

        let result: ActivityLog = { trackId: 0, requestId: Util.randomNumberString(16), type: 'service allow', authSource: '', status: 200, insertDate: new Date().toISOString(), ip: '' }
        parts.forEach((val, index) => {
            switch (index) {
                case 1:
                    logId = val; break;
                case 4:
                    result.serviceProtocol = val; break;
                case 5:
                    result.insertDate = new Date(Util.convertToNumber(val) / 1000).toISOString(); break;
                case 6:
                    result.trackId = Util.convertToNumber(val); break;
                case 7:
                    let isDropped = Util.convertToNumber(val);
                    if (isDropped) result.status = 401;
                    if (isDropped) result.type = 'service deny';
                    break;
                case 8:
                    let why = Util.convertToNumber(val);
                    result.statusMessage = this.parseWhy(why)?.toString() || '';
                    break;
                case 9:
                    result.gatewayId = val; break;
                case 10:
                    result.serviceId = val; break;
                case 11:
                    result.authzRuleId = val; break;
                case 12:
                    result.userId = val; break;
                case 13:
                    result.tunnelId = val; break;
                case 14:
                    result.sourceIp = val; break;
                case 15:
                    result.sourcePort = Util.convertToNumber(val); break;
                case 16:
                    result.networkProtocol = val; break;
                case 17:
                    result.destinationIp = val; break;
                case 18:
                    result.destinationPort = Util.convertToNumber(val); break;



                default: break;


            }
        })
        if (result.serviceProtocol == 'dns') {
            result.dnsQueryType = parts[19];
            result.dnsQuery = parts[20] ? Buffer.from(parts[20], 'base64').toString('utf-8') : '';
            result.dnsStatus = parts[21];
            result.dnsFqdnCategoryId = parts[22];
        }
        if (!Util.isUndefinedOrNull(result.trackId))
            return result;
        return null;

    }
    async fillItem(item: ActivityLog) {
        const gateway = await this.configService.getGateway(item.gatewayId || '');
        item.gatewayName = gateway?.name;
        item.networkId = gateway?.networkId;

        const network = await this.configService.getNetwork(item.networkId || '');
        item.networkName = network?.name;

        const service = await this.configService.getService(item.serviceId || '');
        item.serviceName = service?.name;

        const authzRule = await this.configService.getAuthorizationPolicyRule(item.authzRuleId || '');
        item.authzRuleName = authzRule?.name;

        const user = await this.configService.getUserById(item.userId || '');
        item.username = user?.username;
        item.user2FA = Util.convertToBoolean(user?.is2FA);

        const tun = await this.systemWatcher.getTunnel(item.tunnelId || '');
        item.tunType = tun?.type;
        item.tun = tun?.tun;
        if (!item.assignedIp && tun?.assignedClientIp)
            item.assignedIp = tun?.assignedClientIp;
        item.is2FA = tun?.is2FA;

        const session = await this.systemWatcher.getSession(tun?.sessionId || '');
        item.authSource = session?.source || 'unknown';
        item.sessionId = session?.id;
        item.ip = session?.ip || '0.0.0.0';
        //ip intelligence
        item.countryCode = session?.countryCode;
        item.countryName = session?.countryName;
        item.isProxyIp = session?.isProxyIp;
        item.isCrawlerIp = session?.isCrawlerIp;
        item.isHostingIp = session?.isHostingIp;

        if (item.serviceProtocol == 'dns') {
            if (item.dnsFqdnCategoryId)
                item.dnsFqdnCategoryName = fqdnCategoriesMap.get(item.dnsFqdnCategoryId)?.name;
        }


    }
    async processData(datas: WatchItem<string>[]) {
        let pushItems = [];
        for (const data of datas) {
            try {
                const log = data.val;
                const item = await this.parse(log);
                if (item) {
                    await this.fillItem(item);
                    const nitem = await this.es.activityCreateIndexIfNotExits(item);
                    pushItems.push(nitem);
                }


            } catch (err) {
                logger.error(err);
            }

        }
        if (pushItems.length) {
            await this.es.activitySave(pushItems);
            logger.info(`parsed activity logs written to es size: ${pushItems.length}`)
        }
    }

    async start() {
        await this.logWatcher.start(true);
    }
    async stop() {
        await this.logWatcher.stop(true);
    }




}