const OnlineManager = require("../db/online");
const { getPcuOnline } = require("../net/api");

module.exports = {

  async up(db, client) {
    let onlineDb = await db.collection('onlines').findOne({})
    onlineDb.days.forEach((day) => {
      let sum = 0;
      const pcu = day.pcu
      const len = day.track.length
      for (const track of day.track) {
        sum += track.online
      }
      const avg = Math.round(sum / len);
    
      let delta = 0;
      for (const track of day.track) {
        delta += Math.pow((track.online - avg), 2)
      }
    
      const sigma = Math.sqrt(delta / len)
    
      delete day.pcu
      day.online = {
        pcu: pcu,
        avg: avg,
        sigma: sigma
      }
      day.inbattles = {
        pcu: null,
        avg: null,
        sigma: null
      }
    })

    const todayPcu = onlineDb.today.pcu;
    onlineDb.today.online = {
      pcu: todayPcu,
      avg: null,
      sigma: null
    }
    onlineDb.today.inbattles = {
      pcu: null,
      avg: null,
      sigma: null
    }

    await db.collection('onlines').replaceOne({}, onlineDb)
  },

  async down(db, client) {
  }

};
