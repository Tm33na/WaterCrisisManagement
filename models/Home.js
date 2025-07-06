const mongoose = require('mongoose');

const HomeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  location: {
    type:String
  },
  waterTanks: [{
    tankId: { type: String, required: true }, // Unique within THIS home
    name: { type: String, required: true },
    capacityLitres: Number
  }]
}, { timestamps: true });

module.exports = mongoose.model('Home', HomeSchema);
