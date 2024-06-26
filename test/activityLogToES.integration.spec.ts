import chai from 'chai';
import { ActivityLog, ActivityService, ConfigService, ESService, RedisService, Util } from 'rest.portal';
import { ActivityLogToES } from '../src/activityLogToES';
import { Leader } from '../src/leader';
import { esHost, esPass, esUser } from './common.spec';

const expect = chai.expect;

describe('activityLogToES ', async () => {

    beforeEach(async () => {

    })

    function createSampleData() {
        const log1: ActivityLog = {
            insertDate: new Date().toISOString(),
            ip: '1.2.3.4',
            authSource: 'local', requestId: '123', status: 0,
            type: 'login try',
            userId: '12131a',
            username: 'abcda@email.com',
            abo: 'abc'
        } as any;

        const log2: ActivityLog = {
            insertDate: new Date().toISOString(),
            ip: '1.2.3.5',
            authSource: 'activedirectory', requestId: '1234', status: 0,
            type: 'login try',
            userId: 'a12131a',
            username: 'aaabcda@email.com'
        }
        return { log1, log2 };
    }
    it('saveToES', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        class Mock extends ActivityLogToES {

            override createESService(): ESService {
                return new ESService(this.configService, esHost, esUser, esPass)
            }
        }

        //first create a config and save to a file
        //let configService = new ConfigService('AuX165Jjz9VpeOMl3msHbNAncvDYezMg', filename);
        const redis = new RedisService();
        await redis.flushAll();
        const redis2 = new RedisService();
        const es = new ESService(configService, esHost, esUser, esPass);
        await Util.sleep(1000);
        await es.reset();
        const { log1, log2 } = createSampleData();

        const activityService = new ActivityService(redis, es);
        await activityService.save(log1);
        await activityService.save(log2);

        const watcher = new Leader('redis', redis, 'localhost');
        //watcher.isMe = true;
        const activityLog = new Mock(redis, redis2, watcher, configService);
        await activityLog.start();
        await Util.sleep(15000);
        await activityLog.stop();
        await Util.sleep(60000);
        const result = await es.search({
            index: 'ferrumgate-activity*', body: {
                query: {
                    match_all: {}
                }
            }
        })
        expect(result.hits.total.value > 0).to.be.true;

    }).timeout(200000);

})

