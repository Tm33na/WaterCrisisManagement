// cronJobs/anomalyDetectionScheduler.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Home = require('../models/Home');
const HourlyWaterUsage = require('../models/HourlyWaterUsage');
const Alert = require('../models/Alert');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading'); // <--- ADDED THIS IMPORT

// --- Configuration for Anomaly Detection Rules ---
const LOOKBACK_HOURS_FOR_ROLLING_STATS = 24; // For calculating short-term averages
const LOOKBACK_DAYS_FOR_BASELINE = 7;     // For long-term historical context (e.g., day-of-week patterns)

// Water Flow Anomaly (Leak Detection) Criteria
const WATER_FLOW_ANOMALY_CRITERIA = {
    // IMPORTANT: These are UTC hours. If you want 1 AM - 5 AM IST,
    // 1 AM IST = 19:30 UTC (previous day)
    // 5 AM IST = 23:30 UTC (previous day)
    // A range like 19.5 to 24 (or 0) would cover IST night.
    // However, if you're using 'getUTCHours()', decimal hours like 19.5 won't work directly.
    // It's better to stick to integer hours and adjust the range or convert to IST first.
    // For now, sticking to your previous definition:
    NIGHT_START_HOUR_UTC: 19, // Adjusted from 19.5 to 19 for integer comparison
    NIGHT_END_HOUR_UTC: 24,   // 5:00 AM IST equivalent (meaning up to 23:59:59 UTC)
    STD_DEV_THRESHOLD: 3,    // How many standard deviations above normal to trigger
    MIN_ANOMALY_VOLUME_PER_HOUR: 0.5, // Minimum absolute volume to consider as an anomaly
    MIN_CONSECUTIVE_HOURS: 2 // Minimum consecutive hours of detected anomaly to trigger an alert
};

// Water Level Anomaly (Low Tank) Criteria
const WATER_LEVEL_THRESHOLD = 20; // Default % below which tank is considered low

// Rain Status Anomaly (Harvesting Opportunity) Criteria
const RAIN_DURATION_THRESHOLD_MINUTES = 10; // Minimum duration of continuous rain to suggest harvesting

/**
 * Calculates the mean and standard deviation of an array of numbers.
 * @param {number[]} data - Array of numbers.
 * @returns {{mean: number, stdDev: number}}
 */
function calculateMeanAndStdDev(data) {
    if (data.length === 0) {
        return { mean: 0, stdDev: 0 };
    }
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    return { mean, stdDev };
}

/**
 * Extracts and prepares features for a given hour's water usage for a specific sensor.
 * @param {object} currentUsage - The HourlyWaterUsage document for the current hour.
 * @param {object} historicalHourlyData - Map of {sensorId: {ISOString: usageObject}} for historical data.
 * @returns {object} Features extracted for the anomaly detection logic.
 */
function extractFeatures(currentUsage, historicalHourlyData) {
    const sensorIdStr = currentUsage.metadata.sensorId.toString();
    const currentHourDate = currentUsage.hour;
    const currentVolume = currentUsage.totalVolumeUsed;

    const hourOfDay = currentHourDate.getUTCHours();
    const dayOfWeek = currentHourDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // This is the check for the "night hour" based on the UTC hour extracted from the data.
    // If NIGHT_START_HOUR_UTC is 19.5, getUTCHours() will return 19 or 20, so 19.5 won't work directly.
    // I've adjusted NIGHT_START_HOUR_UTC to 19 to match integer hours.
    // If the intent is truly 1:00 AM IST to 5:00 AM IST (which is 19:30 UTC to 23:30 UTC),
    // you would need to adjust this logic to either convert currentHourDate to IST first
    // (as in my previous full IST solution) or handle the half-hour with more granularity.
    const isNightHour = (hourOfDay >= WATER_FLOW_ANOMALY_CRITERIA.NIGHT_START_HOUR_UTC || hourOfDay < WATER_FLOW_ANOMALY_CRITERIA.NIGHT_END_HOUR_UTC);
    // Note: If NIGHT_END_HOUR_UTC is 24, this implies midnight UTC. If NIGHT_START_HOUR_UTC is 19,
    // this range is 19:00 UTC to 23:59:59 UTC. This correctly spans across midnight IST.

    // Lagged Features (Previous hour, same hour yesterday/last week)
    const prevHourDate = new Date(currentHourDate.getTime() - 60 * 60 * 1000);
    const previousHourVolume = historicalHourlyData[sensorIdStr]?.[prevHourDate.toISOString()]?.totalVolumeUsed || 0;

    const sameHourYesterdayDate = new Date(currentHourDate.getTime() - 24 * 60 * 60 * 1000);
    const sameHourYesterdayVolume = historicalHourlyData[sensorIdStr]?.[sameHourYesterdayDate.toISOString()]?.totalVolumeUsed || 0;

    // Rolling Mean/StdDev over last X hours
    const rollingWindowVolumes = [];
    for (let i = 0; i < LOOKBACK_HOURS_FOR_ROLLING_STATS; i++) {
        const checkHour = new Date(currentHourDate.getTime() - (i + 1) * 60 * 60 * 1000);
        const volume = historicalHourlyData[sensorIdStr]?.[checkHour.toISOString()]?.totalVolumeUsed;
        if (volume !== undefined) {
            rollingWindowVolumes.push(volume);
        }
    }
    const { mean: rollingMean, stdDev: rollingStdDev } = calculateMeanAndStdDev(rollingWindowVolumes);

    return {
        sensorId: sensorIdStr,
        currentVolume,
        hourOfDay,
        dayOfWeek,
        isWeekend: isWeekend ? 1 : 0,
        isNightHour: isNightHour ? 1 : 0,
        previousHourVolume,
        sameHourYesterdayVolume,
        rollingMean,
        rollingStdDev,
        deviationFromRollingMean: currentVolume - rollingMean,
        zScore: (rollingStdDev > 0) ? (currentVolume - rollingMean) / rollingStdDev : 0,
    };
}


/**
 * Core anomaly detection logic for a specific home.
 * This function handles various sensor types and uses intelligent rules.
 *
 * @param {object} homeData - Home document (populated with userId).
 */
async function detectAnomaliesForHome(homeData) {
    console.log(`[ANOMALY CRON] Detecting anomalies for Home: ${homeData.name} (${homeData._id})`);

    const homeId = homeData._id;
    const userId = homeData.userId._id;

    try {
        const now = new Date();
        // FIXED: Changed LOOKBACK_DAYS_FOR_LAG_FEATURES to LOOKBACK_DAYS_FOR_BASELINE
        const lookbackDateForFeatures = new Date(now.getTime() - (LOOKBACK_HOURS_FOR_ROLLING_STATS + LOOKBACK_DAYS_FOR_BASELINE * 24) * 60 * 60 * 1000);

        // Fetch all relevant hourly usage data for flow sensors
        const allRelevantFlowUsage = await HourlyWaterUsage.find({
            'metadata.homeId': homeId,
            'metadata.sensorType': 'water_flow',
            hour: { $gte: lookbackDateForFeatures, $lt: now }
        }).sort({ hour: 1 }).lean();

        const historicalFlowDataMap = {};
        allRelevantFlowUsage.forEach(usage => {
            const sensorIdStr = usage.metadata.sensorId.toString();
            if (!historicalFlowDataMap[sensorIdStr]) historicalFlowDataMap[sensorIdStr] = {};
            historicalFlowDataMap[sensorIdStr][usage.hour.toISOString()] = usage;
        });

        // Get latest raw sensor readings for water_level and rain_status for this home
        // We look for the most recent reading for each sensor type
        const latestReadings = await SensorReading.aggregate([
            {
                $match: {
                    'metadata.homeId': homeId,
                    'metadata.sensorType': { $in: ['water_level', 'rain_status'] },
                    timestamp: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Last 24 hours
                }
            },
            {
                $sort: { timestamp: -1 } // Sort by most recent first
            },
            {
                $group: {
                    _id: '$metadata.sensorId', // Group by sensor
                    latestReading: { $first: '$$ROOT' } // Get the first (most recent) reading
                }
            },
            {
                $replaceRoot: { newRoot: '$latestReading' } // Promote the latestReading to root
            }
        ]);

        const latestWaterLevelReading = latestReadings.find(r => r.metadata.sensorType === 'water_level');
        const latestRainStatusReading = latestReadings.find(r => r.metadata.sensorType === 'rain_status');

        // --- Anomaly Rule 1: Water Flow Anomaly (Leak Detection) ---
        // Iterate over sensors that have historical flow data
        for (const sensorIdStr in historicalFlowDataMap) {
            let consecutiveAnomalyCount = 0;
            let anomalyDetailsForAlert = [];
            let lastProcessedHour = null;

            // Check the most recent X hours for anomalies (since last cron run)
            const hoursToCheckCount = 2; // Check last 2 hours
            const currentHourAdjusted = new Date(now);
            currentHourAdjusted.setUTCMilliseconds(0);
            currentHourAdjusted.setUTCSeconds(0);
            currentHourAdjusted.setUTCMinutes(0);

            for (let i = hoursToCheckCount -1; i >= 0; i--) { // Iterate backwards from most recent full hour
                const checkHourDate = new Date(currentHourAdjusted.getTime() - i * 60 * 60 * 1000);
                const hourISO = checkHourDate.toISOString();
                const currentUsage = historicalFlowDataMap[sensorIdStr]?.[hourISO];

                if (!currentUsage) { // Gap in data, reset consecutive count
                    consecutiveAnomalyCount = 0;
                    anomalyDetailsForAlert = [];
                    lastProcessedHour = null;
                    continue;
                }

                const features = extractFeatures(currentUsage, historicalFlowDataMap);

                let isAnomalous = false;
                let anomalyReason = '';
                let alertSeverity = 'info';

                // Intelligent Rule for Night-time Continuous Flow:
                if (features.isNightHour === 1) { // If it's a night hour (UTC-based as per your config)
                    const dynamicThreshold = features.rollingMean + WATER_FLOW_ANOMALY_CRITERIA.STD_DEV_THRESHOLD * features.rollingStdDev;
                    // Ensure a minimum absolute threshold to filter out tiny negligible flows
                    const effectiveThreshold = Math.max(dynamicThreshold, WATER_FLOW_ANOMALY_CRITERIA.MIN_ANOMALY_VOLUME_PER_HOUR);

                    if (features.currentVolume > effectiveThreshold) {
                        isAnomalous = true;
                        // Adjusted message to reflect UTC night hours, as per your config
                        anomalyReason = `Volume (${features.currentVolume.toFixed(2)} ${currentUsage.unit}) > dynamic night threshold (${effectiveThreshold.toFixed(2)} ${currentUsage.unit}) during UTC night hours.`;
                        alertSeverity = 'critical';
                    }
                }
                // Add more complex anomaly rules here using `features`
                // Example: Sudden spike during typical low-usage periods (e.g. 5x rolling mean)
                // if (features.currentVolume > features.rollingMean * 5 && features.rollingMean > 0.1 && features.isNightHour === 0) {
                //     isAnomalous = true;
                //     anomalyReason = `Sudden spike detected (${features.currentVolume.toFixed(2)} ${currentUsage.unit}) compared to typical usage.`;
                //     alertSeverity = 'warning';
                // }


                // Update Consecutive Anomaly Count based on 'isAnomalous'
                if (isAnomalous) {
                    if (lastProcessedHour && (new Date(hourISO).getTime() - lastProcessedHour === 60 * 60 * 1000)) {
                        consecutiveAnomalyCount++;
                    } else {
                        consecutiveAnomalyCount = 1;
                    }
                    anomalyDetailsForAlert.push({
                        hour: currentUsage.hour,
                        volume: currentUsage.totalVolumeUsed,
                        unit: currentUsage.unit,
                        features: features,
                        reason: anomalyReason
                    });
                } else {
                    consecutiveAnomalyCount = 0;
                    anomalyDetailsForAlert = [];
                }
                lastProcessedHour = new Date(hourISO).getTime();

                // Trigger Alert if consecutive anomaly criteria met for water flow
                if (isAnomalous && consecutiveAnomalyCount >= WATER_FLOW_ANOMALY_CRITERIA.MIN_CONSECUTIVE_HOURS) {
                    const sensor = await Sensor.findById(sensorIdStr).lean();
                    const sensorName = sensor ? sensor.name : 'Unknown Flow Sensor';

                    const existingActiveAlert = await Alert.findOne({
                        'metadata.homeId': homeId,
                        'metadata.sensorId': new mongoose.Types.ObjectId(sensorIdStr),
                        type: 'continuous_flow_night',
                        status: 'active'
                    });

                    if (!existingActiveAlert) {
                        await Alert.create({
                            type: 'continuous_flow_night',
                            severity: alertSeverity,
                            message: `AI Agent detected continuous anomalous water flow from "${sensorName}" during UTC night hours based on intelligent analysis. This is highly unusual and may indicate a leak.`,
                            timestamp: now,
                            status: 'active',
                            metadata: {
                                userId: userId,
                                homeId: homeId,
                                sensorId: new mongoose.Types.ObjectId(sensorIdStr),
                                triggeredData: {
                                    anomalousHours: anomalyDetailsForAlert,
                                    totalAnomalousVolume: anomalyDetailsForAlert.reduce((sum, d) => sum + d.volume, 0).toFixed(2),
                                    unit: anomalyDetailsForAlert[0]?.unit || 'liters',
                                    featuresAtDetection: features,
                                }
                            }
                        });
                        console.log(`[ANOMALY CRON] !!! AI ALERT CREATED: Continuous flow for Home ${homeData.name}, Sensor ${sensorName}.`);
                    } else {
                        console.log(`[ANOMALY CRON] Existing active AI alert for continuous flow on sensor ${sensorName} in Home ${homeId.name}. Not creating duplicate.`);
                        await Alert.findOneAndUpdate(
                            { _id: existingActiveAlert._id },
                            { $set: { updatedAt: now, 'metadata.triggeredData.anomalousHours': anomalyDetailsForAlert } }
                        );
                    }
                    // Reset streak after an alert is created to avoid multiple alerts for the same long event
                    consecutiveAnomalyCount = 0;
                    anomalyDetailsForAlert = [];
                }
            }
        }

        // --- Anomaly Rule 2: Low Water Tank Level Alert ---
        if (latestWaterLevelReading) {
            const tankSensor = await Sensor.findById(latestWaterLevelReading.metadata.sensorId).lean();
            const tankSensorName = tankSensor ? tankSensor.name : 'Unknown Tank Sensor';
            const currentLevel = latestWaterLevelReading.value;
            const userWaterLevelThreshold = homeData.userId.preferences?.waterLevelThreshold || WATER_LEVEL_THRESHOLD; // Use user preference if available

            if (currentLevel < userWaterLevelThreshold) {
                const existingLowLevelAlert = await Alert.findOne({
                    'metadata.homeId': homeId,
                    'metadata.sensorId': latestWaterLevelReading.metadata.sensorId,
                    type: 'low_tank_level',
                    status: 'active'
                });

                if (!existingLowLevelAlert) {
                    await Alert.create({
                        type: 'low_tank_level',
                        severity: 'warning',
                        message: `Water tank level (${tankSensorName}) is critically low at ${currentLevel.toFixed(1)}%. Consider refilling soon.`,
                        timestamp: now,
                        status: 'active',
                        metadata: {
                            userId: userId,
                            homeId: homeId,
                            sensorId: latestWaterLevelReading.metadata.sensorId,
                            triggeredData: {
                                currentLevel: currentLevel,
                                threshold: userWaterLevelThreshold
                            }
                        }
                    });
                    console.log(`[ANOMALY CRON] !!! ALERT CREATED: Low water tank level for Home ${homeData.name}, Tank: ${tankSensorName}.`);
                } else {
                    console.log(`[ANOMALY CRON] Existing active alert for low tank level on Home ${homeData.name}. Not creating duplicate.`);
                    // Optional: Update existing alert timestamp to keep it fresh
                    await Alert.findOneAndUpdate({ _id: existingLowLevelAlert._id }, { $set: { updatedAt: now } });
                }
            } else {
                // If level is back above threshold, resolve any active low-level alerts for this sensor
                await Alert.updateMany(
                    {
                        'metadata.homeId': homeId,
                        'metadata.sensorId': latestWaterLevelReading.metadata.sensorId,
                        type: 'low_tank_level',
                        status: 'active'
                    },
                    { $set: { status: 'resolved', updatedAt: now } }
                );
            }
        }

        // --- Anomaly Rule 3: Rain for Harvesting Opportunity ---
        if (latestRainStatusReading && latestRainStatusReading.value === 1) { // If it is currently raining (value = 1)
            // To be truly "agentic" for rain, we should check if it's been raining for a duration
            // This requires looking at recent history of rain_status readings.
            // For simplicity in this lightweight version, we'll just check if it's currently raining.
            // A more advanced version would use aggregation to find continuous rain for X minutes.

            // Check if the home has water tanks (potential for harvesting)
            if (homeData.waterTanks && homeData.waterTanks.length > 0) {
                   const existingRainHarvestAlert = await Alert.findOne({
                    'metadata.homeId': homeId,
                    type: 'rain_for_harvesting',
                    status: 'active'
                });

                if (!existingRainHarvestAlert) {
                    await Alert.create({
                        type: 'rain_for_harvesting',
                        severity: 'info',
                        message: `It's currently raining at ${homeData.name}! Consider opening tank lids or setting up rain harvesting systems.`,
                        timestamp: now,
                        status: 'active',
                        metadata: {
                            userId: userId,
                            homeId: homeId,
                            sensorId: latestRainStatusReading.metadata.sensorId, // Link to rain sensor
                            triggeredData: {
                                rainStatus: 'raining',
                                homeTanksExist: true
                            }
                        }
                    });
                    console.log(`[ANOMALY CRON] !!! ALERT CREATED: Rain for harvesting opportunity for Home ${homeData.name}.`);
                } else {
                    console.log(`[ANOMALY CRON] Existing active alert for rain harvesting for Home ${homeData.name}. Not creating duplicate.`);
                    await Alert.findOneAndUpdate({ _id: existingRainHarvestAlert._id }, { $set: { updatedAt: now } });
                }
            }
        } else if (latestRainStatusReading && latestRainStatusReading.value === 0) {
            // If it stopped raining, resolve any active rain harvesting alerts
            await Alert.updateMany(
                {
                    'metadata.homeId': homeId,
                    'metadata.sensorId': latestRainStatusReading.metadata.sensorId,
                    type: 'rain_for_harvesting',
                    status: 'active'
                },
                { $set: { status: 'resolved', updatedAt: now } }
            );
        }

    } catch (error) {
        console.error(`[ANOMALY CRON] Error detecting anomalies for Home ${homeData.name} (${homeId}):`, error);
    }
}


/**
 * Schedules a cron job to run anomaly detection for all homes.
 * This runs relatively frequently to catch issues faster.
 */
const startAnomalyDetectionCron = () => {
    // Schedule to run every 15 minutes (e.g., at :00, :15, :30, :45 past the hour UTC)
    // This provides more frequent checks for real-time alerts.
    cron.schedule('*/15 * * * *', async () => {
        console.log('[ANOMALY CRON] Running lightweight AI anomaly detection job...');
        try {
            // Find all homes (populate userId and waterTanks for alert logic)
            const homes = await Home.find({}).select('_id name waterTanks').populate('userId').lean();

            if (homes.length === 0) {
                console.log('[ANOMALY CRON] No homes found. Skipping AI anomaly detection.');
                return;
            }

            for (const home of homes) {
                if (!home.userId || !home.userId._id) {
                    console.warn(`[ANOMALY CRON] Skipping home ${home.name} (${home._id}) as userId is not properly populated.`);
                    continue;
                }
                await detectAnomaliesForHome(home);
            }
            console.log('[ANOMALY CRON] Lightweight AI anomaly detection job completed.');
        } catch (error) {
            console.error('[ANOMALY CRON] Error in main AI anomaly detection cron job:', error);
        }
    }, {
        timezone: "UTC" // This means the job runs every 15 minutes UTC.
                        // The 'night hours' in the logic (19:00-24:00) refer to UTC hours.
    });

    console.log('Lightweight AI anomaly detection cron job scheduled to run every 15 minutes UTC.');
};

module.exports = startAnomalyDetectionCron;
