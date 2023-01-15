
import chai from 'chai';
import { RedisService, Util } from 'rest.portal';
import { Leader } from '../src/leader';



const expect = chai.expect;


describe.skip('leader ', async () => {
    const redis = new RedisService();
    beforeEach(async () => {

        await redis.flushAll();

    })

    it('ping', async () => {
        const leader = new Leader('job.log', redis, 'localhost:6379');
        await leader.ping();
        expect(leader.pingResult.alive).to.be.true;
        expect(leader.pingResult.lastPing > 0).to.be.true;

    }).timeout(20000);

    it('leaderElection', async () => {
        const leader = new Leader('job.log', redis, 'localhost:6379');
        leader.events.on('iAmLeader', () => {
            console.log('i am leader');
        })
        leader.events.on('iAmNotLeader', () => {
            console.log('i am not leader');
        })
        await leader.ping();
        let counter = 9;
        while (counter) {
            await leader.leaderElection();

            await Util.sleep(10000);
            counter--;
        }

        expect(leader.isMe).to.be.true;
        await leader.stop();


    }).timeout(120000);

    it('leaderElectionTry', async () => {
        const leader = new Leader('job.log', redis, 'localhost:6379');
        const leader2 = new Leader('job.log', redis, 'localhost:6379');
        setTimeout(async () => {
            await leader.ping();
            let counter = 9;
            while (counter) {
                await leader.leaderElection();
                await Util.sleep(10000);
                counter--;
            }

        }, 10);
        setTimeout(async () => {
            await leader2.ping();
            let counter = 9;
            while (counter) {
                await leader2.leaderElection();

                await Util.sleep(10000);
                counter--;
            }

        }, 1000);

        await Util.sleep(100000);
        if (!leader.isMe && !leader2.isMe)
            expect(false).to.be.true;

        if (leader.isMe && leader2.isMe)
            expect(true).to.be.false;

        await leader.stop();
        await leader2.stop();

    }).timeout(120000);



    it('leaderElectionTry2', async () => {
        const leader = new Leader('job.log', redis, 'localhost:6379');
        const leader2 = new Leader('job.log', redis, 'localhost:6379');
        setTimeout(async () => {
            await leader.ping();
            let counter = 9;
            while (counter) {
                await leader.leaderElection();
                await Util.sleep(10000);
                counter--;
            }

        }, 10);
        setTimeout(async () => {
            await leader2.ping();
            let counter = 9;
            while (counter) {
                await leader2.leaderElection();

                await Util.sleep(10000);
                counter--;
            }

        }, 100000);

        await Util.sleep(120000);
        expect(leader.isMe).to.be.true;
        expect(leader2.isMe).to.be.false;

        await leader.stop();
        expect(leader.isMe).to.be.false;

        await Util.sleep(90000);

        expect(leader.isMe).to.be.false;
        expect(leader2.isMe).to.be.true;
        await leader2.stop();

    }).timeout(240000);




})