const fetch = require('node-fetch')

const OnlineProvider = {}

const URL = "https://tankionline.com/s/status.js"

OnlineProvider.getCurrentOnline = async () => {
  let res = await fetch(URL)
  let obj = await res.json()

  let nodes = Object.values(obj.nodes)

  return nodes.reduce((acc, curr) => {
    acc.online += curr.online
    acc.inbattles += curr.inbattles
    return acc
  }, {online: 0, inbattles: 0})
}

module.exports = OnlineProvider