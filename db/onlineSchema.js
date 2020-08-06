const mongoose = require('mongoose')
const Schema = mongoose.Schema
const Int32 = require('mongoose-int32');


let onlineStampSchema = new Schema({
  timestamp: {
    type: Date,
    default: Date.now()
  },
  online: Int32
})

let daySchema = new Schema({
  date: Date,
  pcu: Int32,
  track: [onlineStampSchema]
})


let onlineSchema = new Schema({
  lastUpdate: {
    type: Date,
    default: Date.now()
  },
  lastClear: {
    type: Date,
    default: Date.now()
  },
  today: daySchema,
  days: [daySchema]
})




module.exports = onlineSchema