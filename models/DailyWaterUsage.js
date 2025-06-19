// models/DailyWaterUsage.js
const mongoose = require('mongoose');

const DailyWaterUsageSchema = new mongoose.Schema({
    homeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Home', // Assuming your Home model is named 'Home'
        required: true
    },
    date: {
        type: Date, // Store as Date, typically beginning of the day (e.g., YYYY-MM-DD 00:00:00Z)
        required: true,
        // The compound unique index ensures only one record per home per day
    },
    totalVolumeUsed: {
        type: Number,
        required: true,
        default: 0
    },
    unit: {
        type: String,
        default: 'liters' // Or 'gallons', 'm3' etc.
    }
}, { timestamps: true });

// Add a compound unique index to ensure only one record per home per day
DailyWaterUsageSchema.index({ homeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyWaterUsage', DailyWaterUsageSchema);

