
import chai, { util } from 'chai';

import { DeviceLog, DeviceService, ConfigService, ESService, RedisService, RedisWatcherService, Util } from 'rest.portal';
import { Leader } from '../src/leader';
import { DeviceLogToES } from '../src/deviceLogToES';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { esHost, esPass, esUser } from './common.spec';



const expect = chai.expect;



describe('deviceLogToES ', async () => {


    beforeEach(async () => {


    })


    function createSampleData() {
        let log1: DeviceLog = {
            insertDate: new Date().toISOString(),
            clientSha256: '',
            clientVersion: 'adfa',
            hasAntivirus: true,
            hasEncryptedDisc: false,
            hasFirewall: true,
            hostname: 'ferr',
            id: '123',
            isHealthy: true,
            macs: 'ops',
            osName: 'ad',
            osVersion: 'adfa',
            platform: 'win32',
            serial: 'asdfaf',
            userId: 'asdfafa',
            username: 'adfasdfawe',


        }
        let log2: DeviceLog = {
            insertDate: new Date().toISOString(),
            clientSha256: '',
            clientVersion: 'adfa',
            hasAntivirus: true,
            hasEncryptedDisc: false,
            hasFirewall: true,
            hostname: 'adaferr',
            id: 'a123',
            isHealthy: false,
            macs: 'aops',
            osName: 'aad',
            osVersion: 'aewdfa',
            platform: 'linx',
            serial: 'asdfaf',
            userId: 'asdfafa',
            username: 'adfasdfawe',
        }
        return { log1, log2 };
    }
    it('saveToES', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        class Mock extends DeviceLogToES {

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

        const { log1, log2 } = createSampleData();

        const deviceService = new DeviceService(configService, redis, redis, es);
        await deviceService.save(log1);
        await deviceService.save(log2);

        await es.reset();
        const watcher = new Leader('redis', redis, 'localhost');
        //watcher.isMe = true;
        const deviceLog = new Mock(redis, redis2, watcher, configService);
        await deviceLog.start();
        await Util.sleep(15000);
        await deviceLog.stop();
        /* await Util.sleep(120000);
        const result = await es.search({
            index: 'ferrumgate-device*', body: {
                query: {
                    match_all: {}
                }
            }
        })
        expect(result.hits.total.value > 0).to.be.true;
 */


    }).timeout(200000);


})


