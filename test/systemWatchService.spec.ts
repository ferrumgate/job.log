
import chai from 'chai';
import { ConfigService, RedisService, SessionService, SystemLogService, TunnelService, User, Util } from 'rest.portal';
import { SystemWatchService } from '../src/systemWatchService';
import { Leader } from '../src/leader';
import { BroadcastService } from '../src/service/bcastService';

const expect = chai.expect;

describe('systemWatchService ', async () => {
    const simpleRedis = new RedisService();
    beforeEach(async () => {
        await simpleRedis.flushAll();
    })

    function createSampleData() {
        const user: User = {
            username: 'hamza@ferrumgate.com',
            groupIds: [],
            id: 'someid',
            name: 'hamza',
            password: Util.bcryptHash('somepass'),
            source: 'local',
            isVerified: true,
            isLocked: false,
            is2FA: true,
            twoFASecret: 'adfa',
            insertDate: new Date().toISOString(),
            updateDate: new Date().toISOString(),
            roleIds: []

        }
        return { user }
    }

    it('getAll', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        const sessionService = new SessionService(configService, simpleRedis);
        const { user } = createSampleData();
        const session1 = await sessionService.createSession(user, true, '1.2.3.4', 'local');
        const session2 = await sessionService.createSession(user, true, '1.2.3.5', 'local');
        const session3 = await sessionService.createSession(user, true, '1.2.3.6', 'local');
        const systemlog = new SystemLogService(simpleRedis, new RedisService());
        const tunnelService = new TunnelService(configService, simpleRedis);

        const tunnel1 = {
            id: 'randomtunnelid', userId: 100, authenticatedTime: new Date().toString(),
            assignedClientIp: '10.0.0.3', trackId: '12',
            clientIp: '192.168.1.100', tun: 'tun0', gatewayId: '1234', serviceNetwork: '192.168.0.0/24'
        }
        await simpleRedis.hset(`/tunnel/id/randomtunnelid`, tunnel1)

        const tunnel2 = {
            id: 'randomtunnelid2', userId: 100, authenticatedTime: new Date().toString(),
            assignedClientIp: '10.0.0.3', trackId: '12',
            clientIp: '192.168.1.100', tun: 'tun0', gatewayId: '1234', serviceNetwork: '192.168.0.0/24'
        }
        await simpleRedis.hset(`/tunnel/id/randomtunnelid2`, tunnel2)

        const watch = new SystemWatchService(tunnelService, sessionService, systemlog, new BroadcastService());
        await watch.loadAllSessions();
        const s1 = await watch.getSession(session1.id);
        expect(s1).exist;
        const s2 = await watch.getSession(session2.id);
        expect(s2).exist;
        const s3 = await watch.getSession(session3.id);
        expect(s3).exist;



        await watch.loadAllTunnels();
        const t1 = await watch.getTunnel(tunnel1.id);
        expect(t1).exist;
        const t2 = await watch.getTunnel(tunnel2.id);
        expect(t2).exist;



    }).timeout(20000);
});