import net from 'node:net'
import fs from 'fs'
import udp from 'node:dgram';
import { logger, RedisService, WatchService, WatchBufferedWriteService } from 'rest.portal';

const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');
export class SyslogService {
    /**
     *
     */
    server!: net.Server;
    log: WatchBufferedWriteService;
    remainedData = '';

    constructor(private path: string, redis: RedisService, redisStream: RedisService, logPath = '/logs/activity/svc') {
        this.log = new WatchBufferedWriteService(redis, redisStream, logPath);

    }
    async start() {
        if (fs.existsSync(this.path))
            fs.unlinkSync(this.path);
        this.server = net.createServer({

        });
        this.server.on('error', (err) => {
            logger.error(err);
        })

        this.server.on('connection', (socket) => {
            logger.info("client connected");

            socket.on('data', async (data: Buffer) => {
                logger.debug(`data received ${data.toString()}`);
                const end = this.remainedData + data.toString();
                if (!end.includes('\n')) {
                    this.remainedData = end;
                    return
                }
                let parts = end.split('\n',)
                for (let i = 0; i < parts.length - 1; ++i) {
                    await this.log.write(data.toString('utf-8'));
                }
                if (!parts[parts.length - 1])//ends with new line
                    this.remainedData = '';
                else
                    this.remainedData = parts[parts.length - 1];

            })
            socket.on('close', () => {

                logger.info("client disconnected");
            })
        })
        this.server.on('listening', () => {
            logger.info(`syslog listening on ${this.path}`);
        })
        this.server.on('close', () => {
            logger.info(`closing server`);

        })
        this.server.listen({
            path: this.path
        });
        await this.log.start(false);

    }
    async stop() {
        if (this.server)
            this.server.close();

        await this.log.stop(false);

    }
}


export class SyslogUdpService {
    /**
         *
         */
    server!: udp.Socket;
    log: WatchBufferedWriteService;


    constructor(private port: number, redis: RedisService, redisStream: RedisService, logPath = '/logs/activity/svc') {
        this.log = new WatchBufferedWriteService(redis, redisStream, logPath);

    }
    async start() {

        // creating a udp server
        this.server = udp.createSocket({ type: 'udp4', reuseAddr: true });
        this.server.on('error', (err) => {
            logger.error(err);
        })


        this.server.on('message', async (data: Buffer) => {
            logger.info(`data received ${data.toString()}`);
            await this.log.write(data.toString('utf-8'));
        })


        this.server.on('listening', () => {
            logger.info(`syslog listening on ${this.server.address().address}:${this.server.address().port}`);
        })
        this.server.on('close', () => {
            logger.info(`closing server`);

        })

        this.server.bind(this.port);
        await this.log.start(false);

    }
    async stop() {
        if (this.server)
            this.server.close();

        await this.log.stop(false);

    }
}