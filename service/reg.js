const {getAmountPendingRegistration, checkNewRegistrations } = require('../net/email');
const AccountManager = require('../db/account');

const logger = require('log4js').getLogger()


async function registerAll() {
  let reg = await getAmountPendingRegistration()
  if (reg > 0) {
    let accounts = await checkNewRegistrations()
    for (const acc of accounts) {
      await AccountManager.addUser(acc.login)
      logger.info(`Added ${acc.login}`)
    }
  }
  if (reg > 20) { //TODO: Remove hardcode. Btw I don't care
    setTimeout(registerAll, 1000 * 60 * 2);
  }
}

module.exports = registerAll