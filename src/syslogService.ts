import net from 'node:net'
import fs from 'fs'
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
        this.server = net.createServer();
        this.server.listen({
            path: this.path
        });
        this.server.on('connection', (socket) => {
            socket.on('data', async (data: Buffer) => {
                logger.info(`data received ${data.toString()}`);
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
        })
        this.server.on('listening', () => {
            logger.info(`syslog listening on ${this.path}`);
        })
        await this.log.start(false);

    }
    async stop() {
        if (this.server)
            this.server.close();

        await this.log.stop(false);

    }
}