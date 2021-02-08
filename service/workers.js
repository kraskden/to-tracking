const schedule = require('node-schedule')
const logger = require('log4js').getLogger()

const {updateAll} = require('./update')
const OnlineManager = require('../db/online')
const OnlineProvider = require('../net/online')

const registerAll = require('./reg')

function makeSchedule() {
    logger.info('Scheduling started')
    schedule.scheduleJob('0 3 * * *', function() {
        logger.info('Start pending updates')
        updateAll()
    })
    schedule.scheduleJob('*/15 * * * *', function() {
      OnlineProvider.getCurrentOnline().then((online) => {
        return OnlineManager.updateOnline(online.online, online.inbattles)
      }).catch((err) => {
        logger.error("Error due online updating " + err)
      })
    })
    schedule.scheduleJob('*/10 * * * *', function() {
      registerAll()
    })
}

module.exports = makeSchedule