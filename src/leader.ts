
import EventEmitter from "node:events";
import { logger, PingService, RedisService, RedLockService, Util } from "rest.portal";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');


export class Leader {
    events: EventEmitter = new EventEmitter();
    protected redLock: RedLockService;
    protected pingService: PingService;
    protected timeInterval: any;
    name: string;
    pingResult: { avg: number, alive: boolean, lastPing: number } = { avg: 100000000000000, alive: false, lastPing: 0 };
    private leader: { isMe: boolean } = { isMe: false };
    isMe: boolean = false;
    private electionName: string;

    constructor(name: string, private redisService: RedisService, private pingHost: string) {
        this.electionName = `/leader/election/${name}`
        this.redLock = new RedLockService(redisService);
        this.pingService = new PingService();
        this.name = Util.randomNumberString(16);

        this.redLock.events.on('acquired', () => {
            logger.info(`i am ${this.name} the leader of ${this.electionName}`)
            this.isMe = true;
            this.events.emit('iAmLeader');
        })
        this.redLock.events.on('released', () => {
            logger.info(`i am ${this.name} not the leader of ${this.electionName} anymore`)
            this.isMe = false;
            this.events.emit('iAmNotLeader');
        })
    }

    async start() {
        this.timeInterval = setIntervalAsync(async () => {
            await this.ping();
            await this.leaderElection();
        }, 15000);




    }
    async ping(packetCount = 100, maxSeconds = 10) {
        try {
            if (Util.now() - this.pingResult.lastPing < 30 * 60 * 1000) return;//check every 30 minutes


            const hosts = this.pingHost;

            let splits = hosts.split(',')
            for (const host of splits) {
                let tmp = host;
                if (tmp.includes(":"))
                    tmp = tmp.substring(0, tmp.indexOf(':'));
                logger.info(`pinging ${tmp}`);
                const resp = await this.pingService.ping(tmp, packetCount, maxSeconds);
                if (resp.alive) {
                    this.pingResult.avg = Util.convertToNumber(resp.avg);
                    this.pingResult.alive = resp.alive;
                    this.pingResult.lastPing = new Date().getTime();
                    return;
                }

            }
            //no hosts reached
            this.pingResult.avg = 1000000000000;
            this.pingResult.alive = false
            this.pingResult.lastPing = new Date().getTime();


        } catch (err) {
            logger.error(err);
        }
    }
    async leaderElection() {
        try {
            if (!this.pingResult.alive) return;
            logger.info(`leader election for ${this.electionName}`);
            const currentMinute = new Date().getUTCMinutes();
            let obj = {} as any;
            obj[this.name] = this.pingResult.avg;
            const trx = await this.redisService.multi();
            const key = `${this.electionName}/${currentMinute}`;
            await trx.hset(key, obj);
            await trx.expire(key, 3 * 60 * 1000);
            await trx.exec();

            const beforeKey = `${this.electionName}/${currentMinute == 0 ? 59 : (currentMinute - 1)}`;
            const allitems = await this.redisService.hgetAll(beforeKey);
            const keyValueList: { val: number, name: string }[] = [];
            Object.keys(allitems).forEach((x) => {
                keyValueList.push({
                    val: Util.convertToNumber(allitems[x]),
                    name: x
                });
            });
            keyValueList.sort((a, b) => {
                if (a.val == b.val)
                    return a.name.localeCompare(b.name);
                return a.val - b.val;
            });
            const leader = keyValueList.at(0);
            if (leader)
                logger.info(`leader ${leader?.name} with ${leader?.val} elected`);
            if (leader?.name == this.name) { // I am the leader
                if (!this.leader.isMe)
                    await this.becomeLeader();
            } else
                if (this.leader.isMe) {
                    await this.dropLeader();
                }


        } catch (err) {
            logger.error(err);
        }
    }
    async becomeLeader() {

        this.leader.isMe = true;
        await this.redLock.lock(`/lock${this.electionName}`, 60000, 5000, 10, 1000);
    }
    async dropLeader() {

        this.leader.isMe = false;
        await this.redLock.release();
    }
    async stop() {
        if (this.timeInterval)
            clearIntervalAsync(this.timeInterval);
        this.timeInterval = null;
        if (this.leader.isMe)
            await this.dropLeader();
    }
}