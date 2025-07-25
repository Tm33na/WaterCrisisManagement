// models/Recommendation.js

const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
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
    // Type of recommendation (e.g., 'daily_conservation_tip', 'leak_prevention_advice', 'harvesting_opportunity')
    type: {
        type: String,
        required: true,
        enum: ['daily_conservation_tip', 'leak_prevention_advice', 'harvesting_opportunity', 'general_advice']
    },
    // The actual text content generated by the LLM
    content: {
        type: String,
        required: true
    },
    // Contextual data used to generate the recommendation (for debugging/analysis)
    contextData: {
        type: mongoose.Schema.Types.Mixed, // Store relevant usage, alert, weather data
        required: false
    },
    // Status to track if the user has seen/dismissed it
    status: {
        type: String,
        enum: ['new', 'read', 'dismissed'],
        default: 'new'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
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

// Index for efficient querying by user, home, and status
RecommendationSchema.index({ userId: 1, homeId: 1, status: 1 });

// Middleware to update `updatedAt` on save
RecommendationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware to update `updatedAt` on update (for findOneAndUpdate)
RecommendationSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: Date.now() });
    next();
});

module.exports = mongoose.model('Recommendation', RecommendationSchema);
