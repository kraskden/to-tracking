const ImapClient = require('emailjs-imap-client').default
const nodemailer = require('nodemailer')

const messagesChecked = 20
const host = "imap.yandex.ru"
const port = 993
const login = "kraskden.net"
const pass = "Linux1love4ever"

function checkNewRegistrations() {
    let client = new ImapClient(host, port, {
        auth: {
            user: login,
            pass: pass
        },
        useSecureTransport: true
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
                        let email = msg['body[]'].match(/<p>\r\n\t(.*)\r\n<\/p>/)[1]
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
        useSecureTransport: true
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
            pass: 'Linux4ever'
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