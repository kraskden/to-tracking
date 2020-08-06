// Module for parsing and transform tanki rating api response. 

function addActivities(activities, arr, nameKey, role) {
    for (const entity of arr) {
        activities.push({
            name: entity[nameKey],
            role: role,
            score: entity.scoreEarned,
            time:  Math.round(entity.timePlayed / 1000) 
        })
    }
}

// Join time and score of modifications of the same item
function joinMks(items) {
    let mks = items.reduce((acc, curr) => {
        if (acc.has(curr.name)) {
            let prev = acc.get(curr.name)
            acc.set(curr.name, {
                name: curr.name,
                scoreEarned: prev.scoreEarned + curr.scoreEarned,
                timePlayed: prev.timePlayed + curr.timePlayed
            })
        } else {
            acc.set(curr.name, {
                name: curr.name,
                scoreEarned: curr.scoreEarned,
                timePlayed: curr.timePlayed
            })
        }
        return acc
    }, new Map())
    return mks.values()
}

function makeActivities(userData) {
    activities = []
    addActivities(activities, userData.modesPlayed, 'type', 'Mode')
    addActivities(activities, joinMks(userData.hullsPlayed), 'name', 'Hull')
    addActivities(activities, joinMks(userData.turretsPlayed), 'name', 'Turret')
    addActivities(activities, joinMks(userData.resistanceModules), 'name', 'Module')

    return activities
}

function makeSupplies(userData) {

    // Map supplies id to their names
    let idMap = {
        10007271: 'DD',
        10007274: 'Aid',
        10007280: 'N2O',
        10007268: 'DA',
        10007277: 'Mine',
        920004863750: 'Gold',
        920009489701: 'Battery'
    }

    return userData.suppliesUsage.map((item) => {
        return {
            name: idMap[item.id],
            count: item.usages
        }
    })
}

function makeTimestamp() {
    let curr = Date.now()
    curr -= 60 * 60 * 6 * 1000 // minus 6 hours
    let date = new Date(curr)
    date.setUTCSeconds(0)
    date.setUTCMinutes(0)
    date.setUTCHours(0)
    date.setUTCMilliseconds(0)
    return date
}

function getTrackType(date) {
    let day = date.getUTCDay()
    let nextDate = new Date(date)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    let nextDayNum = nextDate.getUTCDate()

    if (day === 0 && nextDayNum === 1) {
        return 'WeekMonth'
    } else if (day === 0) {
        return 'Week'
    } else if (nextDayNum === 1) {
        return 'Month'
    } else {
        return 'Day'
    }
}

function makeRecord(userData, trackType) {
    let date = makeTimestamp()
    let time = userData.modesPlayed.reduce((acc, curr) => acc += Math.round(curr.timePlayed / 1000), 0)

    return {
        timestamp: date,
        trackType: trackType ? trackType : getTrackType(date),
        score: userData.score,
        time: time,
        golds: userData.caughtGolds,
        kills: userData.kills,
        deaths: userData.deaths,
        cry: userData.earnedCrystals,
        hasPremium: userData.hasPremium,
        activities: makeActivities(userData),
        supplies: makeSupplies(userData)
    }
}

function makeFullNames(arr) {
    return arr.map(entity => `${entity.name}${entity.grade}`)
}

function makeState(userData) {
    return {
        rank: userData.rank,
        hulls: makeFullNames(userData.hullsPlayed),
        turrets: makeFullNames(userData.turretsPlayed),
        modules: makeFullNames(userData.resistanceModules),
        drones: userData.dronesPlayed.map(drone => drone.name)
    }
}

module.exports = {makeRecord, makeState, makeTimestamp}