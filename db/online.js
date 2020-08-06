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

OnlineManager.TRACK_HISTORY_MAX_SIZE = 30

OnlineManager.updateOnline = async (online) => {
  let currentDate = new Date()
  // currentDate.setDate(currentDate.getDate() + 1)
  let instance = await Online.findOne({}, "today lastUpdate lastClear").exec()
  let trackRecord = {timestamp: currentDate, online: online}

  if (instance && dateEq(currentDate, instance.lastUpdate)) {
    await Online.updateOne({}, {
      $push: {"today.track": trackRecord},
      $set: {"today.pcu": Math.max(instance.today.pcu, online)}
    }).exec()
  } else {
    let dayRecord = {date: currentDate, pcu: online, track: [trackRecord]}
    if (!instance) {
      await Online.create({today: dayRecord})
    } else {
      await Online.updateOne({}, {$push: {days: instance.today}, $set: {today: dayRecord}}).exec()
    }
  }

  if (instance && dateMonthDiff(currentDate, instance.lastClear) >= 1) {
    // clear old tracks
  }

  await Online.updateOne({}, {$set: {lastUpdate: currentDate}})
}

OnlineManager.getFullRecords = async (daysCount) => {
  return Online.findOne({}, {_id: 0, lastUpdate: 1, today: 1, days: {$slice: -1*daysCount}}).exec()
}

OnlineManager.getPcuRecords = async (daysCount) => {
  return Online.findOne({}, {_id: 0, lastUpdate: 1, "today.pcu": 1, "today.date": 1,
    days: {$slice: -1*daysCount}, "days.pcu": 1, "days.date": 1}).exec()
}

module.exports = OnlineManager