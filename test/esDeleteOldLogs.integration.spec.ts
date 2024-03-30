import chai from 'chai';
import { ActivityLog, ConfigService, DeviceLog, ESService, RedisService, Util } from 'rest.portal';
import { ActivityLogToES } from '../src/activityLogToES';
import { DeviceLogToES } from '../src/deviceLogToES';
import { ESDeleteOldLogs } from '../src/esDeleteOldLogs';
import { Leader } from '../src/leader';
import { esHost, esPass, esUser } from './common.spec';

const expect = chai.expect;

describe('esDeleteOldLogs ', async () => {
    const redis = new RedisService();
    beforeEach(async () => {

        await redis.flushAll();

    })

    const streamKey = '/logs/audit';
    function createSampleData() {
        const log1: ActivityLog = {
            insertDate: new Date(1900, 1, 1).toISOString(),
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

    it('saveToES and delete old records', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        await configService.setES({ host: esHost, user: esUser, pass: esPass });

        const es = new ESService(configService, esHost, esUser, esPass);
        await Util.sleep(1000);
        await es.reset();
        const { log1, log2 } = createSampleData();

        const watcher = new Leader('redis', redis, 'localhost');
        watcher.isMe = true;//no need anymore
        const activityLog = new ActivityLogToES(redis, redis, watcher, configService);
        await Util.sleep(2000);
        await activityLog.processData([{ val: log1, time: 1 }, { val: log2, time: 2 }]);
        await Util.sleep(15000);
        const indexes = (await es.getAllIndexes()).filter(x => x.includes('activity'));
        expect(indexes.length == 2).to.be.true;
        const deleteOldLogs = new ESDeleteOldLogs(configService);
        await Util.sleep(2000);
        await deleteOldLogs.deleteOldLogs('ferrumgate-activity-');
        await Util.sleep(2000);
        const indexes2 = (await es.getAllIndexes()).filter(x => x.includes('activity'));;
        console.log(indexes);
        console.log(indexes2);
        expect(indexes.length - indexes2.length).to.equal(1);

    }).timeout(200000);

    const streamKey2 = '/logs/device';
    function createSampleData2() {
        let log1: DeviceLog = {
            insertDate: new Date(1900, 1, 1).toISOString(),
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

    it('saveToES and delete old records device', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        await configService.setES({ host: esHost, user: esUser, pass: esPass });

        const es = new ESService(configService, esHost, esUser, esPass);
        await Util.sleep(1000);
        await es.reset();
        const { log1, log2 } = createSampleData2();

        const watcher = new Leader('redis', redis, 'localhost');
        watcher.isMe = true;//no need anymore
        const deviceLog = new DeviceLogToES(redis, redis, watcher, configService);
        await Util.sleep(2000);
        await deviceLog.processData([{ val: log1, time: 1 }, { val: log2, time: 2 }]);
        await Util.sleep(15000);
        const indexes = (await es.getAllIndexes()).filter(x => x.includes('device'));
        expect(indexes.length == 2).to.be.true;
        const deleteOldLogs = new ESDeleteOldLogs(configService);
        await Util.sleep(2000);
        await deleteOldLogs.deleteOldLogs('ferrumgate-device-');
        await Util.sleep(2000);
        const indexes2 = (await es.getAllIndexes()).filter(x => x.includes('device'));;
        console.log(indexes);
        console.log(indexes2);
        expect(indexes.length - indexes2.length).to.equal(1);

    }).timeout(200000);

})

