const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import the User model

const router = express.Router();

// --- Login Route ---
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log("login request");
    // 1. Find the user by username
    const user = await User.findOne({ username: username.toLowerCase() }); // Case-insensitive username
    if (!user) {
      return res.status(400).json({ message: 'Not registered' });
    }

    // 2. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 3. Generate a JWT Token
    // NEVER put sensitive data like passwords in the token payload!
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        username: user.username, // Include username for convenience
        name:user.firstName
      }
    };

    // Sign the token with your secret key
    // Set a short expiration for testing, longer for production (e.g., '1h', '7d')
    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Your secret key for signing tokens
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        // 4. Send the token back to the client
        res.json({ token, message: 'Login successful', role: user.role,username:user.username,name:user.firstName });
        console.log("login su");
      }
    );

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error');
  }
});





// --- Optional: Register Route (if users can register themselves) ---
// For your system, you mentioned only admins can create users, so this might not be needed.
/*
router.post('/register', async (req, res) => {
  const { username, password, firstName, lastName, email } = req.body;

  try {
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({
      username: username.toLowerCase(),
      passwordHash: password, // The pre-save hook in User model will hash this
      firstName,
      lastName,
      email,
      role: 'user' // Default to 'user' for self-registration
    });

    await user.save();

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        username: user.username
      }
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({ token, message: 'User registered successfully', role: user.role });
    });

  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).send('Server error');
  }
});
*/

module.exports = router;