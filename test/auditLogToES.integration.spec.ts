
import chai from 'chai';
import chaiHttp from 'chai-http';
import { AuditLog, AuditService, ConfigService, ESService, RedisService, RedisWatcherService, Util } from 'rest.portal';
import { Leader } from '../src/leader';
import { AuditLogToES } from '../src/auditLogToES';



chai.use(chaiHttp);
const expect = chai.expect;



const esHost = 'https://192.168.88.250:9200';
const esUser = "elastic";
const esPass = '123456';
describe('auditLogToES ', async () => {

    beforeEach(async () => {
        //const redis = new RedisService();
        //await redis.flushAll();

    })


    const streamKey = '/logs/audit';
    function createSampleData() {
        const log1: AuditLog = {
            insertDate: new Date().toISOString(),
            ip: '1.2.3.4',
            message: 'service deleted',
            messageSummary: 'abc',
            messageDetail: 'name >>> deneme',
            severity: 'warn',
            tags: '12344',
            userId: '12131a',
            username: 'abcda@email.com'
        }

        const log2: AuditLog = {
            insertDate: new Date().toISOString(),
            ip: '1.2.3.5',
            message: 'group deleted',
            messageSummary: 'bac',
            messageDetail: 'name >>> eaeeneme',
            severity: 'warn',
            tags: '9912344',
            userId: '9912131a',
            username: 'da@email.com'
        }
        return { log1, log2 };
    }
    it('saveToES', async () => {
        class Mock extends AuditLogToES {
            createESService(): ESService {
                return new ESService(esHost, esUser, esPass)
            }
        }
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        //first create a config and save to a file
        let configService = new ConfigService('AuX165Jjz9VpeOMl3msHbNAncvDYezMg', filename);

        const redis = new RedisService();
        await redis.flushAll();
        const es = new ESService(esHost, esUser, esPass);
        const { log1, log2 } = createSampleData();

        const auditService = new AuditService(configService, redis, es);
        await auditService.saveToRedis(log1);
        await auditService.saveToRedis(log2);

        await es.reset();
        const watcher = new Leader('redis', redis, 'localhost');
        watcher.isMe = true;
        const auditLog = new Mock(configService.getEncKey(), redis, watcher);
        await auditLog.start();

        await auditLog.stop();
        await Util.sleep(5000);
        /*   const result = await es.search({
              index: 'ferrumgate-audit', body: {
                  query: {
                      match_all: {}
                  }
              }
          }) */
        const redisPos = await redis.get('/logs/audit/pos', false);
        expect(redisPos).exist;


    }).timeout(200000);


})

