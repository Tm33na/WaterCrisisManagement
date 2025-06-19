// dailyWaterUsageScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');

// Import your Mongoose models
const Home = require('../models/Home');
const User = require('../models/User');
const DailyWaterUsage = require('../models/DailyWaterUsage');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const Controller = require('../models/Controller');

/**
 * Helper to get the start of the current or a given UTC day as a UTC Date object.
 * This is crucial for correctly querying and storing daily usage data based on UTC.
 * For example, if 'nowUTC' is 2025-06-15 14:30:00 UTC,
 * this function returns a UTC Date object representing 2025-06-15 00:00:00 UTC.
 * @param {Date} dateInUTC - A UTC Date object representing the current moment.
 * @returns {Date} A UTC Date object representing 00:00:00 UTC of the corresponding UTC day.
 */
function getStartOfUTCDay(dateInUTC) {
    const utcDate = new Date(dateInUTC.getTime()); // Create a copy to avoid modifying original
    utcDate.setUTCHours(0, 0, 0, 0); // Set to start of the UTC day
    return utcDate;
}

/**
 * Helper to get the end of the current or a given UTC hour as a UTC Date object.
 * This is used as the upper bound for querying sensor readings for the current hour's aggregation.
 * For example, if 'nowUTC' leads to the current UTC hour being 14:00:00 UTC,
 * this function returns a UTC Date object representing 14:59:59.999 UTC.
 * @param {Date} dateInUTC - A UTC Date object representing the current moment.
 * @returns {Date} A UTC Date object representing HH:59:59.999 UTC of the corresponding UTC hour.
 */
function getEndOfUTCHour(dateInUTC) {
    const utcDate = new Date(dateInUTC.getTime()); // Create a copy
    utcDate.setUTCMinutes(59, 59, 999); // Set to end of the current hour in UTC
    return utcDate;
}


/**
 * Helper to calculate & save water usage per home for the *current UTC day*.
 * This function will either create a new daily usage record or update an existing one
 * for the current UTC day with the latest cumulative usage.
 * @param {string} userId - The ID of the user.
 * @param {string} homeId - The ID of the home.
 * @param {Date} nowUTC - The current UTC Date object when the cron job runs.
 */
async function calculateAndSaveDailyWaterUsage(userId, homeId, nowUTC) {
    try {
        // Determine the start of the current UTC day (00:00:00 UTC).
        // This date will serve as the unique identifier for the daily usage record
        // to ensure only one entry per home per UTC day.
        const startOfUTCDay = getStartOfUTCDay(nowUTC);

        // Determine the end of the aggregation period. This ensures we sum readings
        // from the start of the UTC day up to the very end of the current UTC hour.
        const endOfAggregationPeriodUTCHour = getEndOfUTCHour(nowUTC);

        console.log(`[CRON] Aggregating usage for home ${homeId}. UTC Day: ${startOfUTCDay.toISOString()}. UTC Query Range: ${startOfUTCDay.toISOString()} to ${endOfAggregationPeriodUTCHour.toISOString()}`);

        const home = await Home.findOne({ _id: homeId, userId: userId });
        if (!home) {
            console.log(`[SKIP] Home ${homeId} not found for user ${userId}`);
            return;
        }

        const controllers = await Controller.find({ homeId: home._id }).lean();
        // If no controllers are found for the home, set the daily usage to 0.
        // The 'upsert: true' option ensures that if a record for this home and date
        // already exists, it will be updated; otherwise, a new one will be created.
        if (!controllers.length) {
            await DailyWaterUsage.findOneAndUpdate(
                { homeId, date: startOfUTCDay }, // Query: find record for this home and the start of this UTC day
                { $set: { totalVolumeUsed: 0, unit: "liters" } }, // Update: set totalVolumeUsed to 0
                { upsert: true, new: true } // Options: create if not found, return the new/updated document
            );
            console.log(`[INFO] No controllers found. Set usage to 0 for home ${homeId} for UTC date starting ${startOfUTCDay.toISOString()}`);
            return;
        }

        const controllerIds = controllers.map(c => c._id);
        const flowSensors = await Sensor.find({
            controllerId: { $in: controllerIds },
            type: 'water_flow'
        }).lean();

        // If no water_flow sensors are found for the home, set the daily usage to 0.
        if (!flowSensors.length) {
            await DailyWaterUsage.findOneAndUpdate(
                { homeId, date: startOfUTCDay },
                { $set: { totalVolumeUsed: 0, unit: "liters" } },
                { upsert: true, new: true }
            );
            console.log(`[INFO] No water_flow sensors found. Set usage to 0 for home ${homeId} for UTC date starting ${startOfUTCDay.toISOString()}`);
            return;
        }

        let totalVolumeUsed = 0;
        let unit = "liters"; // Default unit, will be updated if sensor data provides one

        // Iterate through each flow sensor to aggregate its readings for the current UTC day/hour range
        for (const sensor of flowSensors) {
            const sensorFlowData = await SensorReading.aggregate([
                {
                    $match: {
                        'metadata.sensorId': sensor._id,
                        'metadata.sensorType': 'water_flow',
                        timestamp: {
                            $gte: startOfUTCDay, // Include readings from the start of the UTC day
                            $lt: endOfAggregationPeriodUTCHour // Include readings up to the end of the current UTC hour
                        }
                    }
                },
                {
                    $group: {
                        _id: null, // Group all matched documents into a single group to sum their values
                        totalFlowValue: { $sum: "$value" }, // Sum the 'value' field (e.g., flow readings)
                        unit: { $first: "$unit" } // Get the unit from the first document (assuming units are consistent)
                    }
                }
            ]);

            // If data is found for the sensor and totalFlowValue is a number, add it to the cumulative total.
            if (sensorFlowData.length > 0 && typeof sensorFlowData[0].totalFlowValue === 'number') {
                totalVolumeUsed += sensorFlowData[0].totalFlowValue;
                unit = sensorFlowData[0].unit || unit; // Update the unit if a valid one is found in the sensor data
            }
        }

        // This is the final and crucial step: update or create the daily water usage record.
        // Because 'date' is fixed to the start of the UTC day and 'upsert: true' is used,
        // this operation will always update the *existing* record for the current day
        // with the newly calculated cumulative usage, preventing duplicate entries.
        await DailyWaterUsage.findOneAndUpdate(
            { homeId, date: startOfUTCDay }, // Match by home ID and the start of the UTC day
            { $set: { totalVolumeUsed, unit } }, // Overwrite the totalVolumeUsed with the new cumulative sum
            { upsert: true, new: true } // Create if not found, return the updated document
        );

        console.log(`[SUCCESS] Updated daily usage for home ${homeId} for UTC date starting ${startOfUTCDay.toISOString()} - ${totalVolumeUsed} ${unit}`);
    } catch (err) {
        console.error(`[ERROR] Failed daily usage aggregation for home ${homeId}:`, err);
    }
}

/**
 * Schedule job: run hourly at minute 35 (e.g., 00:35, 01:35, ...) UTC.
 * This specific time (minute 35) provides a small buffer after the start of each UTC hour
 * for sensor readings to be potentially logged before aggregation.
 * This cron job will trigger the calculation and update for the *current UTC day's cumulative usage*.
 */
const startDailyUsageCron = () => {
    // The cron schedule '35 * * * *' means "at 35 minutes past every hour, every day, every month, every day of the week".
    cron.schedule('5 * * * *', async () => {
        console.log('[CRON] Starting hourly daily water usage aggregation (based on UTC day boundaries)...');
        const nowUTC = new Date(); // Get current time in UTC when the cron job fires

        try {
            const users = await User.find({}).select('_id').lean();
            if (!users.length) {
                console.log('[CRON] No users found. Skipping aggregation.');
                return;
            }

            // Iterate through all users and their homes to calculate and update water usage.
            // This ensures that each user's homes have their daily water usage records
            // updated hourly with cumulative data.
            for (const user of users) {
                const homes = await Home.find({ userId: user._id }).select('_id').lean();
                for (const home of homes) {
                    // Call the helper function to calculate and save usage for each home.
                    // This function handles the upsert logic.
                    await calculateAndSaveDailyWaterUsage(user._id, home._id, nowUTC);
                }
            }

            console.log('[CRON] Completed hourly daily water usage aggregation.');
        } catch (err) {
            console.error('[CRON] Error during overall aggregation process:', err);
        }
    }, {
        timezone: "UTC" // It's best practice to keep cron job timezone as UTC for server-side stability.
    });

    console.log('[CRON] Scheduled daily water usage aggregation to run every hour at minute 35 (UTC).');
};

module.exports = startDailyUsageCron;
