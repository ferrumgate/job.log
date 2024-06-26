import chai from 'chai';
import { Gateway, Network, RedisConfigService, RedisConfigWatchCachedService, RedisService, Service, SessionService, SystemLogService, TunnelService, User, Util } from 'rest.portal';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { DhcpService } from 'rest.portal/service/dhcpService';
import { SvcActivityLogParser } from '../src/svcActivityLogParser';
import { SystemWatchService } from '../src/systemWatchService';

const expect = chai.expect;

describe('svcActivityLogParser ', async () => {
    const encKey = 'mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm';
    const simpleRedis = new RedisService();
    beforeEach(async () => {

        await simpleRedis.flushAll();

    })

    async function prepareData(config: RedisConfigService) {

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
        await config.init();
        await config.saveUser(user);
        await config.saveGateway({ id: '1234', name: 'testgateway', networkId: '12345' } as Gateway);
        await config.saveNetwork({ id: '12345', name: 'testnetwork' } as Network);
        await config.saveService({ id: '123456', name: 'testservice' } as Service);

        const sessionService = new SessionService(config, simpleRedis);

        const session1 = await sessionService.createSession(user, true, '1.2.3.4', 'local');
        const session2 = await sessionService.createSession(user, true, '1.2.3.5', 'local');
        const session3 = await sessionService.createSession(user, true, '1.2.3.6', 'local');

        const tunnelService = new TunnelService(config, simpleRedis, new DhcpService(config, simpleRedis));

        const tunnel1 = {
            id: 'randomtunnelid', userId: 100, authenticatedTime: new Date().toString(),
            assignedClientIp: '10.0.0.3', trackId: '12', type: 'ssh', sessionId: session1.id,
            clientIp: '192.168.1.100', tun: 'tun0', gatewayId: '1234', serviceNetwork: '192.168.0.0/24'
        }
        await simpleRedis.hset(`/tunnel/id/randomtunnelid`, tunnel1)

        const tunnel2 = {
            id: 'randomtunnelid2', userId: 100, authenticatedTime: new Date().toString(),
            assignedClientIp: '10.0.0.3', trackId: '12', type: 'ssh',
            clientIp: '192.168.1.100', tun: 'tun0', gatewayId: '1234', serviceNetwork: '192.168.0.0/24'
        }
        await simpleRedis.hset(`/tunnel/id/randomtunnelid2`, tunnel2)

        return { tunnelService, sessionService, user, session1, session2, session3, tunnel1, tunnel2 }

    }

    it('parse', async () => {
        const systemlog = new SystemLogService(new RedisService(), new RedisService(), encKey)
        const config = new RedisConfigService(new RedisService(), new RedisService(), systemlog, encKey);
        await config.init();
        const { tunnelService, sessionService, user, session1, session2, session3, tunnel1, tunnel2 } = await prepareData(config);
        const watch = new SystemWatchService(tunnelService, sessionService, systemlog, new BroadcastService());
        await watch.start();
        await Util.sleep(1000);

        const redisConfig = new RedisConfigWatchCachedService(new RedisService(), new RedisService(), systemlog, true, encKey);
        await redisConfig.start();

        await Util.sleep(1000);

        const parser = new SvcActivityLogParser(new RedisService(), new RedisService(), encKey, redisConfig, watch);
        //,randominstance1687469356697422,1,0,dns,1687469356697467,0,0,0,gateway1,mysqlservice,ttyy,abc,,192.168.88.250,42780,udp,192.168.88.250,5555,a,www.ferrumgate.com,allow,w9FTQWw5e56Txcld
        //',1000,232323,1,1,1000,2,1,3,1234,123456,12,someid,randomtunnelid,1.2.3.4,3456,tcp,2.3.4.5,89'
        const log = await parser.parse(',randominstance1687469356697422,1,0,raw,1000,2,1,3,1234,123456,12,someid,randomtunnelid,1.2.3.4,3456,tcp,2.3.4.5,89');
        expect(log).exist;

        if (log) {
            expect(log.insertDate).to.equal(new Date(1).toISOString());
            expect(log.trackId).to.equal(2);
            expect(log.serviceProtocol).to.equal('raw');
            expect(log.status).to.equal(401);
            expect(log.type).to.equal('service deny');
            expect(log.statusMessage).to.equal('UserNotFound');
            expect(log.gatewayId).to.equal('1234');
            expect(log.serviceId).to.equal('123456');
            expect(log.authzRuleId).to.equal('12');
            expect(log.userId).to.equal('someid');
            expect(log.tunnelId).to.equal('randomtunnelid');
            expect(log.sourceIp).to.equal('1.2.3.4');
            expect(log.sourcePort).to.equal(3456);
            expect(log.networkProtocol).to.equal('tcp');
            expect(log.destinationIp).to.equal('2.3.4.5');
            expect(log.destinationPort).to.equal(89);
        }
        if (log) {
            await parser.fillItem(log);
            expect(log.gatewayName).to.equal('testgateway');
            expect(log.networkId).to.equal('12345');
            expect(log.networkName).to.equal('testnetwork');
            expect(log.serviceName).to.equal('testservice');
            expect(log.authnRuleName).to.be.undefined;
            expect(log.username).to.equal('hamza@ferrumgate.com');
            expect(log.user2FA).to.be.true;
            expect(log.tunType).to.equal('ssh');
            expect(log.tun).to.equal('tun0');
            expect(log.ip).to.equal(session1.ip);
            expect(log.is2FA).to.be.false;
            expect(log.authSource).to.equal('local');
            expect(log.assignedIp).to.equal('10.0.0.3')

        }

    }).timeout(20000);

    it('parse dns', async () => {
        const systemlog = new SystemLogService(new RedisService(), new RedisService(), encKey)
        const config = new RedisConfigService(new RedisService(), new RedisService(), systemlog, encKey);
        await config.init();
        const { tunnelService, sessionService, user, session1, session2, session3, tunnel1, tunnel2 } = await prepareData(config);
        const watch = new SystemWatchService(tunnelService, sessionService, systemlog, new BroadcastService());
        await watch.start();
        await Util.sleep(1000);

        const redisConfig = new RedisConfigWatchCachedService(new RedisService(), new RedisService(), systemlog, true, encKey);
        await redisConfig.start();

        await Util.sleep(1000);

        const parser = new SvcActivityLogParser(new RedisService(), new RedisService(), encKey, redisConfig, watch);
        //,randominstance1687469356697422,1,0,dns,1687469356697467,0,0,0,gateway1,mysqlservice,ttyy,abc,,192.168.88.250,42780,udp,192.168.88.250,5555,a,www.ferrumgate.com,allow,w9FTQWw5e56Txcld
        //',1000,232323,1,1,1000,2,1,3,1234,123456,12,someid,randomtunnelid,1.2.3.4,3456,tcp,2.3.4.5,89'

        const log = await parser.parse(',randominstance1687469356697422,1,0,dns,1000,2,1,3,1234,123456,12,someid,randomtunnelid,1.2.3.4,3456,tcp,2.3.4.5,89,a,d3d3LmZlcnJ1bWdhdGUuY29t,allow,w9FTQWw5e56Txcld');
        //const log = await parser.parse(',2WgCTs2YnLFyH8eD1687769809915636,1,0,dns,1687,7,0,0,zhc9,hT6emTpaO,hVOVHZ,,6GOC43HpOiWEUkEH,,,100.64.0.7,48845,udp,1.1.1.1,53,aaaa,ZS0wMDE0LmUtbXNlZGdlLm5ldA==,allow,w9FTQWw5e56Txcld');
        expect(log).exist;
        if (log)
            await parser.fillItem(log);
        if (log) {
            expect(log.insertDate).to.equal(new Date(1).toISOString());
            expect(log.trackId).to.equal(2);
            expect(log.serviceProtocol).to.equal('dns');
            expect(log.status).to.equal(401);
            expect(log.type).to.equal('service deny');
            expect(log.statusMessage).to.equal('UserNotFound');
            expect(log.gatewayId).to.equal('1234');
            expect(log.serviceId).to.equal('123456');
            expect(log.authzRuleId).to.equal('12');
            expect(log.userId).to.equal('someid');
            expect(log.tunnelId).to.equal('randomtunnelid');
            expect(log.sourceIp).to.equal('1.2.3.4');
            expect(log.sourcePort).to.equal(3456);
            expect(log.networkProtocol).to.equal('tcp');
            expect(log.destinationIp).to.equal('2.3.4.5');
            expect(log.destinationPort).to.equal(89);
            expect(log.dnsQueryType).to.equal('a');
            expect(log.dnsQuery).to.equal('www.ferrumgate.com');
            expect(log.dnsStatus).to.equal('allow');
            expect(log.dnsFqdnCategoryId).to.equal('w9FTQWw5e56Txcld');

        }
        if (log) {
            await parser.fillItem(log);
            expect(log.gatewayName).to.equal('testgateway');
            expect(log.networkId).to.equal('12345');
            expect(log.networkName).to.equal('testnetwork');
            expect(log.serviceName).to.equal('testservice');
            expect(log.authnRuleName).to.be.undefined;
            expect(log.username).to.equal('hamza@ferrumgate.com');
            expect(log.user2FA).to.be.true;
            expect(log.tunType).to.equal('ssh');
            expect(log.tun).to.equal('tun0');
            expect(log.ip).to.equal(session1.ip);
            expect(log.is2FA).to.be.false;
            expect(log.authSource).to.equal('local');
            expect(log.assignedIp).to.equal('10.0.0.3')
            expect(log.dnsFqdnCategoryName).to.equal('Unknown')

        }

    }).timeout(20000);

})