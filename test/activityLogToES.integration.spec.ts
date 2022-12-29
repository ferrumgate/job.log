
import chai from 'chai';
import chaiHttp from 'chai-http';
import { ActivityLog, ActivityService, ConfigService, ESService, RedisService, RedisWatcherService, Util } from 'rest.portal';
import { Leader } from '../src/leader';
import { ActivityLogToES } from '../src/activityLogToES';


chai.use(chaiHttp);
const expect = chai.expect;


const esHost = 'https://192.168.88.250:9200';
const esUser = "elastic";
const esPass = '123456';
describe('activityLogToES ', async () => {

    beforeEach(async () => {


    })

    const streamKey = '/logs/audit';
    function createSampleData() {
        const log1: ActivityLog = {
            insertDate: new Date().toISOString(),
            ip: '1.2.3.4',
            authSource: 'local', requestId: '123', status: 0,
            type: 'login try',
            userId: '12131a',
            username: 'abcda@email.com'
        }

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
        class Mock extends ActivityLogToES {
            createESService(): ESService {
                return new ESService(esHost, esUser, esPass)
            }
        }
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        //first create a config and save to a file
        //let configService = new ConfigService('AuX165Jjz9VpeOMl3msHbNAncvDYezMg', filename);
        const redis = new RedisService();
        await redis.flushAll();
        const es = new ESService(esHost, esUser, esPass);
        const { log1, log2 } = createSampleData();

        const activityService = new ActivityService(redis, es);
        await activityService.save(log1);
        await activityService.save(log2);

        await es.reset();
        const watcher = new Leader('redis', redis, 'localhost');
        watcher.isMe = true;
        const activityLog = new Mock(redis, watcher);
        await activityLog.start();
        await activityLog.stop();
        await Util.sleep(5000);
        /*  const result = await es.search({
             index: 'ferrumgate-activity', body: {
                 query: {
                     match_all: {}
                 }
             }
         }) */
        const redisPos = await redis.get('/logs/activity/pos', false);
        expect(redisPos).exist;


    }).timeout(200000);


})

