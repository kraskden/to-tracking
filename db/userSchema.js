const mongoose = require('mongoose')
const Schema = mongoose.Schema
const Int32 = require('mongoose-int32');

let userSchema = new Schema({
    login: String,
    password: String,
    role: {
        type: String,
        default: 'User',
        enum: ['Admin', 'User']
    },
    accounts: [
        {
            type: mongoose.Types.ObjectId
        }
    ],
    favourites: [
        {
            type: mongoose.Types.ObjectId
        }
    ]
    // 
})

module.exports = userSchema