import { AuditLog, logger, RedisConfigWatchCachedService, RedisService, SessionService, SystemLogService, TunnelService, Util } from "rest.portal"
import { ActivityLogToES } from "./activityLogToES";
import { AuditLogToES } from "./auditLogToES";
import { Leader } from "./leader";
import { SvcActivityLogParser } from "./svcActivityLogParser";
import { SyslogService, SyslogUdpService } from "./syslogService";
import { SystemWatchService } from "./systemWatchService";

async function createRedis() {
    return new RedisService(process.env.REDIS_HOST, process.env.REDIS_PASS);
}

async function main() {

    //const sockPath = process.env.SYSLOG_PATH || '/tmp/syslog.sock';
    //const syslog = new SyslogService(sockPath, await createRedis(), await createRedis(), '/logs/activity/svc');
    //await syslog.start();
    const redis = await createRedis();
    let systemlogService: SystemLogService = new SystemLogService(redis, await createRedis(), process.env.ENCRYPT_KEY || '')
    let configService: RedisConfigWatchCachedService =
        new RedisConfigWatchCachedService(redis, await createRedis(), systemlogService, true, process.env.ENCRYPT_KEY || '');

    await configService.start();

    let systemWatchService = new SystemWatchService(new TunnelService(configService, redis), new SessionService(configService, redis));
    await systemWatchService.start();

    const encKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);
    let activity: ActivityLogToES;
    let audit: AuditLogToES;
    let syslog: SyslogUdpService;
    let svcParser: SvcActivityLogParser;
    if (process.env.MODULE_SYSLOG == 'true') {
        const port = Number(process.env.SYSLOG_PORT) || 9292;
        syslog = new SyslogUdpService(port, redis, await createRedis(), '/logs/activity/svc');
        await syslog.start();
    }


    const leader = new Leader('job.log', redis, process.env.REDIS_HOST || 'localhost');
    await leader.start();

    if (process.env.MODUE_ACTIVITY_TO_ES == 'true') {
        activity = new ActivityLogToES(redis, await createRedis(), leader);
        await activity.start();
    }
    if (process.env.MODULE_AUDIT_TO_ES == 'true') {
        audit = new AuditLogToES(encKey, redis, await createRedis(), leader)
        await audit.start();
    }

    if (process.env.MODULE_ACTIVITY_SVC_PARSER == 'true') {
        svcParser = new SvcActivityLogParser(redis, await createRedis(), encKey, configService, systemWatchService)
        await svcParser.start();
    }



    process.on('SIGINT', async () => {
        logger.warn("sigint catched");
        await activity?.stop();
        await audit?.stop();
        await leader.stop();
        await syslog?.stop();
        await systemWatchService.stop();
        await configService.stop();
        await svcParser?.stop();
        logger.warn("sigint catched");
        process.exit(0);

    });
    process.on('SIGTERM', async () => {
        logger.warn("sigterm catched");
        await activity?.stop();
        await audit?.stop();
        await leader.stop();
        await syslog?.stop();
        await systemWatchService.stop();
        await configService.stop();
        await svcParser?.stop();
        logger.warn("sigterm catched");
        process.exit(0);

    });


}

main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })