const schedule = require('node-schedule')
const logger = require('log4js').getLogger()

const {updateAll} = require('./update')
const OnlineManager = require('../db/online')
const OnlineProvider = require('../net/online')

function makeSchedule() {
    logger.info('Scheduling started')
    schedule.scheduleJob('0 3 * * *', function() {
        logger.info('Start pending updates')
        updateAll()
    })
    schedule.scheduleJob('*/15 * * * *', function() {
      OnlineProvider.getCurrentOnline().then((online) => {
        return OnlineManager.updateOnline(online)
      }).catch((err) => {
        logger.error("Error due online updating " + err)
      })
    })
}

module.exports = makeSchedule