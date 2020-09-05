const express =  require('express')
const Handlers = require('./net/api')
const cors = require('cors')
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()

const app = express()
const port = 4000

const logger = require('log4js').getLogger()
logger.level = 'debug'

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

app.use(cors())


app.get('/add/:user', Handlers.auth, Handlers.adminChecker, Handlers.debugAdd)

app.get('/debugGetUsers', Handlers.debugGetUsers)

app.get('/users', Handlers.getUsers)

app.get("/trunc", Handlers.auth, Handlers.adminChecker, Handlers.debugOptimizeData)

app.get('/user/:user', Handlers.debugViewUser)

app.get('/update', Handlers.auth, Handlers.adminChecker, Handlers.debugUpdateAll)

app.get('/user/:user/track', Handlers.getTrackInfo)
app.get('/user/:user/lastTrack', Handlers.getLastTrack)
app.get('/user/:user/currTrack', Handlers.getCurrTrack)
app.get('/track', Handlers.getAllTracks)


app.post('/profile/login', jsonParser, Handlers.login)
app.post('/profile/register', jsonParser, Handlers.register)
app.get('/profile/', Handlers.auth, Handlers.getProfileInfo)
app.post('/profile/sub/:user', Handlers.auth, Handlers.subTo)
app.post('/profile/unsub/:user', Handlers.auth, Handlers.unsubFrom)
app.post('/profile/add/:user', Handlers.auth, jsonParser, Handlers.addAccount)

app.get('/profile/update', Handlers.updateProfiles)

app.get('/invite/:user', Handlers.auth, Handlers.adminChecker, Handlers.generateInvite)

app.get('/online/detail', Handlers.getDetailOnline)
app.get('/online/pcu', Handlers.getPcuOnline)

Handlers.start().then(() => {
    app.listen(4000, (err) => {
        if (err) {
            logger.error(err)
        } else {
            logger.info(`App listening at ${port}`)
        }
    })
})

