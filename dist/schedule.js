"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelJob = exports.scheduleJob = void 0;
/**
 * The main class and interface of the schedule module
 */
const PriorityQueue = require("./priorityQueue");
const Job = require("./job");
const pinus_logger_1 = require("pinus-logger");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-scheduler', path.basename(__filename));
let timerCount = 0;
let map = {};
let queue = PriorityQueue.createPriorityQueue(comparator);
let jobId = 0;
let timer;
// The accuracy of the scheduler, it will affect the performance when the schedule tasks are
// crowded together
let accuracy = 10;
/**
 * Schedule a new Job
 * @param trigger The trigger to use
 * @param jobFunc The function the job to run
 * @param jobData The data the job use
 * @return The job id, which can be canceled by cancelJob(id:number)
 */
function scheduleJob(trigger, jobFunc, jobData) {
    let job = Job.createJob(trigger, jobFunc, jobData);
    let excuteTime = job.excuteTime();
    let id = job.id;
    map[id] = job;
    let element = {
        id: id,
        time: excuteTime
    };
    let curJob = queue.peek();
    if (!curJob || excuteTime < curJob.time) {
        queue.offer(element);
        setTimer(job);
        return job.id;
    }
    queue.offer(element);
    return job.id;
}
exports.scheduleJob = scheduleJob;
/**
 * Cancel Job
 */
function cancelJob(id) {
    let curJob = queue.peek();
    if (curJob && id === curJob.id) { // to avoid queue.peek() is null
        queue.pop();
        delete map[id];
        clearTimeout(timer);
        excuteJob();
    }
    delete map[id];
    return true;
}
exports.cancelJob = cancelJob;
/**
 * Clear last timeout and schedule the next job, it will automaticly run the job that
 * need to run now
 * @param job The job need to schedule
 * @return void
 */
function setTimer(job) {
    clearTimeout(timer);
    timer = setTimeout(excuteJob, job.excuteTime() - Date.now());
}
/**
 * The function used to ran the schedule job, and setTimeout for next running job
 */
function excuteJob() {
    let job = peekNextJob();
    let nextJob;
    while (!!job && (job.excuteTime() - Date.now()) < accuracy) {
        job.run();
        queue.pop();
        let nextTime = job.nextTime();
        if (nextTime === null) {
            delete map[job.id];
        }
        else {
            queue.offer({ id: job.id, time: nextTime });
        }
        job = peekNextJob();
    }
    // If all the job have been canceled
    if (!job)
        return;
    // Run next schedule
    setTimer(job);
}
/**
 * Return, but not remove the next valid job
 * @return Next valid job
 */
function peekNextJob() {
    if (queue.size() <= 0)
        return null;
    let job = null;
    do {
        job = map[queue.peek().id];
        if (!job)
            queue.pop();
    } while (!job && queue.size() > 0);
    return (!!job) ? job : null;
}
/**
 * Return and remove the next valid job
 * @return Next valid job
 */
function getNextJob() {
    let job = null;
    while (!job && queue.size() > 0) {
        let id = queue.pop().id;
        job = map[id];
    }
    return (!!job) ? job : null;
}
function comparator(e1, e2) {
    return e1.time > e2.time;
}
//# sourceMappingURL=schedule.js.map