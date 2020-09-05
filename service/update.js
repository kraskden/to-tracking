const AccountManager = require('../db/account')
const getUserTrackInfo = require('../net/net')
const {makeRecord, makeState} = require('../net/parse')

const logger = require('log4js').getLogger()

const maxRetryUserCount = 2

function updateUser(user, retryCount = 0, isInit = false) {
    if (retryCount > maxRetryUserCount) {
        logger.error(`Failed update ${user.login}`)
        return Promise.resolve()
        // report user 
    }
    return new Promise((res, rej) => {
        getUserTrackInfo(user.login).then((info) => {
            return AccountManager.updateTracking(user.login, makeRecord(info, isInit ? 'WeekMonth' : undefined), makeState(info))
        }).then(() => {
            logger.debug(`Updated ${user.login}`)
            res()
        }).catch((err) => {
            logger.warn(`Failed update ${user.login}.`)
            logger.warn(`Error: ${JSON.stringify(err)}`)
            //setTimeout(() => updateUser(user, retryCount + 1), 1000 * 60 * 20) // Retry after 20 min
        })
    })
}

function updateAll() {
    logger.info("Update")
    AccountManager.getUsers().then((users) => {
        logger.info(`Start updating ${users.length} users`)
        let promises = []
        for (const user of users) {
            promises.push(updateUser(user))
        }
        return Promise.all(promises)
    }).then(() => {
        logger.info('Finish updating')
    }).catch((err) => {
        logger.error(err)
    })
}

module.exports = {updateAll, updateUser}