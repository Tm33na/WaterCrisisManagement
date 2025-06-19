require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const startDailyUsageCron = require('./cronJobs/dailyUsageScheduler'); // Import the cron job
const startHourlyUsageCron = require('./cronJobs/hourlyUsageScheduler'); // <--- NEW IMPORT
const startAnomalyDetectionCron = require('./cronJobs/anomalyDetectionScheduler');
const startRecommendationCron = require('./cronJobs/recommendationScheduler'); // <--- NEW IMPORT
// Import models (SensorReading, User, Home, Controller, Sensor will be used)
const { User, Home, Controller, Sensor,DailyWaterUsage, SensorReading,HourlyWaterUsage } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// --- Middleware ---
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));


// --- MongoDB Connection ---
mongoose.connect(MONGODB_URI,{ dbName: 'water_monitoring_db' })
  .then(() => {
    console.log('MongoDB connected successfully.');
           console.log('Server started. Running initial daily water usage calculation for current day...');
           recalculateAllHistoricalHourlyWaterUsage(User, Home, Controller, Sensor, SensorReading,HourlyWaterUsage);
    recalculateAllHistoricalDailyWaterUsage(User, Home, Controller, Sensor, DailyWaterUsage, SensorReading);
    startHourlyUsageCron();
    startDailyUsageCron();
    startAnomalyDetectionCron();
    startRecommendationCron(); // <--- NEW: Start the recommendation job
})
  .catch(err => console.error('MongoDB connection error:', err));

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware'); // Our JWT auth middleware
const adminRoutes = require('./routes/admin'); // NEW: Import admin routes
const userRoutes = require('./routes/user'); // NEW: Import admin routes
const sensorDataRoutes = require('./routes/sensorData');
const controllerRoutes = require('./routes/controller');

// Use auth routes for login/register
app.use('/api/auth', authRoutes);
app.use('/api/admin', authMiddleware, adminRoutes); // NEW: Protect all admin routes
app.use('/api/user', authMiddleware, userRoutes); // NEW: Protect all user routes
app.use('/api/sensor-data',sensorDataRoutes);
app.use('/api/controllers', controllerRoutes);

// --- Protected API Routes for Dashboards ---
// --- Serve HTML Pages ---
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
// User Dashboard Data Route (Regular User)
// This route will be hit by the 'user-dashboard.html' to fetch THEIR specific data
app.get('/api/user/dashboard-data', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from the authenticated token

    // Fetch user's homes
    const homes = await Home.find({ userId }).lean(); // .lean() for plain JS objects

    if (homes.length === 0) {
      return res.json({ message: 'No homes found for this user.', user: req.user, homes: [] });
    }

    const homeIds = homes.map(home => home._id);

    // Fetch controllers associated with these homes
    const controllers = await Controller.find({ homeId: { $in: homeIds } }).lean();
    const controllerIds = controllers.map(ctrl => ctrl._id);

    // Fetch sensors associated with these controllers
    const sensors = await Sensor.find({ controllerId: { $in: controllerIds } }).lean();
    const sensorIds = sensors.map(sens => sens._id);

    // Fetch recent sensor readings for these sensors (e.g., last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log('Querying for sensorIds:', sensorIds);
    const recentReadings = await SensorReading.find({
      'metadata.userId': userId, // Crucial for filtering by user in time series
      'metadata.sensorId': { $in: sensorIds },
      timestamp: { $gte: twentyFourHoursAgo }
    })
    .sort({ timestamp: -1 }) // Get most recent first
    .lean();
    console.log(recentReadings);
    // Organize data: Attach controllers to homes, sensors to controllers, and readings to sensors/controllers
    const populatedHomes = homes.map(home => {
      home.controllers = controllers.filter(ctrl => ctrl.homeId.equals(home._id)).map(ctrl => {
        ctrl.sensors = sensors.filter(sens => sens.controllerId.equals(ctrl._id)).map(sens => {
          sens.readings = recentReadings.filter(reading => reading.metadata.sensorId.equals(sens._id));
          return sens;
        });
        return ctrl;
      });
      return home;
    });

    res.json({
      message: 'User dashboard data fetched successfully',
      user: req.user,
      homes: populatedHomes
    });

  } catch (err) {
    console.error('Error fetching user dashboard data:', err.message);
    res.status(500).send('Server error');
  }
});


// Admin Dashboard Data Route (Admin User)
// This route will be hit by the 'admin-dashboard.html' to fetch ALL user data
app.get('/api/admin/dashboard-data', authMiddleware, async (req, res) => {
  // Check if the authenticated user has 'admin' role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }

  try {
    // Fetch all users (excluding admins if preferred, or include them)
    const allUsers = await User.find({ role: 'user' }).lean(); // Fetch only regular users
    // Alternatively: const allUsers = await User.find().lean(); // Fetch all users including admins

    const usersWithData = [];

    for (const user of allUsers) {
      const homes = await Home.find({ userId: user._id }).lean();
      const homeIds = homes.map(home => home._id);

      const controllers = await Controller.find({ homeId: { $in: homeIds } }).lean();
      const controllerIds = controllers.map(ctrl => ctrl._id);

      const sensors = await Sensor.find({ controllerId: { $in: controllerIds } }).lean();
      const sensorIds = sensors.map(sens => sens._id);

      // Fetch more recent readings (e.g., last 48 hours for admin overview)
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const recentReadings = await SensorReading.find({
        'metadata.userId': user._id, // Filter readings by THIS user's ID
        'metadata.sensorId': { $in: sensorIds },
        timestamp: { $gte: fortyEightHoursAgo }
      })
      .sort({ timestamp: -1 })
      .lean();


      // Structure the data similar to user dashboard but for each user
      const populatedHomes = homes.map(home => {
        home.controllers = controllers.filter(ctrl => ctrl.homeId.equals(home._id)).map(ctrl => {
          ctrl.sensors = sensors.filter(sens => sens.controllerId.equals(ctrl._id)).map(sens => {
            sens.readings = recentReadings.filter(reading => reading.metadata.sensorId.equals(sens._id));
            return sens;
          });
          return ctrl;
        });
        return home;
      });

      usersWithData.push({
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
        preferences: user.preferences,
        homes: populatedHomes
      });
    }

    res.json({
      message: 'Admin dashboard data fetched successfully',
      adminUser: req.user,
      allUsersData: usersWithData
    });

  } catch (err) {
    console.error('Error fetching admin dashboard data:', err.message);
    res.status(500).send('Server error');
  }
});






// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// This function needs to be defined in a separate file or exported from one.
// Make sure all necessary models (User, Home, Controller, Sensor, DailyWaterUsage, SensorReading)
// are imported wherever this function is called or defined.


// --- Historical Recalculation Function ---
async function recalculateAllHistoricalDailyWaterUsage(UserModel, HomeModel, ControllerModel, SensorModel, DailyWaterUsageModel, SensorReadingModel) {
    console.log('[HISTORICAL_CALC] Starting full historical daily water usage recalculation...');
    try {
        const users = await UserModel.find({}).select('_id').lean();

        for (const user of users) {
            const homes = await HomeModel.find({ userId: user._id }).select('_id').lean();

            for (const home of homes) {
                console.log(`[HISTORICAL_CALC] Processing home: ${home.name} (ID: ${home._id})`);

                const controllers = await ControllerModel.find({ homeId: home._id }).lean();
                if (controllers.length === 0) {
                    console.log(`[HISTORICAL_CALC] No controllers found for home ${home._id}. Skipping historical calculation for this home.`);
                    continue;
                }
                const controllerIds = controllers.map(c => c._id);

                const flowSensors = await SensorModel.find({
                    controllerId: { $in: controllerIds },
                    type: 'water_flow'
                }).lean();

                if (flowSensors.length === 0) {
                    console.log(`[HISTORICAL_CALC] No water_flow sensors found for home ${home._id}. Skipping historical calculation for this home.`);
                    continue;
                }
                const sensorIds = flowSensors.map(s => s._id);

                // --- NEW: Delete existing records for this home BEFORE recalculating ---
                console.log(`[HISTORICAL_CALC] Deleting existing daily water usage records for home ID: ${home._id}`);
                await DailyWaterUsageModel.deleteMany({ homeId: home._id });
                // --- END NEW ---

                const aggregatedDailyReadings = await SensorReadingModel.aggregate([
                    // ... your existing aggregation pipeline ...
                    {
                        $match: {
                            'metadata.sensorId': { $in: sensorIds },
                            'metadata.sensorType': 'water_flow'
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: "$timestamp" },
                                month: { $month: "$timestamp" },
                                day: { $dayOfMonth: "$timestamp" }
                            },
                            totalVolume: { $sum: "$value" },
                            unit: { $first: "$unit" }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            date: {
                                $dateFromParts: {
                                    year: "$_id.year",
                                    month: "$_id.month",
                                    day: "$_id.day",
                                    hour: 0, minute: 0, second: 0, millisecond: 0,
                                    timezone: "UTC"
                                }
                            },
                            totalVolumeUsed: "$totalVolume",
                            unit: "$unit"
                        }
                    },
                    { $sort: { date: 1 } }
                ]);

                console.log(aggregatedDailyReadings); // Keep this for debugging if needed

                if (aggregatedDailyReadings.length > 0) {
                    // --- Change from findOneAndUpdate to insertMany for efficiency after deletion ---
                    await DailyWaterUsageModel.insertMany(
                        aggregatedDailyReadings.map(data => ({
                            homeId: home._id,
                            date: data.date,
                            totalVolumeUsed: data.totalVolumeUsed,
                            unit: data.unit || 'liters'
                        }))
                    );
                    console.log(`[HISTORICAL_CALC] Inserted ${aggregatedDailyReadings.length} new records for home ${home._id}.`);
                } else {
                    console.log(`[HISTORICAL_CALC] Found 0 daily usage records to insert for home ${home._id}.`);
                }

                console.log(`[HISTORICAL_CALC] Completed historical calculation for home ${home._id}.`);
            }
        }
        console.log('[HISTORICAL_CALC] Full historical daily water usage recalculation completed for all homes.');
    } catch (error) {
        console.error('[HISTORICAL_CALC] Error during full historical daily water usage recalculation:', error);
    }
}



/**
 * Recalculates and stores historical hourly water usage for all homes and their water_flow sensors.
 * This function iterates through all users, then their homes, and for each home, it aggregates
 * sensor readings from 'water_flow' sensors into hourly usage records.
 *
 * It first deletes existing hourly records for the current home to ensure a full rebuild
 * of its hourly data, then inserts the newly aggregated data.
 *
 * @param {Model} UserModel Mongoose User model
 * @param {Model} HomeModel Mongoose Home model
 * @param {Model} ControllerModel Mongoose Controller model
 * @param {Model} SensorModel Mongoose Sensor model
 * @param {Model} SensorReadingModel Mongoose SensorReading model
 * @param {Model} HourlyWaterUsageModel Mongoose HourlyWaterUsage model
 */
async function recalculateAllHistoricalHourlyWaterUsage(UserModel, HomeModel, ControllerModel, SensorModel, SensorReadingModel, HourlyWaterUsageModel) {
    console.log('[HISTORICAL_CALC] Starting full historical hourly water usage recalculation...');
    try {
        // Find all users to process their respective homes
        const users = await UserModel.find({}).select('_id').lean();

        for (const user of users) {
            // Find all homes associated with the current user
            const homes = await HomeModel.find({ userId: user._id }).select('_id').lean();

            for (const home of homes) {
                // Log the home being processed for better traceability
                console.log(`[HISTORICAL_CALC] Processing hourly data for home: ${home.name || home._id} (ID: ${home._id})`);

                // Find all controllers associated with the current home
                const controllers = await ControllerModel.find({ homeId: home._id }).lean();
                if (controllers.length === 0) {
                    console.log(`[HISTORICAL_CALC] No controllers found for home ${home._id}. Skipping hourly calculation.`);
                    continue; // Move to the next home if no controllers are found
                }
                const controllerIds = controllers.map(c => c._id); // Extract controller IDs

                // Find all 'water_flow' sensors linked to these controllers
                const flowSensors = await SensorModel.find({
                    controllerId: { $in: controllerIds },
                    type: 'water_flow'
                }).lean();

                if (flowSensors.length === 0) {
                    console.log(`[HISTORICAL_CALC] No water_flow sensors found for home ${home._id}. Skipping hourly calculation.`);
                    continue; // Move to the next home if no water_flow sensors are found
                }
                const sensorIds = flowSensors.map(s => s._id); // Extract sensor IDs

                // --- Delete existing hourly records for this specific home BEFORE recalculating ---
                // This ensures that the home's hourly data is fully rebuilt based on current sensor readings,
                // preventing duplicates from previous runs and reflecting any changes in source data.
                console.log(`[HISTORICAL_CALC] Deleting existing hourly water usage records for home ID: ${home._id}`);
                await HourlyWaterUsageModel.deleteMany({ 'metadata.homeId': home._id });
                // --- END Deletion ---

                // Aggregate sensor readings to calculate hourly water usage per sensor
                const aggregatedHourlyReadings = await SensorReadingModel.aggregate([
                    {
                        // Match sensor readings belonging to the identified water_flow sensors for the current home and user
                        $match: {
                            'metadata.sensorId': { $in: sensorIds },
                            'metadata.sensorType': 'water_flow',
                            'metadata.userId': user._id
                            // Optional: Add a date range here if you only want to recalculate for a specific period
                            // 'timestamp': { $gte: new Date('2024-01-01T00:00:00Z') }
                        }
                    },
                    {
                        // Group readings by year, month, day, hour, and importantly, by sensorId.
                        // Also include other metadata fields in the _id to carry them forward.
                        $group: {
                            _id: {
                                year: { $year: "$timestamp" },
                                month: { $month: "$timestamp" },
                                day: { $dayOfMonth: "$timestamp" },
                                hour: { $hour: "$timestamp" },
                                sensorId: '$metadata.sensorId',      // Group per sensor
                                homeId: '$metadata.homeId',          // Carry these through for metadata
                                userId: '$metadata.userId',
                                controllerId: '$metadata.controllerId',
                                sensorType: '$metadata.sensorType'
                            },
                            totalVolume: { $sum: "$value" },     // Sum the sensor values for the hour
                            unit: { $first: "$unit" }            // Take the unit from the first reading in the group
                        }
                    },
                    {
                        // Project the grouped results into the shape required by the HourlyWaterUsage schema
                        $project: {
                            _id: 0, // Exclude the default _id field
                            hour: { // Reconstruct the 'hour' field as a Date object (start of the hour)
                                $dateFromParts: {
                                    year: "$_id.year",
                                    month: "$_id.month",
                                    day: "$_id.day",
                                    hour: "$_id.hour",
                                    minute: 0, second: 0, millisecond: 0, // Set minutes, seconds, milliseconds to 0
                                    timezone: "UTC" // Store as UTC start of hour
                                }
                            },
                            totalVolumeUsed: "$totalVolume", // The summed volume for the hour
                            unit: "$unit",                   // The unit (e.g., 'L/min')
                            metadata: {                      // Populate the nested metadata object
                                homeId: "$_id.homeId",
                                userId: "$_id.userId",
                                controllerId: "$_id.controllerId",
                                sensorId: "$_id.sensorId",
                                sensorType: "$_id.sensorType"
                            }
                        }
                    },
                    { $sort: { 'metadata.sensorId': 1, hour: 1 } } // Sort for consistent processing and readability
                ]);

                // Uncomment the line below to inspect the aggregated data structure during debugging
                // console.log(aggregatedHourlyReadings);

                // Insert the aggregated hourly records into the HourlyWaterUsage collection
                if (aggregatedHourlyReadings.length > 0) {
                    await HourlyWaterUsageModel.insertMany(aggregatedHourlyReadings);
                    console.log(`[HISTORICAL_CALC] Inserted ${aggregatedHourlyReadings.length} new hourly records for home ${home._id}.`);
                } else {
                    console.log(`[HISTORICAL_CALC] Found 0 hourly usage records to insert for home ${home._id}.`);
                }

                console.log(`[HISTORICAL_CALC] Completed hourly calculation for home ${home._id}.`);
            }
        }
        console.log('[HISTORICAL_CALC] Full historical hourly water usage recalculation completed for all homes.');
    } catch (error) {
        console.error('[HISTORICAL_CALC] Error during full historical hourly water usage recalculation:', error);
    }
}
