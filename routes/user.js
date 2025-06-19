const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Needed for mongoose.Types.ObjectId for comparison if associatedTankId is ObjectId
const auth = require('../middleware/authMiddleware'); // Path to your authentication middleware
const Alert = require('../models/Alert'); // Import the Alert model
const Recommendation = require('../models/Recommendation'); // Import the Recommendation model
// Mongoose Models (adjust paths as per your project structure)
const User = require('../models/User');
const Home = require('../models/Home');
const Controller = require('../models/Controller');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const DailyWaterUsage = require('../models/DailyWaterUsage'); // Ensure this model is imported if used directly for other purposes
const bcrypt=require('bcrypt');
// Define IST timezone for consistency
const IST_TIMEZONE = 'Asia/Kolkata';

// --- Helper Functions ---

/**
 * Helper function to get recent sensor readings from the SensorReading collection.
 * This is generic and works for any sensor type.
 * @param {mongoose.Types.ObjectId} sensorId - The ID of the sensor.
 * @returns {Promise<{value: number, unit: string, timestamp: Date, status: string} | null>}
 */
async function getRecentSensorReading(sensorId) {
    try {
        const latestReading = await SensorReading.findOne({ 'metadata.sensorId': sensorId })
                                                .sort({ timestamp: -1 })
                                                .select('value unit timestamp status -_id metadata')
                                                .lean();

        if (latestReading) {
            return {
                Type:latestReading.metadata.sensorType,
                value: latestReading.value,
                unit: latestReading.unit || '',
                timestamp: latestReading.timestamp,
                status: latestReading.status || 'active'
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching recent reading for sensor ${sensorId}:`, error);
        return null;
    }
}

/**
 * Calculates the UTC Date objects representing the start (00:00:00) and end (23:59:59.999)
 * of a specific calendar day in IST.
 * This is crucial for correctly querying and storing daily usage data based on IST.
 * @param {number} year - The IST year.
 * @param {number} month - The IST month (1-indexed).
 * @param {number} day - The IST day of the month.
 * @returns {{startOfISTDayUTC: Date, endOfISTDayUTC: Date}}
 */
function getISTDayBoundariesAsUTC(year, month, day) {
    // Create a Date object for the start of the IST day (00:00:00 IST)
    // We construct a UTC date for the target day, then adjust it by the IST offset
    // This gives us the UTC equivalent of 00:00:00 IST.
    // Date.UTC constructor treats month as 0-indexed.
    const startOfISTDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // IST is UTC+5:30, so to find the UTC time that *is* 00:00 IST, we subtract 5.5 hours from UTC midnight.
    startOfISTDay.setUTCHours(startOfISTDay.getUTCHours() - 5);
    startOfISTDay.setUTCMinutes(startOfISTDay.getUTCMinutes() - 30);

    // Create a Date object for the end of the IST day (23:59:59.999 IST)
    // We construct a UTC date for the target day, then adjust it for IST offset.
    const endOfISTDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    // Similar adjustment for the end of the day.
    endOfISTDay.setUTCHours(endOfISTDay.getUTCHours() - 5);
    endOfISTDay.setUTCMinutes(endOfISTDay.getUTCMinutes() - 30);

    return {
        startOfISTDayUTC: startOfISTDay,
        endOfISTDayUTC: endOfISTDay
    };
}


/**
 * Helper function to aggregate daily water usage for a given home/sensor(s)
 * directly from SensorReading data within a specific IST month.
 * This function calculates total water usage for each day based on IST day boundaries
 * by performing an aggregation directly on the SensorReading collection.
 * @param {mongoose.Types.ObjectId | string} homeId - The ID of the home.
 * @param {number} year - The IST year for the month.
 * @param {number} month - The IST month (1-indexed) for which to aggregate.
 * @returns {Promise<{labels: number[], dailyUsage: number[], unit: string}>}
 */
async function getDailyWaterUsageForHomeFromReadings(homeId, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate(); // Get number of days in the month

    const dailyUsageMap = new Map();
    let commonUnit = 'L'; // Default unit if no readings or unit is found

    // Find all water_flow sensors associated with this home via its controllers
    const controllers = await Controller.find({ homeId: homeId }).lean();
    if (!controllers.length) {
        // If no controllers, return empty usage data for all days of the month
        return { labels: Array.from({ length: daysInMonth }, (_, i) => i + 1), dailyUsage: Array(daysInMonth).fill(0), unit: commonUnit };
    }

    const controllerIds = controllers.map(c => c._id);
    const flowSensors = await Sensor.find({
        controllerId: { $in: controllerIds },
        type: 'water_flow'
    }).lean();

    if (!flowSensors.length) {
        // If no flow sensors, return empty usage data
        return { labels: Array.from({ length: daysInMonth }, (_, i) => i + 1), dailyUsage: Array(daysInMonth).fill(0), unit: commonUnit };
    }

    const sensorIds = flowSensors.map(s => s._id);

    // Calculate UTC boundaries for the entire requested IST month
    // This defines the overall window for sensor readings.
    const { startOfISTDayUTC: startOfMonthUTC } = getISTDayBoundariesAsUTC(year, month, 1);
    const { endOfISTDayUTC: endOfMonthUTC } = getISTDayBoundariesAsUTC(year, month, daysInMonth);

    // Aggregate all relevant water flow sensor readings for the entire month
    const monthlyReadingsAggregation = await SensorReading.aggregate([
        {
            $match: {
                'metadata.sensorId': { $in: sensorIds },
                'metadata.sensorType': 'water_flow',
                timestamp: {
                    $gte: startOfMonthUTC, // Start of the IST month (in UTC equivalent)
                    $lte: endOfMonthUTC    // End of the IST month (in UTC equivalent)
                }
            }
        },
        {
            $group: {
                _id: {
                    // Crucially, group by the day of the month based on the IST_TIMEZONE.
                    // This ensures that usage is summed for each IST calendar day (00:00 IST to 23:59 IST).
                    $dayOfMonth: { date: "$timestamp", timezone: IST_TIMEZONE }
                },
                totalVolume: { $sum: "$value" },
                unit: { $first: "$unit" } // Assume consistent unit for all readings of a sensor
            }
        },
        {
            $sort: { "_id": 1 } // Sort by day of month ascending
        }
    ]);

    monthlyReadingsAggregation.forEach(item => {
        dailyUsageMap.set(item._id, item.totalVolume); // Map day number to total volume
        if (item.unit) commonUnit = item.unit; // Capture a unit (assuming consistent units)
    });

    const labels = [];
    const dailyUsageVolumes = [];

    // Populate labels (days 1 to N) and fill in volumes from map (0 if no data for a day)
    for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i);
        dailyUsageVolumes.push(dailyUsageMap.get(i) || 0);
    }

    return { labels, dailyUsage: dailyUsageVolumes, unit: commonUnit };
}

/**
 * Helper function to fetch all homes for a user and populate their
 * IST-aligned monthly water usage data for a given month and year.
 * This centralizes the logic for getting homes and their usage data.
 * @param {string} userId - The ID of the user.
 * @param {number} year - The IST year for the month.
 * @param {number} month - The IST month (1-indexed).
 * @returns {Promise<Array<object>>} An array of home objects, each with a 'monthlyUsageData' property.
 */
async function fetchHomesAndPopulateMonthlyUsage(userId, year, month) {
    const homes = await Home.find({ userId }).lean();
    const homesWithMonthlyUsage = [];

    for (const home of homes) {
        // Calculate and add current month's IST-aligned daily water usage for THIS HOME
        home.monthlyUsageData = await getDailyWaterUsageForHomeFromReadings(home._id, year, month);
        homesWithMonthlyUsage.push(home);

    }
    return homesWithMonthlyUsage;
    
}


// --- Main API Routes ---

// @route   GET /api/user/water-usage/:year/:month
// @desc    Get monthly water usage data for the authenticated user's homes (overall sum across all homes)
// @access  Private (User)
router.get('/water-usage/:year/:month', auth, async (req, res) => {
    try {

        const { year, month } = req.params;
        const userId = req.user.id;

        // Validate year and month
        if (isNaN(year) || isNaN(month) || parseInt(month) < 1 || parseInt(month) > 12) {
            return res.status(400).json({ message: 'Invalid year or month provided.' });
        }
        const parsedYear = parseInt(year);
        const parsedMonth = parseInt(month);

        const daysInMonth = new Date(parsedYear, parsedMonth, 0).getDate(); // Get number of days in the month

        // Use the new helper to get homes already populated with monthly usage data
        const homesWithMonthlyUsage = await fetchHomesAndPopulateMonthlyUsage(userId, parsedYear, parsedMonth);

        if (!homesWithMonthlyUsage.length) {
            return res.json({ labels: Array.from({ length: daysInMonth }, (_, i) => i + 1), dailyUsage: Array(daysInMonth).fill(0), unit: "liters", message: 'No homes assigned to this user.' });
        }

        // Initialize a structure to hold daily totals across all homes for the requested month
        const overallDailyTotals = new Array(daysInMonth).fill(0);
        let overallUnit = "L"; // Default overall unit

        for (const home of homesWithMonthlyUsage) {
            // Sum volumes for each day across all homes using the pre-calculated monthlyUsageData
            home.monthlyUsageData.dailyUsage.forEach((volume, index) => {
                overallDailyTotals[index] += volume;
            });
            if (home.monthlyUsageData.unit) overallUnit = home.monthlyUsageData.unit; // Use the unit from one of the homes (assuming consistency)
        }
        res.json({
            month: parsedMonth,
            year: parsedYear,
            labels: Array.from({ length: daysInMonth }, (_, i) => i + 1), // Days of the month (1, 2, ..., N)
            dailyUsage: overallDailyTotals, // Corresponding summed usage for each day (IST-aligned)
            unit: overallUnit
        });

    } catch (error) {
        console.error('Error fetching overall water usage data:', error);
        res.status(500).json({ message: 'Server error fetching overall water usage data.' });
    }
});


// @route   GET /api/user/dashboard-data
// @desc    Get all homes, controllers, and their sensors for the authenticated user,
//          including per-home water usage and water tank levels.
// @access  Private (User)
router.get('/dashboard-data', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findOne({ _id: userId }).lean();
        const username = user ? user.username : 'User';

        const IST_TIMEZONE = 'Asia/Kolkata';

// Get current IST date
const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: IST_TIMEZONE }));

// Extract year and month
const currentYear = nowIST.getFullYear();
const currentMonth = nowIST.getMonth() + 1; // Months are 0-indexed in JS

// console.log(`Year: ${currentYear}, Month: ${currentMonth}`);

 
        const parseYear = parseInt(currentYear);
        const parseMonth = parseInt(currentMonth)
        // Get homes with monthly usage already calculated
        const homesWithDetails = await fetchHomesAndPopulateMonthlyUsage(userId, parseYear, parseMonth);
        if (!homesWithDetails || homesWithDetails.length === 0) {
            return res.json({ homes: [], username: username });
        }

        for (const home of homesWithDetails) {

            // 1. Fetch controllers
            const controllers = await Controller.find({ homeId: home._id }).lean();
            home.controllers = [];

            for (const controller of controllers) {

                if (controller.lastHeartbeat) {
                    controller.lastHeartbeat = new Date(controller.lastHeartbeat).toLocaleString('en-US', { timeZone: IST_TIMEZONE });
                } else {
                    controller.lastHeartbeat = 'N/A';
                }
                // 2. Fetch sensors and their recent readings
                const sensors = await Sensor.find({ controllerId: controller._id }).lean();

                for (const sensor of sensors) {
                    const latestReading = await getRecentSensorReading(sensor._id);
                                    // console.log(latestReading.Type+"helllllll");

                    sensor.readings = latestReading ? [latestReading] : [];
                }

                controller.sensors = sensors;
                home.controllers.push(controller);
            }

            // 3. Process tanks and associate sensors
            if (home.waterTanks && Array.isArray(home.waterTanks) && home.waterTanks.length > 0) {
                for (const tankDefinition of home.waterTanks) {
                    tankDefinition.readings = [];

                    const associatedSensors = home.controllers
                        .flatMap(c => c.sensors)
                        .filter(s =>
                            s.associatedTankId &&
                            tankDefinition.tankId &&
                            String(s.associatedTankId) === String(tankDefinition.tankId)
                        );
                    for (const sensor of associatedSensors) {
                        if (sensor.readings && sensor.readings.length > 0) {
                            tankDefinition.readings.push(sensor.readings[0]);
                        }
                    }
                }
            } else {
                home.waterTanks = [];
            }
        }

        return res.json({
            homes: homesWithDetails,
            username: username
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
});



// @route   GET /api/user/alerts
// @desc    Get recent alerts for the authenticated user
// @access  Private (User)
router.get('/alerts', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

        // Query alerts where metadata.userId matches the current user
        const alerts = await Alert.find({
            'metadata.userId': userId,
            timestamp: { $gte: thirtyDaysAgo }
        })
        .populate({
            path: 'metadata.homeId',
            model: 'Home',
            select: 'name'
        })
        .sort({ timestamp: -1 })
        .lean();


        // Format alerts to include homeName directly
        const formattedAlerts = alerts.map(alert => ({
            ...alert,
            homeName: alert.metadata && alert.metadata.homeId ? alert.metadata.homeId.name : 'N/A'
        }));

        res.json({ alerts: formattedAlerts });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ message: 'Server error fetching alerts.' });
    }
});

// @route   GET /api/user/recommendations
// @desc    Get recent recommendations for the authenticated user
// @access  Private (User)
router.get('/recommendations', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Recommendations from last 30 days

        // Find recommendations for the user, populate home details, and sort by timestamp
        const recommendations = await Recommendation.find({
            userId: userId,
            timestamp: { $gte: thirtyDaysAgo } // Assuming 'timestamp' field exists on Recommendation model
        })
        .populate({
            path: 'homeId', // Populate the homeId directly
            model: 'Home',
            select: 'name' // Select only the name of the home
        })
        .sort({ timestamp: -1 }) // Most recent first
        .lean();

        // Format recommendations to include homeName directly and other properties expected by frontend
        const formattedRecommendations = recommendations.map(rec => ({
            _id: rec._id,
            userId: rec.userId,
            homeId: rec.homeId ? rec.homeId._id : null, // Keep original homeId
            type: rec.type,
            title: rec.title || 'Recommendation', // Assuming title field exists or provide a default
            message: rec.content, // Frontend expects 'message' for the main text, but your model has 'content'
            impact: rec.contextData ? rec.contextData.impact : null, // Assuming impact could be in contextData
            timestamp: rec.timestamp,
            homeName: rec.homeId ? rec.homeId.name : 'N/A', // Attach home name
            // Add any other fields your frontend's renderRecommendations expects from the backend
            // e.g., description (if different from message), status, etc.
        }));

        res.json({ recommendations: formattedRecommendations });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ message: 'Server error fetching recommendations.' });
    }
});

router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user details
        const user = await User.findById(userId).select('-password').lean(); // Exclude password from the response

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Fetch homes associated with the user
        const homes = await Home.find({ userId: userId }).lean();

        // For each home, count controllers and sensors
        const homesWithCounts = await Promise.all(homes.map(async (home) => {
            const controllerCount = await Controller.countDocuments({ homeId: home._id });
            
            // Get all sensors by finding controllers first, then their sensors
            const controllersForHome = await Controller.find({ homeId: home._id }).select('_id').lean();
            const controllerIds = controllersForHome.map(c => c._id);
            const sensorCount = await Sensor.countDocuments({ controllerId: { $in: controllerIds } });

            return {
                _id: home._id,
                name: home.name,
                address: home.address,
                controllerCount: controllerCount,
                sensorCount: sensorCount,
                // Add any other home-specific details you want to include in the profile
            };
        }));

        res.json({
            user: {
                _id: user._id,
                firstname:user.firstName,
                lastname:user.lastName,
                username: user.username,
                email: user.email,
                // Add any other top-level user details you want to include
            },
            homes: homesWithCounts
        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});


router.post('/change-password',auth, async (req, res) => {
    try {
        const userId = req.user.id; // User ID from authenticated token
        const { oldPassword, newPassword, confirmNewPassword } = req.body;
        // Input validation
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: 'Please enter old password, new password, and confirm new password.' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: 'New password and confirm new password do not match.' });
        }

        if (newPassword.length < 6) { // Minimum password length, adjust as needed
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Compare old password with the hashed password in the database
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Old password is incorrect.' });
        }
        console.log("uewhfuinweifnn");

        
        user.passwordHash = newPassword;

        await user.save();

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});




module.exports = router;
