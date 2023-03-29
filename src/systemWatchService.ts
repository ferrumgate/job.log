import { SessionState } from "http2";
import NodeCache from "node-cache";
import { logger, RedisConfigWatchCachedService, SessionService, SystemLog, SystemLogService, Tunnel, TunnelService, Util, WatchItem } from "rest.portal";
import { AuthSession } from "rest.portal/model/authSession";
import { BroadcastService } from "rest.portal/service/broadcastService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');


export class SystemWatchService {
    protected tunnels: NodeCache;
    protected sessions: NodeCache;
    protected isStoping = false;

    protected startTimer: any;
    protected allTunnelsLoaded = false;
    protected allSessionsLoaded = false;
    protected waitList: SystemLog[] = [];
    constructor(
        private tunnelService: TunnelService, private sessionService: SessionService, private systemLog: SystemLogService,
        private bcastService: BroadcastService
    ) {
        this.systemLog.watcher.events.on('data', async (data: WatchItem<SystemLog>) => {
            if (data.val) {
                this.waitList.push(data.val);
            }
        })

        this.tunnels = new NodeCache({
            stdTTL: 24 * 60 * 1000, useClones: false, checkperiod: 10 * 60 * 1000
        })

        this.tunnels.on('expired', async (key: string, value: Tunnel) => {
        })

        this.sessions = new NodeCache({
            stdTTL: 24 * 60 * 1000, useClones: false, checkperiod: 10 * 60 * 1000
        })

        this.sessions.on('expired', async (key: string, value: Tunnel) => {
        })

    }
    async start() {
        this.isStoping = false;


        this.startTimer = setIntervalAsync(async () => {
            await this.loadAllTunnels();
            await this.loadAllSessions();
            await this.processEvents();
        }, 500)
    }
    async stop() {
        this.isStoping = true;
        if (this.startTimer)
            clearIntervalAsync(this.startTimer);
        this.startTimer = null;

    }
    normalizeTunnel(tun: Tunnel) {

        tun.is2FA = Util.convertToBoolean(tun.is2FA);
    }
    normalizeSession(ses: AuthSession) {
        ses.is2FA = Util.convertToBoolean(ses.is2FA);
    }

    async loadAllTunnels() {
        try {

            if (this.allTunnelsLoaded) return;
            logger.info(`system watcher getting tunnels`);

            const allTunnels = await this.tunnelService.getAllValidTunnels(() => !this.isStoping);
            logger.info(`system watcher getted all tunnels count: ${allTunnels.length}`);
            allTunnels.forEach((x: Tunnel) => {
                this.normalizeTunnel(x);
                if (x.id)
                    this.tunnels.set(x.id, x);
            })

            this.allTunnelsLoaded = true;
            logger.info(`system watcher all tunnels getted count:${allTunnels.length}`);

        } catch (err) {
            logger.error(err);
        }

    }

    async loadAllSessions() {
        try {

            if (this.allSessionsLoaded) return;
            logger.info(`system watcher getting sessions`);

            const allSessions = await this.sessionService.getAllValidSessions(() => !this.isStoping);
            logger.info(`system watcher getted all sessions count: ${allSessions.length}`);
            allSessions.forEach((x: AuthSession) => {
                this.normalizeSession(x);
                if (x.id) {
                    this.sessions.set(x.id, x);
                }
            })

            this.allSessionsLoaded = true;
            logger.info(`system watcher all sessions getted count:${allSessions.length}`);

        } catch (err) {
            logger.error(err);
        }

    }

    async processEvents() {
        try {
            if (!this.allTunnelsLoaded) return;
            while (this.waitList.length) {

                const ev = this.waitList[0];
                logger.debug(`system watcher data ${JSON.stringify(ev)}`)
                if (ev.path == '/system/tunnels/confirm') {
                    const data = ev.val as Tunnel;
                    if (data?.id) {
                        this.normalizeTunnel(data);
                        this.tunnels.set(data.id, data, 24 * 60 * 60 * 1000);
                        logger.info(`system watcher tunnel configure id:${data.id} trackId:${data.trackId}`)
                    }
                }
                if (ev.path == '/system/tunnels/alive') {
                    const data = ev.val as Tunnel;
                    if (data?.id) {
                        if (this.tunnels.has(data.id)) {

                            this.tunnels.ttl(data.id, 24 * 60 * 60 * 1000);
                            logger.info(`system watcher tunnel alive id:${data.id} trackId:${data.trackId}`)
                        }
                    }
                }
                if (ev.path == '/system/sessions/create') {
                    const data = ev.val as AuthSession;
                    if (data?.id) {
                        this.normalizeSession(data);
                        this.sessions.set(data.id, data, 24 * 60 * 60 * 1000);
                        logger.info(`system watcher session create id:${data.id}`)
                    }
                }
                if (ev.path == '/system/sessions/alive') {
                    const data = ev.val as AuthSession;
                    if (data?.id) {
                        if (this.tunnels.has(data.id)) {

                            this.tunnels.ttl(data.id, 24 * 60 * 60 * 1000);
                            logger.info(`system watcher session alive id:${data.id}`)
                        }
                    }
                }
                this.waitList.shift();
                this.bcastService.emit('systemLog', ev);
            }

        } catch (err) {
            logger.error(err);
        }
    }

    async getTunnel(id: string): Promise<Tunnel | undefined> {
        return this.tunnels.get(id) as Tunnel;
    }
    async getSession(id: string): Promise<AuthSession | undefined> {
        return this.sessions.get(id);
    }
}
