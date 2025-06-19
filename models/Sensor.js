const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
  controllerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Controller',
    required: true
  },
  sensorHardwareId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['water_level', 'rain_status', 'water_flow'] // Enforce sensor types
  },
  name: {
    type: String,
    required: true
  },
  associatedTankId: String, // Links to a specific tank in the Home's waterTanks array
  unit: String,
  model: String,
  pin: String, // GPIO pin
  calibrationData: mongoose.Schema.Types.Mixed // Flexible for different sensor calibration data
}, { timestamps: true });

module.exports = mongoose.model('Sensor', SensorSchema);