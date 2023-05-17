import { AuditLog, logger, RedisConfigWatchCachedService, RedisService, SessionService, SystemLogService, TunnelService, Util } from "rest.portal"
import { ActivityLogToES } from "./activityLogToES";
import { AuditLogToES } from "./auditLogToES";
import { Leader } from "./leader";
import { SvcActivityLogParser } from "./svcActivityLogParser";
import { SyslogService, SyslogUdpService } from "./syslogService";
import { SystemWatchService } from "./systemWatchService";
import { ESDeleteOldLogs } from "./esDeleteOldLogs";
import { DhcpService } from "rest.portal/service/dhcpService";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { DeviceLogToES } from "./deviceLogToES";

async function createRedis() {
    return new RedisService(process.env.REDIS_HOST, process.env.REDIS_PASS);
}
async function createRedisLocal() {
    return new RedisService(process.env.REDIS_LOCAL_HOST, process.env.REDIS_LOCAL_PASS);
}

async function main() {

    //const sockPath = process.env.SYSLOG_PATH || '/tmp/syslog.sock';
    //const syslog = new SyslogService(sockPath, await createRedis(), await createRedis(), '/logs/activity/svc');
    //await syslog.start();
    const gatewayId = process.env.GATEWAY_ID || Util.randomNumberString(16);
    const redis = await createRedis();
    const redisLocal = await createRedisLocal();
    let systemlogService: SystemLogService = new SystemLogService(redis, await createRedis(), process.env.ENCRYPT_KEY || '', `job.log/${gatewayId}`);
    let configService: RedisConfigWatchCachedService =
        new RedisConfigWatchCachedService(redis, await createRedis(), systemlogService, true, process.env.ENCRYPT_KEY || '', `job.log/${gatewayId}`);

    await configService.start();
    const bcastService = new BroadcastService();

    let systemWatchService = new SystemWatchService(new TunnelService(configService, redis, new DhcpService(configService, redis)), new SessionService(configService, redis), systemlogService, bcastService);
    await systemWatchService.start();

    const encKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);
    let activity: ActivityLogToES;
    let device: DeviceLogToES;
    let audit: AuditLogToES;
    let syslog: SyslogUdpService;
    let svcParser: SvcActivityLogParser;
    if (process.env.MODULE_SYSLOG == 'true') {
        const port = Number(process.env.SYSLOG_PORT) || 9292;
        syslog = new SyslogUdpService(port, redisLocal, await createRedisLocal(), '/logs/activity/svc');
        await syslog.start();
    }


    const leader = new Leader('job.log', redis, process.env.REDIS_HOST || 'localhost');
    //await leader.start();

    if (process.env.MODULE_ACTIVITY_TO_ES == 'true') {
        activity = new ActivityLogToES(redisLocal, await createRedisLocal(), leader, configService);
        await activity.start();
    }
    if (process.env.MODULE_DEVICE_TO_ES == 'true') {
        device = new DeviceLogToES(redisLocal, await createRedisLocal(), leader, configService);
        await device.start();
    }

    if (process.env.MODULE_AUDIT_TO_ES == 'true') {
        audit = new AuditLogToES(encKey, redisLocal, await createRedisLocal(), leader, configService)
        await audit.start();
    }

    if (process.env.MODULE_ACTIVITY_SVC_PARSER == 'true') {
        svcParser = new SvcActivityLogParser(redisLocal, await createRedisLocal(), '', configService, systemWatchService)
        await svcParser.start();
    }

    const deleteOldEsLogs = new ESDeleteOldLogs(configService);
    await deleteOldEsLogs.start();


    process.on('SIGINT', async () => {
        logger.warn("sigint catched");
        await activity?.stop();
        await device?.stop();
        await audit?.stop();
        await leader.stop();
        await syslog?.stop();
        await systemWatchService.stop();
        await configService.stop();
        await svcParser?.stop();
        await deleteOldEsLogs?.stop();
        logger.warn("sigint catched");
        process.exit(0);

    });
    process.on('SIGTERM', async () => {
        logger.warn("sigterm catched");
        await activity?.stop();
        await device?.stop();
        await audit?.stop();
        await leader.stop();
        await syslog?.stop();
        await systemWatchService.stop();
        await configService.stop();
        await svcParser?.stop();
        await deleteOldEsLogs?.stop();
        logger.warn("sigterm catched");
        process.exit(0);

    });


}

main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })