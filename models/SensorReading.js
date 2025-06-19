const mongoose = require('mongoose');

const SensorReadingSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  metadata: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    controllerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Controller', required: true },
    sensorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensor' },
    sensorType: { type: String, required: true },
    associatedTankId: String
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  unit: String,
  status: String,
  rawData: mongoose.Schema.Types.Mixed
}, {
  // --- ADD THIS LINE ---
  collection: 'sensor_readings' // Explicitly tell Mongoose to use this collection
});

module.exports = mongoose.model('SensorReading', SensorReadingSchema);