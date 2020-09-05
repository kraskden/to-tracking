const mongoose = require('mongoose')
const {accountSchema} = require('./accountSchema')
const {makeTimestamp} = require('../net/parse')
const logger = require('log4js').getLogger()

const getUserTrackInfo = require('../net/net')
const {makeRecord, makeState} = require('../net/parse')


let Account = mongoose.model('Account', accountSchema)

function sortData(...arrays) {
    let cmpFun = (a, b) => {
        if (a.name <= b.name) {
            return -1
        } else {
            return 1
        }
    }
    for (const arr of arrays) {
        arr.sort(cmpFun)
    }
}

function arrToMap(arr) {
    let ret = {}
    arr.forEach((i) => {
        ret[i.name] = i;
    })
    return ret;
}

function makeDelta(prev, curr) {

    let res = {}

    for (const key in curr) {
        if (key === "timestamp") {
            let periodDate = new Date(prev[key])
            periodDate.setUTCDate(periodDate.getDate() + 1)
            if (curr.trackType === 'Day')
                res[key] = curr[key]
            else 
                res[key] = periodDate
        } else if ((typeof curr[key]) === "number") {
            let delta = curr[key] - prev[key]
            if (delta > 0)
                res[key] = delta
        } else if ((typeof curr[key]) === "boolean") {
            res[key] = curr[key]
        }
    }

    sortData(curr.activities, curr.supplies)
    
    let prevActivityMap = arrToMap(prev.activities);
    let prevSuppliesMap = arrToMap(prev.supplies);

    res.activities = curr.activities.map((activity) => {
        return {
            name: activity.name,
            role: activity.role,
            score: prevActivityMap[activity.name] ? activity.score - prevActivityMap[activity.name].score : activity.score,
            time: prevActivityMap[activity.name] ? activity.time - prevActivityMap[activity.name].time : activity.time
        }       
    }).filter((activity) => activity.time !== 0)

    res.supplies = curr.supplies.map((supply) => {
        return {
            name: supply.name,
            count: prevSuppliesMap[supply.name] ? supply.count - prevSuppliesMap[supply.name].count : supply.count
        }        
    }).filter((supply) => supply.count !== 0)

    return res
}

function addArrDiff(events, eventType, prevArr, currArr) {
    let diff = currArr.filter(entity => !prevArr.includes(entity))
    for (const elem of diff) {
        events.push({
            eventType: eventType,
            eventData: elem
        })
    } 
}

function compareStates(prev, curr) {
    let events = []
    // Rank event
    if (curr.rank !== prev.rank) {
        events.push({
            eventType: 'Rank',
            eventData: curr.rank
        })
    }
    addArrDiff(events, 'Hull', prev.hulls, curr.hulls)
    addArrDiff(events, 'Turret', prev.turrets, curr.turrets)
    addArrDiff(events, 'Module', prev.modules, curr.modules)
    addArrDiff(events, 'Drone', prev.drones, curr.drones)
    return events
}

function getLastTrack(user, type) {
    return Account.aggregate([
        {$match: {login: user}},
        {$project: {
            login: 1,
            tracking: 1
        }},
        {$project: {
            tracking: {$filter: {
                input: '$tracking',
                as: 'item',
                cond: {$or: [{$eq: ['$$item.trackType', type]}, {$eq: ['$$item.trackType', 'WeekMonth']}]}
            }}
        }},
        {$project: {
             tracking: {$slice: [
                 "$tracking", -1
            ]}
        }}
    ])
}

class AccountManager {

    static instance() {
        return Account
    }

    static async findUserTrack(login, selectProjectile) {
        return Account.findOne({login: login}, selectProjectile).collation({"locale": "en", "strength": 2}).exec()
    }

    static async initUserData(user) {
        let info = await getUserTrackInfo(user.login);
        await this.updateTracking(user.login, makeRecord(info, 'WeekMonth'), makeState(info))
        logger.info(`Init user: ${user.login}`)
    }

    static async addUser(user) {
        let findUser = await Account.findOne({login: user}, "_id")
        if (findUser === null) {
            let createdUser = await Account.create({login: user})
            this.initUserData(createdUser)
            return createdUser
        } else {
            return findUser
        }
    }

    static async removeDetailInformation() {
      const totalAmount = 30
      const maxLength = 100 + totalAmount

      let accounts  = await  Account.find({}, {daily: 1, weekly: 1}).exec()

      let promises = accounts.map(acc => {
        let dl = acc.daily.length;
        let wl = acc.weekly.length;

        for (let i = 0; i < dl - totalAmount; ++i) {
          acc.daily[i].activities = []
          acc.daily[i].supplies = []
        }

        for (let i = 0; i < wl - totalAmount; ++i) {
          acc.weekly[i].activities = []
          acc.weekly[i].supplies = []
        }
        
        return acc.save()
      })

      await Promise.all(promises)
    }

    static updateTracking(user, record, newState) {
        let id = undefined
        return new Promise((res, rej) => {
            let findTrackingFilter = {tracking: {$slice: -1}, daily: false, events: false, state: false}
            Account.findOne({login: user}, findTrackingFilter).then((res) => {
                id = res._id
                if (res.tracking.length !== 0) { // Update daily, if player played
                    let lastActivity = res.tracking[0]
                    let updateQuery = {}
                    
                    if (lastActivity.trackType === 'Day') {
                        updateQuery.$pop = {tracking: 1}
                    }
                    updateQuery.$push = {daily: makeDelta(lastActivity, record)}

                    // if (record.trackType === 'Day') {
                    //     return Account.updateOne({login: user}, updateQuery)   
                    // }

                    let findPrevWeek = getLastTrack(user, 'Week')
                    let findPrevMonth = getLastTrack(user, 'Month')

                    let isWeek = record.trackType.indexOf('Week') != -1
                    let isMonth = record.trackType.indexOf('Month') != -1

                    return Promise.all([findPrevWeek, findPrevMonth]).then(values => {
                        let prevWeek = values[0][0]
                        let prevMonth = values[1][0]
                        
                        if (prevMonth.tracking.length !== 0) {
                            updateQuery.currMonth = makeDelta(prevMonth.tracking[0], record)
                            if (isMonth) {
                                updateQuery.$push.monthly = makeDelta(prevMonth.tracking[0], record)
                            }
                        }

                        if (prevWeek.tracking.length !== 0) {
                            updateQuery.currWeek = makeDelta(prevWeek.tracking[0], record)
                            if (isWeek)
                                updateQuery.$push.weekly = makeDelta(prevWeek.tracking[0], record)
                        }

                        return Account.updateOne({login: user}, updateQuery)
                    })
                }
            }).then(() => {
                return Account.updateOne({_id: id}, {$push: {tracking: record}})
            }).then(() => {

                return Account.findOne({_id: id}, "state")
            }).then((data) => {

                if (!data.state) {
                    return Account.updateOne({_id: id}, {state: newState}).then(() => {
                        return newState
                    })
                } 
                return data.state
            }).then((state) => {
                let events = compareStates(state, newState)
                if (events.length !== 0) {
                    let newEntry = {
                        timestamp: makeTimestamp(),
                        events: events
                    }
                    return Account.updateOne({_id: id}, {$push: {events: newEntry}})
                }
            }).then(() => {
                return Account.updateOne({_id: id}, {$set: {state: newState}})
            }).then(() => {
                res()
            })
        })
    }

    static getUsers() {
        return Account.find({}, "login")
    }

    static getUsersList() {
      return Account.find({}, {login: 1, _id: 0, monthly: {$slice: -1}, weekly: {$slice: -1}, 
        "monthly.time": 1, "weekly.time": 1,
        "currWeek.time": 1, "currMonth.time": 1, "state.rank": 1})
    }

}

module.exports = AccountManager