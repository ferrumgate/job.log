import { logger, RedisService, Util } from "rest.portal"
import { ActivityLogToES } from "./activityLogToES";
import { AuditLogToES } from "./auditLogToES";
import { Leader } from "./leader";
import { SyslogService, SyslogUdpService } from "./syslogService";

async function createRedis() {
    return new RedisService(process.env.REDIS_HOST, process.env.REDIS_PASS);
}
async function main() {

    //const sockPath = process.env.SYSLOG_PATH || '/tmp/syslog.sock';
    //const syslog = new SyslogService(sockPath, await createRedis(), await createRedis(), '/logs/activity/svc');
    //await syslog.start();

    const port = Number(process.env.SYSLOG_PORT) || 9292;
    const syslog = new SyslogUdpService(port, await createRedis(), await createRedis(), '/logs/activity/svc');
    await syslog.start();

    /* const redis = await createRedis();
    const leader = new Leader('job.log', redis, process.env.REDIS_HOST || 'localhost');
    const activity = new ActivityLogToES(await createRedis(), leader);
    const audit = new AuditLogToES(process.env.ENCRYPT_KEY || Util.randomNumberString(32), await createRedis(), leader)
    await leader.start();
    await activity.start();
    await audit.start();

    process.on('SIGINT', async () => {
        logger.warn("sigint catched");
        await activity.stop();
        await audit.stop();
        await leader.stop();
        await syslog.stop();
        logger.warn("sigint catched");
        process.exit(0);

    });
    process.on('SIGTERM', async () => {
        logger.warn("sigterm catched");
        await activity.stop();
        await audit.stop();
        await leader.stop();
        await syslog.stop();
        logger.warn("sigterm catched");
        process.exit(0);

    }); */


}

main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })