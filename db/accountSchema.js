const mongoose = require('mongoose')
const Schema = mongoose.Schema
const Int32 = require('mongoose-int32');

let eventSchema = new Schema({
    timeStamp: {
        type: Date,
        default: Date.now()
    },
    events: [
        {
            eventType: {
                type: String,
                enum: ['Rank', 'Hull', 'Turret', 'Module', 'Drone']
            },
            eventData: String
        }
    ]
})

let stateSchema = new Schema({
    rank: Int32,
    hulls: [String],
    turrets: [String],
    modules: [String],
    drones: [String]
})

let trackingSchema = new Schema({
    timestamp: Date,
    trackType: {
        type: String,
        enum: ['Day', 'Week', 'Month', 'WeekMonth', 'Init'],
        default: 'Day'
    },
    golds: Int32,
    kills: Int32,
    deaths: Int32,
    cry: Int32,
    hasPremium: Boolean,
    score: Int32,
    time: Int32,
    activities: [
        {
            name: String,
            role: {
                type: String,
                enum: ['Turret', 'Hull', 'Module', 'Mode']
            },
            score: Int32,
            time: Int32
        }
    ],
    supplies: [
        {
            name: {
                type: String,
                enum: ['Aid', 'DA', 'DD', 'N2O', 'Mine', 'Battery', 'Gold']
            },
            count: Int32
        }
    ] 
}) 

let baseFields = []
trackingSchema.eachPath((path, type) => {
    if (['Int32', 'Boolean'].indexOf(type.instance) !== -1) {
        baseFields.push(path)
    }
})


let accountSchema = new Schema({
    login: String,
    tracking: [trackingSchema],
    currWeek: trackingSchema,
    currMonth: trackingSchema,
    daily: [trackingSchema],
    weekly: [trackingSchema],
    monthly: [trackingSchema],
    events: [eventSchema],
    state: stateSchema
})


module.exports = {accountSchema, baseFields}