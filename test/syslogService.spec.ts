import chai from 'chai';
import udp from 'node:dgram';
import net from 'node:net';
import { RedisService, Util } from 'rest.portal';
import { SyslogService, SyslogUdpService } from '../src/syslogService';

const expect = chai.expect;

describe('syslogService', () => {
    const simpleRedis = new RedisService();
    beforeEach(async () => {
        await simpleRedis.flushAll();

    })
    class Client {
        /**
         *
         */
        client: net.Socket;
        constructor(path: string) {
            this.client = net.connect({
                path: path, writable: true, readable: true
            })

        }
        async connect() {
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject()
                }, 15000);
                this.client.on('connect', () => {
                    clearTimeout(timer);
                    resolve('');
                })
            })
        }
        async write(buf: Buffer) {
            return await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject()
                }, 15000);
                this.client.write(buf, (err: any) => {
                    clearTimeout(timer);
                    if (err)
                        reject(err);
                    else
                        resolve('');
                })
            })
        }

    }
    async function createClient(path: string) {

    }

    it('read/write', async () => {
        const path = `/tmp/test.${Util.randomNumberString()}.sock`;
        const log = '/logs/test';
        const syslog = new SyslogService(path, new RedisService(), new RedisService(), log);
        await syslog.start();
        const client = new Client(path);
        await client.connect();
        await client.write(Buffer.from('hello\n'));
        await Util.sleep(1000);
        const result = await simpleRedis.xread(log, 1000, '0', 100);
        expect(result.length).to.equal(1);

    })

    it('read/write', async () => {
        const path = `/tmp/test.${Util.randomNumberString()}.sock`;
        const log = '/logs/test';
        const syslog = new SyslogService(path, new RedisService(), new RedisService(), log);
        await syslog.start();
        setTimeout(async () => {
            const client = new Client(path);
            await client.connect();
            for (let i = 0; i < 1000; ++i)
                await client.write(Buffer.from('hello\n'));

        }, 1000);

        setTimeout(async () => {
            const client = new Client(path);
            await client.connect();
            for (let i = 0; i < 1000; ++i)
                await client.write(Buffer.from('hello\n'));

        }, 1000);

        await Util.sleep(3000);
        let totalCount = 0;
        let pos = '0';
        for (let i = 0; i < 1000; ++i) {
            const result = await simpleRedis.xread(log, 1000, pos, 10);
            totalCount += result.length;
            if (!result.length)
                break;
            result.forEach((x: any) => pos = x.xreadPos);
        }
        expect(totalCount).to.equal(2000);

    })
})

describe('syslogUdpService', () => {
    const simpleRedis = new RedisService();
    beforeEach(async () => {
        await simpleRedis.flushAll();

    })

    it('read/write', async () => {

        const log = '/logs/test';
        const syslog = new SyslogUdpService(5556, new RedisService(), new RedisService(), log);
        await syslog.start();
        const client = udp.createSocket('udp4');
        client.send('hello', 5556);
        await Util.sleep(5000);
        const result = await simpleRedis.xread(log, 1000, '0', 100);

        client.close();
        await Util.sleep(1000);
        await syslog.stop();
        expect(result.length).to.equal(1);

    }).timeout(150000)

})

