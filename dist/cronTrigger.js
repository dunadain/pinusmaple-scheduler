"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrigger = exports.CronTrigger = void 0;
const pinus_logger_1 = require("pinus-logger");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-scheduler', path.basename(__filename));
let SECOND = 0;
let MIN = 1;
let HOUR = 2;
let DOM = 3;
let MONTH = 4;
let DOW = 5;
let Limit = [
    [0, 59],
    [0, 59],
    [0, 24],
    [1, 31],
    [0, 11],
    [0, 6]
];
class CronTrigger {
    /**
     * The constructor of the CronTrigger
     * @param trigger The trigger str used to build the cronTrigger instance
     */
    constructor(trigger, job) {
        this.nextTime = 0;
        this.trigger = this.decodeTrigger(trigger);
        this.nextTime = this.nextExcuteTime(Date.now());
        this.job = job;
    }
    /**
     * Get the current excuteTime of trigger
     */
    excuteTime() {
        return this.nextTime;
    }
    /**
     * Caculate the next valid cronTime after the given time
     * @param The given time point
     * @return The nearest valid time after the given time point
     */
    nextExcuteTime(time) {
        // add 1s to the time so it must be the next time
        time = !!time ? time : this.nextTime;
        time += 1000;
        let cronTrigger = this.trigger;
        let date = new Date(time);
        date.setMilliseconds(0);
        outmost: while (true) {
            if (date.getFullYear() > 2999) {
                logger.error('Can\'t compute the next time, exceed the limit');
                return 0;
            }
            if (!timeMatch(date.getMonth(), cronTrigger[MONTH])) {
                let nextMonth = nextCronTime(date.getMonth(), cronTrigger[MONTH]);
                if (nextMonth == null)
                    return 0;
                if (nextMonth <= date.getMonth()) {
                    date.setFullYear(date.getFullYear() + 1);
                    date.setMonth(0);
                    date.setDate(1);
                    date.setHours(0);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    continue;
                }
                date.setDate(1);
                date.setMonth(nextMonth);
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
            }
            if (!timeMatch(date.getDate(), cronTrigger[DOM]) || !timeMatch(date.getDay(), cronTrigger[DOW])) {
                let domLimit = getDomLimit(date.getFullYear(), date.getMonth());
                do {
                    let nextDom = nextCronTime(date.getDate(), cronTrigger[DOM]);
                    if (nextDom == null)
                        return 0;
                    // If the date is in the next month, add month
                    if (nextDom <= date.getDate() || nextDom > domLimit) {
                        date.setDate(1);
                        date.setMonth(date.getMonth() + 1);
                        date.setHours(0);
                        date.setMinutes(0);
                        date.setSeconds(0);
                        continue outmost;
                    }
                    date.setDate(nextDom);
                } while (!timeMatch(date.getDay(), cronTrigger[DOW]));
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
            }
            if (!timeMatch(date.getHours(), cronTrigger[HOUR])) {
                let nextHour = nextCronTime(date.getHours(), cronTrigger[HOUR]);
                if (nextHour <= date.getHours()) {
                    date.setDate(date.getDate() + 1);
                    date.setHours(nextHour);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    continue;
                }
                date.setHours(nextHour);
                date.setMinutes(0);
                date.setSeconds(0);
            }
            if (!timeMatch(date.getMinutes(), cronTrigger[MIN])) {
                let nextMinute = nextCronTime(date.getMinutes(), cronTrigger[MIN]);
                if (nextMinute <= date.getMinutes()) {
                    date.setHours(date.getHours() + 1);
                    date.setMinutes(nextMinute);
                    date.setSeconds(0);
                    continue;
                }
                date.setMinutes(nextMinute);
                date.setSeconds(0);
            }
            if (!timeMatch(date.getSeconds(), cronTrigger[SECOND])) {
                let nextSecond = nextCronTime(date.getSeconds(), cronTrigger[SECOND]);
                if (nextSecond <= date.getSeconds()) {
                    date.setMinutes(date.getMinutes() + 1);
                    date.setSeconds(nextSecond);
                    continue;
                }
                date.setSeconds(nextSecond);
            }
            break;
        }
        this.nextTime = date.getTime();
        return this.nextTime;
    }
    /**
     * Decude the cronTrigger string to arrays
     * @param cronTimeStr The cronTimeStr need to decode, like "0 12 * * * 3"
     * @return The array to represent the cronTimer
     */
    decodeTrigger(cronTimeStr) {
        cronTimeStr = cronTimeStr.trim();
        let cronTimes = cronTimeStr.split(/\s+/);
        if (cronTimes.length !== 6) {
            console.log('error');
            return null;
        }
        for (let i = 0; i < cronTimes.length; i++) {
            cronTimes[i] = (this.decodeTimeStr(cronTimes[i], i));
            if (!checkNum(cronTimes[i], Limit[i][0], Limit[i][1])) {
                logger.error('Decode crontime error, value exceed limit!' +
                    JSON.stringify({
                        cronTime: cronTimes[i],
                        limit: Limit[i]
                    }));
                return null;
            }
        }
        return cronTimes;
    }
    /**
     * Decode the cron Time string
     * @param timeStr The cron time string, like: 1,2 or 1-3
     * @return A sorted array, like [1,2,3]
     */
    decodeTimeStr(timeStr, type) {
        let result = {};
        let arr = [];
        if (timeStr === '*') {
            return -1;
        }
        else if (timeStr.search(',') > 0) {
            let timeArr = timeStr.split(',');
            for (let i = 0; i < timeArr.length; i++) {
                let time = timeArr[i];
                if (time.match(/^\d+-\d+$/)) {
                    decodeRangeTime(result, time);
                }
                else if (time.match(/^\d+\/\d+/)) {
                    decodePeriodTime(result, time, type);
                }
                else if (!isNaN(time)) {
                    let num = Number(time);
                    result[num] = num;
                }
                else
                    return null;
            }
        }
        else if (timeStr.match(/^\d+-\d+$/)) {
            decodeRangeTime(result, timeStr);
        }
        else if (timeStr.match(/^\d+\/\d+/)) {
            decodePeriodTime(result, timeStr, type);
        }
        else if (!isNaN(timeStr)) {
            let num = Number(timeStr);
            result[num] = num;
        }
        else {
            return null;
        }
        for (let key in result) {
            arr.push(result[key]);
        }
        arr.sort(function (a, b) {
            return a - b;
        });
        return arr;
    }
}
exports.CronTrigger = CronTrigger;
/**
 * return the next match time of the given value
 * @param value The time value
 * @param cronTime The cronTime need to match
 * @return The match value or null if unmatch(it offten means an error occur).
 */
function nextCronTime(value, cronTime) {
    value += 1;
    if (typeof (cronTime) === 'number') {
        if (cronTime === -1)
            return value;
        else
            return cronTime;
    }
    else if (typeof (cronTime) === 'object' && cronTime instanceof Array) {
        if (value <= cronTime[0] || value > cronTime[cronTime.length - 1])
            return cronTime[0];
        for (let i = 0; i < cronTime.length; i++)
            if (value <= cronTime[i])
                return cronTime[i];
    }
    logger.warn('Compute next Time error! value :' + value + ' cronTime : ' + cronTime);
    return 0;
}
/**
 * Match the given value to the cronTime
 * @param value The given value
 * @param cronTime The cronTime
 * @return The match result
 */
function timeMatch(value, cronTime) {
    if (typeof (cronTime) === 'number') {
        if (cronTime === -1)
            return true;
        if (value === cronTime)
            return true;
        return false;
    }
    else if (typeof (cronTime) === 'object' && cronTime instanceof Array) {
        if (value < cronTime[0] || value > cronTime[cronTime.length - 1])
            return false;
        for (let i = 0; i < cronTime.length; i++)
            if (value === cronTime[i])
                return true;
        return false;
    }
    return null;
}
/**
 * Decode time range
 * @param map The decode map
 * @param timeStr The range string, like 2-5
 */
function decodeRangeTime(map, timeStr) {
    let times = timeStr.split('-');
    times[0] = Number(times[0]);
    times[1] = Number(times[1]);
    if (times[0] > times[1]) {
        console.log('Error time range');
        return;
    }
    for (let i = times[0]; i <= times[1]; i++) {
        map[i] = i;
    }
}
/**
 * Compute the period timer
 */
function decodePeriodTime(map, timeStr, type) {
    let times = timeStr.split('/');
    let min = Limit[type][0];
    let max = Limit[type][1];
    let remind = Number(times[0]);
    let period = Number(times[1]);
    if (period === 0)
        return;
    for (let i = remind; i <= max; i += period) {
        // if (i % period == remind)
        map[i] = i;
        // }
    }
}
/**
 * Check if the numbers are valid
 * @param nums The numbers array need to check
 * @param min Minimus value
 * @param max Maximam value
 * @return If all the numbers are in the data range
 */
function checkNum(nums, min, max) {
    if (nums == null)
        return false;
    if (nums === -1)
        return true;
    for (let i = 0; i < nums.length; i++) {
        if (nums[i] < min || nums[i] > max)
            return false;
    }
    return true;
}
/**
 * Get the date limit of given month
 * @param The given year
 * @month The given month
 * @return The date count of given month
 */
function getDomLimit(year, month) {
    let date = new Date(year, month + 1, 0);
    return date.getDate();
}
/**
 * Create cronTrigger
 * @param trigger The Cron Trigger string
 * @return The Cron trigger
 */
function createTrigger(trigger, job) {
    return new CronTrigger(trigger, job);
}
exports.createTrigger = createTrigger;
//# sourceMappingURL=cronTrigger.js.map