const AccountManager = require('../db/account')
const UserManager = require('../db/users')
const {baseFields} = require('../db/accountSchema')
const mongoose = require('mongoose')
const makeSchedule = require('../service/workers')
const {updateAll, updateUser} = require('../service/update')
const getUserData = require('../net/net')
const config = require('../config')
const jwt = require('jsonwebtoken')

const email = require('./email')
const OnlineManager = require('../db/online')
const { TRACK_HISTORY_MAX_SIZE } = require('../db/online')

Handlers = {}

Handlers.start = () => {
    return new Promise((res, rej) =>  {
        mongoose.connect('mongodb://localhost/test', {useNewUrlParser: true, useUnifiedTopology: true}).then(() => {
            makeSchedule()
            res()      
        })
    })
}

Handlers.debugAdd = (req, res) => {
    if (req.params.user) {
        AccountManager.addUser(req.params.user).then(() => {
            //updateUser({login: req.params.user}, 0, true);
            res.sendStatus(200)
        }).catch((err) => {
            res.status(400).send(JSON.stringify(err))
        })
    } else {
        res.sendStatus(400)
    }
}

Handlers.debugGetUsers = (req, res) => {
    AccountManager.getUsers().then((users) => {
        res.json(users)
    }).catch((err) => {
        res.sendStatus(500)
    })
}

Handlers.debugViewUser = (req, res) => {
    if (!req.params.user) {
        res.sendStatus(400)
    }
    AccountManager.instance().findOne({login: req.params.user}).then((data) => {
        res.json(data)
    }).catch(err => {
        res.sendStatus(500)
    })
}

Handlers.debugUpdateAll = (req, res) => {
    updateAll()
    res.sendStatus(200)
}

function validateParams(user, period, content) {
    let params = {}

    let periods = ['all', 'monthly', 'weekly', 'daily', 'currWeek', 'currMonth']
    let contents = ['all', 'base', 'activities', 'supplies']


    params.user = user
    params.period =  periods.indexOf(period) === -1 || period === 'all' ? periods.slice(1) : [period]
    params.content = contents.indexOf(content) === -1 || content === 'all' ? ['all'] : [content]    
    return params
}

function makeSelectProjectile(params) {
    let selectProjectile = {_id: 0, login: 1, tracking: {$slice: -1}}
    for (const period of params.period) {
        selectProjectile[period] = {$slice: -30}
    }
    if (params.content[0] !== 'all') {
        let fields = params.content[0] === 'base' ? baseFields : params.content
        for (const period of params.period) {
            for (const field of fields) {
                selectProjectile[`${period}.${field}`] = 1
            }
            selectProjectile[`${period}.timestamp`] = 1
        }
    }
    return selectProjectile
}

Handlers.getTrackInfo = (req, res) => {
    if (!req.params.user) {
        res.sendStatus(400)
    }


    let params = validateParams(req.params.user, req.query.period, req.query.content)
    let selectProjectile = makeSelectProjectile(params)

    AccountManager.findUserTrack(params.user, selectProjectile).then((data) => {
        res.json(data)
    }).catch((err) => {
        console.log("error")
        res.sendStatus(500)
    })

}

Handlers.getAllTracks = (req, res) => {
    if (!req.query.user) {
        res.sendStatus(400)
        return;
    }

    let users = Array.isArray(req.query.user) ? req.query.user : [req.query.user];

    let params = validateParams(null, req.query.period, req.query.content)
    let selectProjectile = makeSelectProjectile(params);

    let promises = []
    for (const user of users) {
        promises.push(AccountManager.findUserTrack(user, selectProjectile))
    }
    Promise.all(promises).then((result) => {
        res.json(result)
    }).catch((err) => {
        res.sendStatus(500)
    })
}

Handlers.getCurrTrack = (req, res) => {
    if (!req.params.user) {
        res.sendStatus(400)
    }
    let user = req.params.user

    let selectProjectile = {_id: 0, login: 1, currMonth: 1, currWeek: 1}
    for (const field of baseFields) {
        selectProjectile[`currMonth.${field}`] = 1
        selectProjectile[`currWeek.${field}`] = 1
    }
    AccountManager.instance().findOne({login: user}, selectProjectile).collation({locale: "en", strength: 2}).then((doc) => {
        res.json(doc)
    }).catch((err) => {
        res.sendStatus(500)
    })
}

Handlers.getLastTrack = (req, res) => {
    if (!req.params.user || !req.query.period) {
        res.sendStatus(400)
    }
    let user = req.params.user
    let period = req.query.period

    let selectProjectile = {_id: 0, login: 1}
    selectProjectile[period] = {$slice: -1}
    for (const field of baseFields) {
        selectProjectile[`${period}.${field}`] = 1
    }
    AccountManager.instance().findOne({login: user}, selectProjectile).collation({locale: "en", strength: 2}).then((doc) => {
        res.json(doc)
    }).catch((err) => {
        res.sendStatus(500)
    })
}

Handlers.login = (req, res) => {
    const {login, password} = req.body
    if (!login || !password) {
        res.sendStatus(400)
        return
    }
    UserManager.authUser(login, password).then((jwt) => {
        if (jwt == "") {
            res.sendStatus(403)
        } else {
            res.json({
                jwt: jwt
            })
        }
    })
}

Handlers.register = (req, res) => {
    const {login, password, invite} = req.body
    if (!login || !password || !invite) {
        res.sendStatus(400)
        return 
    }
    login.trim()
    invite.trim()
    getUserData(login).then(() => {
        return UserManager.registerUser(login, password, invite)
    }).then(() => {
        //updateUser({login: login}, 0, true);
        res.sendStatus(200)
    }).catch((err) => {
        res.sendStatus(400)
    })
}

Handlers.auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    req.user = {}
    if (authHeader) {
        const token = authHeader.split(' ')[1]
        jwt.verify(token, config.JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user
            }
            next()
        })
    } else {
         next()   
     }
}

Handlers.adminChecker = (req, res, next) => {
    if (!req.user) {
        res.sendStatus(403)
    }
    UserManager.instance().findOne({login: req.user}).then((user) => {
        if (user && user.role === "Admin") {
            next()
        } else {
            res.status(403).send("You are not admin! Fuck you")
        }
    })

}


Handlers.updateProfiles = (req, res) => {
    
    email.checkNewRegistrations().then((reg) => {
        let invites = reg.map((user) => {
            let token = jwt.sign(user.login, config.JWT_INVITE)
            let invite = {email: user.email, jwt: token}
            return invite
        })
        return email.sendInvites(invites)
    }).then((data) => {
        res.sendStatus(200)
    }).
    catch((err) => {
        console.log(err)
        res.sendStatus(404)
    })
}

Handlers.generateInvite = (req, res) => {
    let invite = jwt.sign(req.params.user, config.JWT_INVITE)
    if (req.query.add) {
        AccountManager.addUser(req.params.user).then(() => {
            //updateUser({login: req.params.user}, 0, true);
            
            res.send(invite)
        })
    } else {
        res.send(invite)
    }
}

Handlers.getProfileInfo = (req, res) => {
    if (!req.user) {
        res.sendStatus(403)
        return
    }
    UserManager.getUserInfo(req.user).then((info) => {
        res.json(info)
    }).catch((err) => {
        res.sendStatus(400)
    })
}

Handlers.subTo = (req, res) => {
    if (!req.user || !req.params.user) { 
        res.sendStatus(403)
    }
    UserManager.subscribeTo(req.user, req.params.user).then((isOk) => {
        res.sendStatus(isOk ? 200 : 400)
    })
}

Handlers.unsubFrom = (req, res) => {
    if (!req.user || !req.params.user) { 
        res.sendStatus(403)
    }
    UserManager.unsubscribe(req.user, req.params.user).then((isOk) => {
        res.sendStatus(isOk ? 200 : 400)
    })
}

Handlers.addAccount = (req, res) => {
    const {login, invite} = req.body
    if (!login || !invite || !req.user) {
        res.sendStatus(400)
        return 
    }
    UserManager.addAccount(req.user, login, invite).then((isOk) => {
        // if (isOk) {
        //     updateUser({login: req.user}, 0, true);
        // }
        res.sendStatus(isOk ? 200 : 400)
    }).catch(() => {
        res.sendStatus(500)
    })
}

Handlers.getDetailOnline = (req, res) => {
  let days = Math.min(req.query.days || TRACK_HISTORY_MAX_SIZE, TRACK_HISTORY_MAX_SIZE)
  OnlineManager.getFullRecords(days).then((data) => {
    res.json(data)
  }).catch(() => {
    res.sendStatus(500)
  })
}

Handlers.getPcuOnline = (req, res) => {
  const DEFAULT_PCU_SIZE = 30
  let days = req.query.days || DEFAULT_PCU_SIZE
  OnlineManager.getPcuRecords(days).then((data) => {
    res.json(data)
  }).catch(() => {
    res.sendStatus(500)
  })
}

module.exports = Handlers