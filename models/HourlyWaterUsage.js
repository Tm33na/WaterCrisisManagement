// models/HourlyWaterUsage.js

const mongoose = require('mongoose');

const HourlyWaterUsageSchema = new mongoose.Schema({
    // The specific hour for which this data is aggregated (start of the hour in UTC)
    // Example: 2025-06-14T01:00:00.000Z represents the hour from 01:00:00 to 01:59:59 UTC
    hour: {
        type: Date,
        required: true,
        // Ensures only one entry per home/sensor per hour, crucial for upsert logic
        unique: false // We will enforce uniqueness through compound index
    },
    // The total volume of water used by this specific sensor during this hour
    totalVolumeUsed: {
        type: Number,
        required: true,
        default: 0
    },
    unit: {
        type: String,
        required: true,
        default: 'liters' // Default unit, should align with sensor readings
    },
    // Metadata to link this aggregation back to its source
    metadata: {
        homeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Home',
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        controllerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Controller',
            required: true
        },
        sensorId: { // The specific sensor whose readings are aggregated
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Sensor',
            required: true
        },
        sensorType: {
            type: String,
            enum: ['water_flow'], // Only water_flow sensors will have hourly usage
            required: true
        },
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

// Create a compound unique index to ensure only one document per sensor per hour.
// This is critical for preventing duplicate entries and for efficient upserts.
HourlyWaterUsageSchema.index({
    'metadata.sensorId': 1,
    hour: 1
}, { unique: true });

// Middleware to update `updatedAt` on save
HourlyWaterUsageSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware to update `updatedAt` on update (for findOneAndUpdate)
HourlyWaterUsageSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});


module.exports = mongoose.model('HourlyWaterUsage', HourlyWaterUsageSchema);
