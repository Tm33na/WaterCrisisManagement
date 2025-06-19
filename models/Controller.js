const mongoose = require('mongoose');

const ControllerSchema = new mongoose.Schema({
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  controllerHardwareId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  locationDescription: String,
  firmwareVersion: String,
  lastHeartbeat: Date,
  status: {
    type: String,
    enum: ['online', 'offline', 'error', 'updating'],
    default: 'offline'
  },
  installationDate: Date,
  configuration: {
    reportingIntervalSeconds: { type: Number, default: 300 },
    waterLevelSensorType: { type: String, default: 'ultrasonic' },
    rainSensorEnabled: { type: Boolean, default: true }
  },
  authToken: { // ⬅️ Add this
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Controller', ControllerSchema);
