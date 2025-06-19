// middleware/controllerAuth.js
const jwt = require('jsonwebtoken');
const Controller = require('../models/Controller'); // Import the Controller model
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key'; // Ensure this matches your login route

module.exports = async function(req, res, next) {
    // Get token from header: It can be 'x-auth-token' or 'Authorization: Bearer <token>'
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');

    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        // Decode the token using the secret key
        const decoded = jwt.verify(token, JWT_SECRET);

        // Ensure the token payload has the expected controller structure
        // From your login route: jwt.sign({ controllerId: controller._id, type: 'controller' })
        if (!decoded.controllerId || decoded.type !== 'controller') {
            return res.status(401).json({ message: 'Invalid token payload for controller authentication' });
        }

        // Fetch the full Controller document using the ID from the token payload.
        // Populate 'homeId' so the 'sensorData' route can easily get 'userId' from 'homeId.userId'.
        const controller = await Controller.findById(decoded.controllerId).populate('homeId');

        // If the controller from the token doesn't exist in the DB (e.g., deleted), deny access
        if (!controller) {
            return res.status(404).json({ message: 'Authenticated controller not found in database.' });
        }

        // Attach the full controller object to the request.
        // Your routes/sensorData.js expects `req.controller`.
        req.controller = controller;

        next(); // Move to the next middleware/route handler
    } catch (err) {
        console.error('Controller authentication error:', err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};
