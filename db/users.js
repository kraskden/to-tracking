const mongoose = require('mongoose')
const logger = require('log4js').getLogger()
const userSchema = require('./userSchema')
const jwt = require('jsonwebtoken')
const config = require('../config')
const bcrypt = require('bcrypt')

const AccountManager = require('./account')

let User = mongoose.model('User', userSchema)

class UserManager {
    static instance() {
        return User
    }

    static async registerUser(login, password, invite) {
        logger.debug(`Start Registering user ${login} with ${password} and ${invite}`)
        let user = await User.findOne({login: login}, "_id").exec()
        if (user !== null) {
            return;
        }
        return new Promise((res, rej) => {
            jwt.verify(invite, config.JWT_INVITE, function (err, data) {
                if ((err || data !== login) && (invite !== config.MASTER_KEY)) {
                    logger.warn(`User ${login} rejected. Payload: ${data}`)
                    rej()
                } else { 
                    User.create({
                        login: login,
                        password: bcrypt.hashSync(password, bcrypt.genSaltSync())
                    }).then((user) => {
                        return AccountManager.addUser(login)
                    }).then((user) => {
                        return User.updateOne({login: login}, {$push: {accounts: user._id}})
                    }).then(() => {
                        res()
                    })
                }
            })
        })
    }

    // return jwt or empty str
    static async authUser(login, password) {
        try {
            let user = await User.findOne({login: login}).exec()
            let isCorrect = await bcrypt.compare(password, user.password);
            if (!isCorrect)
                return ""
            return jwt.sign(login, config.JWT_SECRET)
        } catch {
            return ""
        }
    }

    static async subscribeTo(user_from, user_to) {
        try {
            let account = await AccountManager.instance().findOne({login: user_to}, "_id")
            if (!account) {
                return false
            }
            await User.updateOne({login: user_from}, {$push: {favourites: account._id}}).exec()
            return true
        } catch {
            return false;
        }
    }

    static async unsubscribe(user_from, user_to) {
        try {
            let account = await AccountManager.instance().findOne({login: user_to}, "_id").exec()
            if (!account) {
                return false
            }
            await User.updateOne({login: user_from}, {$pull: {favourites: account._id}})
            return true
        } catch {
            return false
        }
    }

    static async addAccount(user_from, login, invite) {
        try {
            let account = await AccountManager.instance().findOne({login: login}, "_id").exec()
            if (account) {
                return false
            }
            account = await AccountManager.addUser(login)
            let decoded = jwt.decode(invite)
            if (decoded == login || invite === config.MASTER_KEY) {
                await User.updateOne({login: user_from}, {$push: {accounts: account._id}})
                return true
            } else {
                return false
            }
        } catch {
            return false
        }
    }

    static async getUserInfo(username) {
        let user = await User.findOne({login: username}, "login role accounts favourites").exec()
        if (user === null)
            return Promise.reject()

        for (let i = 0; i < user.accounts.length; ++i) {
            let id = user.accounts[i]
            let login = await AccountManager.instance().findById(id, {login: 1, _id: 0}).exec()
            user.accounts[i] = login
        }

        for (let i = 0; i < user.favourites.length; ++i) {
            let id = user.favourites[i]
            let login = await AccountManager.instance().findById(id, {login: 1, _id: 0}).exec()
            user.favourites[i] = login
        }
        return user
    }

}

module.exports = UserManager
