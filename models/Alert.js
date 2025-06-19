// models/Alert.js

const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
    // Type of anomaly detected (e.g., 'continuous_flow_night', 'unusual_daily_spike', 'low_tank_level', 'rain_while_irrigating', 'unusual_hourly_flow')
    type: {
        type: String,
        required: true,
        enum: ['continuous_flow_night', 'unusual_daily_spike','rain_for_harvesting', 'low_tank_level', 'rain_while_irrigating', 'unusual_hourly_flow']
    },
    // Severity of the alert (e.g., 'info', 'warning', 'critical')
    severity: {
        type: String,
        required: true,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },
    // A descriptive message for the alert
    message: {
        type: String,
        required: true
    },
    // Timestamp when the anomaly was detected/alert was created
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    // Current status of the alert (e.g., 'active', 'resolved', 'dismissed', 'false_positive')
    status: {
        type: String,
        enum: ['active', 'resolved', 'dismissed', 'false_positive'],
        default: 'active'
    },
    // Optional: User feedback on the alert
    feedback: {
        type: String,
        enum: ['confirmed_leak', 'fixed', 'not_a_leak', 'other'],
        required: false
    },
    // Metadata to link the alert to the relevant home, user, controller, and sensor
    metadata: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        homeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Home',
            required: true
        },
        controllerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Controller',
            required: false // Might not always be linked to a specific controller
        },
        sensorId: { // The specific sensor involved in the anomaly
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Sensor',
            required: false // Might be a home-level anomaly
        },
        // Store relevant data points that triggered the alert for context
        // Example: { hour: '2025-06-14T02:00:00.000Z', actualVolume: 50, avgVolume: 2 }
        triggeredData: {
            type: mongoose.Schema.Types.Mixed,
            required: false
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for efficient querying by home, user, and status
AlertSchema.index({ 'metadata.homeId': 1, status: 1 });
AlertSchema.index({ 'metadata.userId': 1, status: 1 });

// Middleware to update `updatedAt` on save
AlertSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware to update `updatedAt` on update (for findOneAndUpdate)
AlertSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});

module.exports = mongoose.model('Alert', AlertSchema);
