const mongoose = require('mongoose')
const onlineSchema = require('./onlineSchema')
const logger = require('log4js').getLogger()

const Online = mongoose.model('Online', onlineSchema)

function dateEq(date1, date2) {
  if (!date1 || !date2) {
    return false
  }
  return (date1.getMonth() === date2.getMonth()) &&
     (date1.getDate() === date2.getDate())
}

function dateMonthDiff(date1, date2) {
  let diff = new Date(Math.abs(date1 - date2))
  return diff.getUTCMonth()
}


const OnlineManager = {}

OnlineManager.instance = Online

OnlineManager.TRACK_HISTORY_MAX_SIZE = 10


function calcStat(day, fieldName) {
  let sum = 0
  const len = day.track.length
  for (const track of day.track) {
    sum += track[fieldName]
  }
  const avg = Math.round(sum / len);

  let delta = 0;
  for (const track of day.track) {
    delta += Math.pow((track[fieldName] - avg), 2)
  }

  const sigma = Math.sqrt(delta / len)

  return {avg, sigma}
}

OnlineManager.calculateDayStat = (day) => {
  let onlineStat = calcStat(day, "online")
  let inbattlesStat = calcStat(day, "inbattles")

  day.online = {
    pcu: day.online.pcu,
    avg: onlineStat.avg,
    sigma: onlineStat.sigma
  }
  day.inbattles = {
    pcu: day.inbattles.pcu,
    avg: inbattlesStat.avg,
    sigma: inbattlesStat.sigma
  }

  return day;
}

OnlineManager.updateOnline = async (online, inbattles) => {
  let currentDate = new Date()
  // currentDate.setDate(currentDate.getDate() + 1)
  let instance = await Online.findOne({}, "today lastUpdate lastClear").exec()
  let trackRecord = {timestamp: currentDate, online: online, inbattles: inbattles}

  if (instance && dateEq(currentDate, instance.lastUpdate)) {
    await Online.updateOne({}, {
      $push: {"today.track": trackRecord},
      $set: {
        "today.online.pcu": Math.max(instance.today.online.pcu, online),
        "today.inbattles.pcu": Math.max(instance.today.inbattles.pcu, inbattles)
      }
    }).exec()
  } else {
    let dayRecord = {date: currentDate, online: {pcu: online}, inbattles: {pcu: inbattles}, track: [trackRecord]}
    if (!instance) {
      await Online.create({today: dayRecord})
    } else {
      await Online.updateOne({}, {$push: {days: OnlineManager.calculateDayStat(instance.today)}, $set: {today: dayRecord}}).exec()
    }
  }

  if (instance && dateMonthDiff(currentDate, instance.lastClear) >= 1) {
    let deadline = new Date();
    deadline.setMonth(deadline.getMonth() - 1)
    await Online.findOneAndUpdate({}, {$set: {"days.$[expired].track": [], "lastClear": new Date()}}, {arrayFilters: [{
      "expired.date": {
        $lte: deadline
      }
    }], useFindAndModify: false}).exec()
  }

  await Online.updateOne({}, {$set: {lastUpdate: currentDate}})
}

OnlineManager.getFullRecords = async (daysCount) => {
  return Online.findOne({}, {_id: 0, lastUpdate: 1, today: 1, days: {$slice: -1*daysCount}}).exec()
}

OnlineManager.getDayStatRecords = async (daysCount) => {
  return Online.findOne({}, {_id: 0, lastUpdate: 1, "today.online": 1, "today.inbattles": 1, "today.date": 1,
    days: {$slice: -1*daysCount}, "days.date": 1, "days.online": 1, "days.inbattles": 1}).exec()
}

module.exports = OnlineManager