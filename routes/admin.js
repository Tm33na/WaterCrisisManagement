const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Home, Controller, Sensor,SensorReading } = require('../models'); // Import User and Home models
const authMiddleware = require('../middleware/authMiddleware'); // Import auth middleware
const faker=require('@faker-js/faker')
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // ADD THIS LINE

const jwt = require('jsonwebtoken'); // Make sure this is imported

// Middleware to ensure the user is an admin
const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next(); // User is an admin, proceed
  } else {
    res.status(403).json({ message: 'Access denied: Admin privileges required.' });
  }
};

// --- Admin-only Route: Register a New User ---
router.post('/users/register', authMiddleware, adminAuth, async (req, res) => {
  const { username, password, firstName, lastName, email, phoneNumber, address, preferences } = req.body;

  // Basic validation (you can add more comprehensive validation)
  if (!username || !password || !firstName) {
    return res.status(400).json({ message: 'Username, password, and first name are required.' });
  }

  try {
    // Check if user with that username already exists
    let existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with that username already exists.' });
    }

    // Hash the password (handled by pre-save hook in User model, but explicit here for clarity)
    // If you're creating the user document directly from a plain password,
    // ensure your Mongoose User model's pre-save hook for password hashing is working.
    // Otherwise, hash it manually before creating the document:


    // Create new user
    const newUser = new User({
      username: username.toLowerCase(),
      passwordHash: password, // Use the hashed password
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      preferences,
      role: 'user' // Newly registered users are always 'user' by default
    });

    await newUser.save();

    // // Optionally, create a default home for the new user immediately
    // const defaultHome = new Home({
    //   userId: newUser._id,
    //   name: `${newUser.firstName}'s Default Home`,
    //   description: `Automatically created for ${newUser.username}`,
    //   // You might want to get default location from admin input or a default setting
    //   location: { latitude: 0, longitude: 0 }, // Placeholder
    //   waterTanks: [] // No tanks initially, can be added later
    // });
    // await defaultHome.save();

    res.status(201).json({
      message: 'User registered successfully!',
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
      }
    });

  } catch (err) {
    console.error('Error registering new user by admin:', err.message);
    res.status(500).send('Server error during user registration.');
  }
});


// --- NEW: Admin-only Route to Get All Regular Users ---
// This route will be hit by the frontend to populate the user dropdown
router.get('/users', authMiddleware, adminAuth, async (req, res) => {
  try {
    // Find all users that have the 'user' role
    // Select only necessary fields: _id (for value), firstName, lastName, username (for display)
    const users = await User.find({ role: 'user' }).select('_id firstName lastName username').lean();

    // Send the list of users as a JSON response
    res.json(users);

  } catch (err) {
    console.error('Error fetching users for admin dashboard dropdown:', err.message);
    res.status(500).send('Server error fetching users.');
  }
});




// --- NEW Route: Get Details for a Single User (for user card) ---
router.get('/users/:userId', authMiddleware, adminAuth, async (req, res) => {
  const { userId } = req.params; // Get userId from URL parameters

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Fetch user's homes
    const homes = await Home.find({ userId: user._id }).lean();
    const homeIds = homes.map(home => home._id);

    // Fetch controllers associated with these homes
    const controllers = await Controller.find({ homeId: { $in: homeIds } }).lean();
    const controllerIds = controllers.map(ctrl => ctrl._id);

    // Fetch sensors associated with these controllers
    const sensors = await Sensor.find({ controllerId: { $in: controllerIds } }).lean();
    const sensorIds = sensors.map(sens => sens._id);

    // Fetch only the LATEST sensor reading for each sensor
    // This is more complex for Time Series. We'll fetch a small recent window
    // and then pick the latest in JS to keep it performant for a "detail card".
    const recentReadingsWindow = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // Last 2 days
    const allRecentReadings = await SensorReading.find({
        'metadata.userId': user._id,
        'metadata.sensorId': { $in: sensorIds },
        timestamp: { $gte: recentReadingsWindow }
    })
    .sort({ timestamp: -1 }) // Sort by latest first
    .lean();

    // Group latest readings by sensorId
    const latestReadingsMap = new Map();
    for (const reading of allRecentReadings) {
        if (!latestReadingsMap.has(reading.metadata.sensorId.toString())) {
            latestReadingsMap.set(reading.metadata.sensorId.toString(), reading);
        }
    }



    // Organize data: Attach controllers to homes, sensors to controllers, and latest reading to sensors
    const populatedHomes = homes.map(home => {
      home.controllers = controllers.filter(ctrl => ctrl.homeId.equals(home._id)).map(ctrl => {
        ctrl.sensors = sensors.filter(sens => sens.controllerId.equals(ctrl._id)).map(sens => {
          // Attach only the latest reading
          sens.latestReading = latestReadingsMap.get(sens._id.toString());

          return sens;
        
        });
        return ctrl;
      });
      return home;
    });

    res.json({
      message: 'User details fetched successfully',
      user: user,
      homes: populatedHomes
    });

  } catch (err) {
    console.error(`Error fetching details for user ${userId}:`, err.message);
    res.status(500).send('Server error fetching user details.');
  }
});



router.post('/homes/add', authMiddleware, adminAuth, async (req, res) => {
  const { userId, name, description, latitude, longitude, waterTanks } = req.body;

  if (!userId || !name || !latitude || !longitude) {
    return res.status(400).json({ message: 'User ID, home name, latitude, and longitude are required.' });
  }

  try {
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newHome = new Home({
      userId: userId,
      name: name,
      description: description,
      location: {
        latitude: parseFloat(latitude), // Ensure numbers
        longitude: parseFloat(longitude)
      },
      waterTanks: [] // Start with an empty array
    });

   // Add tank details if provided
    if (waterTanks[0].name && waterTanks[0].capacityLitres) {
      newHome.waterTanks.push({
        tankId: waterTanks[0].name, // Generate a unique ID for the tank
        name: waterTanks[0].name,
        capacityLitres: waterTanks[0].capacityLitres
      });
    }

    await newHome.save();

    res.status(201).json({
      message: 'Home added successfully!',
      home: newHome
    });

  } catch (err) {
    console.error('Error adding home by admin:', err.message);
    res.status(500).send('Server error during home addition.');
  }
});


// --- NEW Route: Get All Homes (for dropdowns) ---
router.get('/homes', authMiddleware, adminAuth, async (req, res) => {
  try {
    // Optionally populate userId to show user's name in dropdown
    const homes = await Home.find({}).populate('userId', 'username firstName lastName').lean();
    res.json(homes);
  } catch (err) {
    console.error('Error fetching homes for admin:', err.message);
    res.status(500).send('Server error fetching homes.');
  }
});


// --- NEW Route: Add a Controller to a Home ---
router.post('/controllers/add', authMiddleware, adminAuth, async (req, res) => {
  const {
    homeId,
    controllerHardwareId,
    name,
    locationDescription,
    firmwareVersion,
    status
  } = req.body;

  if (!homeId || !controllerHardwareId || !name) {
    return res.status(400).json({ message: 'Home ID, hardware ID, and name are required for a controller.' });
  }

  try {
    const homeExists = await Home.findById(homeId);
    if (!homeExists) {
      return res.status(404).json({ message: 'Home not found.' });
    }

    // Check if controllerHardwareId already exists
    const existingController = await Controller.findOne({ controllerHardwareId });
    if (existingController) {
      return res.status(400).json({ message: 'Controller with this Hardware ID already exists.' });
    }

    // 🔐 Generate token for the controller
    const token = jwt.sign(
      { controllerId: controllerHardwareId },
      process.env.JWT_SECRET,
      { expiresIn: '365d' } // 1 year validity, adjust as needed
    );

    const newController = new Controller({
      homeId,
      controllerHardwareId,
      name,
      locationDescription,
      firmwareVersion: firmwareVersion || '1.0.0',
      lastHeartbeat: new Date(),
      status: status || 'offline',
      installationDate: new Date(),
      authToken: token // 💾 Save the token in DB
    });

    await newController.save();

    res.status(201).json({
      message: 'Controller added successfully!',
      controller: newController,
      token // 🔁 Return the token so it can be used by your simulator
    });

  } catch (err) {
    console.error('Error adding controller by admin:', err.message);
    res.status(500).send('Server error during controller addition.');
  }
});


// --- NEW Route: Get All Controllers (for dropdowns, can filter by homeId if needed) ---
router.get('/controllers', authMiddleware, adminAuth, async (req, res) => {
  try {
    const { homeId } = req.query; // Allow filtering by homeId
    let query = {};
    if (homeId) {
        query.homeId = homeId;
    }
    const controllers = await Controller.find(query).populate('homeId', 'name').lean();
    res.json(controllers);
  } catch (err) {
    console.error('Error fetching controllers for admin:', err.message);
    res.status(500).send('Server error fetching controllers.');
  }
});

// --- NEW Route: Add a Sensor to a Controller ---
router.post('/sensors/add', authMiddleware, adminAuth, async (req, res) => {
  const { controllerId, type, name, model, pin, unit, associatedTankId, calibrationData, sensorHardwareId } = req.body;

  if (!controllerId || !type || !name) {
    return res.status(400).json({ message: 'Controller ID, sensor type, and name are required for a sensor.' });
  }

  try {
    const controllerExists = await Controller.findById(controllerId);
    if (!controllerExists) {
      return res.status(404).json({ message: 'Controller not found.' });
    }

    // Optional: Check if sensorHardwareId already exists if you enforce uniqueness
    if (sensorHardwareId) {
        const existingSensor = await Sensor.findOne({ sensorHardwareId });
        if (existingSensor) {
            return res.status(400).json({ message: 'Sensor with this Hardware ID already exists.' });
        }
    }


    const newSensor = new Sensor({
      controllerId,
      type,
      name,
      model,
      pin,
      unit,
      associatedTankId, // This should be a tankId from the Home's waterTanks array
      calibrationData,
      sensorHardwareId: sensorHardwareId || generateMacAddress() // Auto-generate if not provided
    });

    await newSensor.save();

    res.status(201).json({
      message: 'Sensor added successfully!',
      sensor: newSensor
    });

  } catch (err) {
    console.error('Error adding sensor by admin:', err.message);
    res.status(500).send('Server error during sensor addition.');
  }
});


// --- NEW Route: Get Dashboard Statistics ---
router.get('/dashboard-stats', authMiddleware, adminAuth, async (req, res) => {
    try {
      console .log('sfknjkfsfdsfds');
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalAdmins = await User.countDocuments({ role: 'admin' });
        const totalHomes = await Home.countDocuments();
        const totalControllers = await Controller.countDocuments();
        const totalSensors = await Sensor.countDocuments();

        // Optional: Count online/offline controllers/sensors if you have a reliable way to update their status
        // const onlineControllers = await Controller.countDocuments({ status: 'online' });
        // const offlineControllers = totalControllers - onlineControllers;
        // const onlineSensors = await Sensor.countDocuments({ status: 'online' }); // Assuming sensor also has status
        // const offlineSensors = totalSensors - onlineSensors;

        res.json({
            message: 'Dashboard statistics fetched successfully',
            stats: {
                totalUsers,
                totalAdmins,
                totalHomes,
                totalControllers,
                totalSensors,
                // onlineControllers,
                // offlineControllers,
                // onlineSensors,
                // offlineSensors
            }
        });

    } catch (err) {
        console.error('Error fetching dashboard statistics:', err.message);
        res.status(500).send('Server error fetching dashboard statistics.');
    }
});

router.get('/profile',  async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user details
        const admin = await User.findById(userId).select('-password').lean(); // Exclude password from the response

        if (!admin) {
            return res.status(404).json({ message: 'admin not found.' });
        }

console.log(admin.username);

        res.json({
            admin: {
                _id: admin._id,
                firstname:admin.firstName,
                lastname:admin.lastName,
                username: admin.username,
                email: admin.email,
                // Add any other top-level user details you want to include
            }        });

    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});



router.post('/change-password', async (req, res) => {
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

        // Hash the new password
        user.password = newPassword;

        await user.save();

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});


// --- Other Admin-only Routes (e.g., managing existing users, devices, etc.) ---
// router.get('/users/:id', authMiddleware, adminAuth, async (req, res) => { /* ... */ });
// router.put('/users/:id', authMiddleware, adminAuth, async (req, res) => { /* ... */ });
// router.delete('/users/:id', authMiddleware, adminAuth, async (req, res) => { /* ... */ });

module.exports = router;
