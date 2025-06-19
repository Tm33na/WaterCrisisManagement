const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Controller = require('../models/Controller');
const { body, validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// POST /api/controllers/login
router.post(
  '/login',
  [body('controllerHardwareId').notEmpty().withMessage('controllerHardwareId is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { controllerHardwareId } = req.body;

    const controller = await Controller.findOne({ controllerHardwareId });
    if (!controller) return res.status(404).json({ message: 'Controller not found' });

    const token = jwt.sign(
      { controllerId: controller._id, type: 'controller' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  }
);

module.exports = router;
