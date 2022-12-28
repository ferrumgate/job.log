import { logger, RedisService, RedisWatcherService } from "rest.portal"
import { ActivityLogToES } from "./activityLogToES";

async function createRedis() {
    return await new RedisService(process.env.REDIS_HOST, process.env.REDIS_PASS);
}
async function main() {
    //const redis = await createRedis();
    ///const activitiy = new ActivityLogToES(redis, new RedisWatcherService());


}

main().catch(err => {
    logger.error(err);
    process.exit(1);
})