const fetch = require('node-fetch')

function getUserData(user) {
    const url = `https://ratings.tankionline.com/api/eu/profile/?user=${user}&lang=en`
    return new Promise((res, rej) => {
        fetch(url).then(res => {
            return res.json()
        }).then((userData) => {
            if (userData.responseType === 'OK') {
                res(userData.response)
            } else {
                rej({status: 404})
            }
        })
    })
}


module.exports = getUserData