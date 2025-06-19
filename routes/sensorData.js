// routes/sensorData.js
const express = require('express');
const router = express.Router();
const SensorReading = require('../models/SensorReading');
const DailyWaterUsage = require('../models/DailyWaterUsage');
const controllerAuth = require('../middleware/controllerAuth'); // Your custom middleware
const Controller = require('../models/Controller'); // Already there
const Sensor = require('../models/Sensor'); // Already there

const { body, validationResult } = require('express-validator');

// POST /api/sensor-data (Controller sends data)
router.post(
  '/',
 controllerAuth, // This middleware should populate req.controller
 [
 // Validate sensorHardwareId instead of sensorId
 body('sensorHardwareId').notEmpty().isString().withMessage('sensorHardwareId is required and must be a string'),
 body('sensorType').isIn(['water_level', 'rain_status', 'water_flow']).withMessage('Invalid sensorType'),
 body('value').notEmpty().isNumeric().withMessage('Value is required and must be a number'),
 body('unit').optional().isString(),
 body('timestamp').optional().isISO8601().withMessage('Timestamp must be a valid ISO 8601 date string'),
 body('status').optional().isString(),
 body('associatedTankId').optional().isMongoId(), // This can remain if your backend expects a MongoDB _id for tanks
 body('rawData').optional()
 ],
 async (req, res) => {
    const errors = validationResult(req);
       if (!errors.isEmpty()) {
       return res.status(400).json({ errors: errors.array() });
   }

     const {
     sensorHardwareId, // Changed from sensorId
     sensorType,
     value,
     unit,
     status,
     timestamp = new Date(),
     associatedTankId,
     rawData
 } = req.body;

 try {
 const controller = req.controller; // This comes from your controllerAuth middleware

 // Find the sensor using its hardware ID AND verify it belongs to the authenticated controller
 const sensor = await Sensor.findOne({
 sensorHardwareId: sensorHardwareId, // Query by hardware ID
 controllerId: controller._id // Ensure it's linked to the authenticated controller
 });

 if (!sensor) {
 return res.status(403).json({ error: 'Sensor not found or not associated with this controller.' });
 }

 // Get linked metadata from the controller object (populated by controllerAuth)
 const homeId = controller.homeId._id; // Access the _id if homeId is populated
 const userId = controller.homeId.userId; // Access the _id if userId is populated within homeId

 const reading = await SensorReading.create({
 timestamp,
 metadata: {
 userId,
 homeId,
 controllerId: controller._id,
 sensorId: sensor._id, // Use the MongoDB _id of the found sensor here for the reading
 sensorType,
 associatedTankId
 },
 value,
 unit,
 status,
 rawData
 });

 // If it's a water flow reading, update DailyWaterUsage
 if (sensorType === 'water_flow') {
 const dateOnly = new Date(timestamp);
 dateOnly.setUTCHours(0, 0, 0, 0);

await DailyWaterUsage.findOneAndUpdate(
 { homeId, date: dateOnly },
 { $inc: { totalVolumeUsed: value } },
 { upsert: true, new: true, setDefaultsOnInsert: true }
 );
 }

 return res.status(201).json({ message: 'Sensor reading saved', data: reading });
} catch (err) {
 console.error('Error saving sensor data:', err);
 return res.status(500).json({ error: 'Internal Server Error' });
 }
 }
);

module.exports = router;