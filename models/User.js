const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing passwords

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    required: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows null/missing emails
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  preferences: {
    notifyOnLowWater: { type: Boolean, default: true },
    waterLevelThreshold: { type: Number, default: 20 }
  }
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt

// Pre-save hook to hash password before saving (for real app, not strictly needed for fake data)
UserSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);