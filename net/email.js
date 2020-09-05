const ImapClient = require('emailjs-imap-client').default
const nodemailer = require('nodemailer')

const config = require("../config")

const messagesChecked = 20
const host = config.EMAIL_HOST
const port = config.EMAIL_PORT
const login = config.EMAIL_LOGIN
const pass = config.EMAIL_PASSWORD


function checkNewRegistrations() {
    let client = new ImapClient(host, port, {
        auth: {
            user: login,
            pass: pass
        },
        useSecureTransport: true,
        logLevel: 'info'
    })    

    

    client.onerror = function(err) {
        
        //console.log(err)
    }

    return new Promise((res, rej) => {
        client.connect().then(() => {
            return client.selectMailbox('TANKI_RTG')
        }).then((mailBox) => {
            if (mailBox.exists === 0) {
                return Promise.resolve([])
            } else {
                return client.listMessages('TANKI_RTG', `1:${messagesChecked}`, ['uid body[]'])
            }
        }).then((messages) => {

            if (messages.length === 0) {
                res([])
            } else {
                client.deleteMessages('TANKI_RTG', `1:${messagesChecked}`).then(() => {
                    res(messages.map((msg) => {
                        let login = msg['body[]'].match(/(.*) has sent/)[1]
                        let email = null
                        return {login: login, email: email}
                    }))
                })
            }
        }).catch((err) => {
            rej(err)
        })
        .finally(() => {
            client.close()
        })
    })
}

function getAmountPendingRegistration() {
    let client = new ImapClient(host, port, {
        auth: {
            user: login,
            pass: pass
        },
        useSecureTransport: true,
        logLevel: 'info'
    })    

    client.onerror = function(err) {
        console.log(err)
    }

    return new Promise((res, rej) => {
        client.connect().then(() => {
            return client.selectMailbox('TANKI_RTG')
        }).then((mailBox) => {
            res(mailBox.exists)
        }).finally(() => {
            client.close()
        })
    })
}


async function sendInvites(invites) {
    let transporter = nodemailer.createTransport({
        host: "smtp.yandex.ru",
        port: 465,
        secure: true,
        auth: {
            user: 'no-reply-to-rank',
            pass: '' // TODO: pass empty
        }
    })
    let promises = []
    for (const invite of invites) {
        promises.push(
            transporter.sendMail({
                from: '"TO Rank" <no-reply-to-rank@ya.ru>',
                to: `${invite.email}`,
                subject: "Invite code",
                text: invite.jwt
            })
        )
    }
    return Promise.all(promises)
}

module.exports = {checkNewRegistrations, getAmountPendingRegistration, sendInvites}