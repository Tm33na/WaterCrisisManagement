// cronJobs/hourlyUsageScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const SensorReading = require('../models/SensorReading'); // Your SensorReading model
const HourlyWaterUsage = require('../models/HourlyWaterUsage'); // Our new model
const Sensor = require('../models/Sensor'); // Needed to get sensor details

/**
 * Helper function to calculate and save hourly water usage for a specific sensor.
 * @param {Date} hourStart - The start of the hour in UTC for which to calculate usage.
 * @param {Date} hourEnd - The end of the hour in UTC for which to calculate usage.
 * @param {mongoose.Types.ObjectId} sensorId - The ID of the water_flow sensor.
 * @param {mongoose.Types.ObjectId} controllerId - The ID of the controller associated with the sensor.
 * @param {mongoose.Types.ObjectId} homeId - The ID of the home associated with the controller.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user associated with the home.
 */
async function calculateAndSaveHourlyWaterUsageForSensor(
    hourStart,
    hourEnd,
    sensorId,
    controllerId,
    homeId,
    userId
) {
    try {
        // Aggregate readings for this specific flow sensor for the given hour
        const sensorFlowData = await SensorReading.aggregate([
            {
                $match: {
                    'metadata.sensorId': sensorId,
                    'metadata.sensorType': 'water_flow',
                    timestamp: { $gte: hourStart, $lt: hourEnd } // Use $lt for end to exclude next hour's start
                }
            },
            {
                $group: {
                    _id: null, // Group all matched readings into a single result
                    totalFlowValue: { $sum: "$value" },
                    unit: { $first: "$unit" } // Take the unit from the first reading
                }
            }
        ]);

        let totalVolumeUsed = 0;
        let primaryUnit = "liters"; // Default unit if no readings found

        if (sensorFlowData.length > 0) {
            totalVolumeUsed = sensorFlowData[0].totalFlowValue;
            primaryUnit = sensorFlowData[0].unit || "liters";
        }

        // Upsert the hourly water usage record
        await HourlyWaterUsage.findOneAndUpdate(
            {
                'metadata.sensorId': sensorId,
                hour: hourStart // Match by sensor ID and the start of the hour
            },
            {
                $set: {
                    totalVolumeUsed: totalVolumeUsed,
                    unit: primaryUnit,
                    metadata: { // Ensure metadata is set correctly on upsert
                        homeId: homeId,
                        userId: userId,
                        controllerId: controllerId,
                        sensorId: sensorId,
                        sensorType: 'water_flow'
                    }
                }
            },
            {
                upsert: true, // Create if not exists
                new: true,   // Return the updated/new document
                setDefaultsOnInsert: true // Apply default values for fields like `createdAt` on insert
            }
        );
        console.log(`[HOURLY CRON] Saved/Updated hourly usage for Sensor ${sensorId.toString()} at ${hourStart.toISOString()}: ${totalVolumeUsed} ${primaryUnit}`);

    } catch (error) {
        console.error(`[HOURLY CRON] Error calculating hourly water usage for sensor ${sensorId.toString()} at ${hourStart.toISOString()}:`, error);
    }
}

/**
 * Schedules a cron job to calculate and save hourly water usage for all water_flow sensors
 * for the *previous* hour. This runs every hour.
 */
const startHourlyUsageCron = () => {
    // Schedule to run every hour at minute 5 (e.g., 00:05, 01:05, 02:05 etc. UTC)
    // This gives a few minutes buffer for sensor readings from the previous hour to be saved.
    cron.schedule('5 * * * *', async () => {
        console.log('[HOURLY CRON] Running hourly water usage aggregation job...');

        // Calculate the previous hour's window in UTC
        const now = new Date();
        const hourEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
        console.log(hourEnd);
        const hourStart = new Date(hourEnd.getTime() - 60 * 60 * 1000); // Subtract 1 hour
        console.log(hourStart);

        console.log(`[HOURLY CRON] Aggregating data for hour: ${hourStart.toISOString()} to ${hourEnd.toISOString()}`);

        try {
            // Find all water_flow sensors
            const flowSensors = await Sensor.find({ type: 'water_flow' })
                                            .populate({ // Populate controller and home to get user/home IDs
                                                path: 'controllerId',
                                                populate: { path: 'homeId' }
                                            })
                                            .lean(); // Return plain JavaScript objects for efficiency

            if (flowSensors.length === 0) {
                console.log('[HOURLY CRON] No water_flow sensors found. Skipping hourly aggregation.');
                return;
            }

            // Iterate over each water_flow sensor and calculate its hourly usage
            for (const sensor of flowSensors) {
                // Ensure all linked IDs are available
                if (sensor.controllerId && sensor.controllerId.homeId && sensor.controllerId.homeId.userId) {
                    await calculateAndSaveHourlyWaterUsageForSensor(
                        hourStart,
                        hourEnd,
                        sensor._id,
                        sensor.controllerId._id,
                        sensor.controllerId.homeId._id,
                        sensor.controllerId.homeId.userId
                    );
                } else {
                    console.warn(`[HOURLY CRON] Skipping sensor ${sensor._id} due to incomplete linked data (controller/home/user).`);
                }
            }
            console.log('[HOURLY CRON] Hourly water usage aggregation job completed.');
        } catch (error) {
            console.error('[HOURLY CRON] Error in hourly water usage cron job:', error);
        }
    }, {
        timezone: "UTC" // Important: Run based on UTC time for consistency
    });

    console.log('Hourly water usage cron job scheduled to run daily at minute 5 of every hour UTC.');
};

module.exports = startHourlyUsageCron;
