const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  contact: String,
  username: { type: String, unique: true },
  password: String, // In production, use hashing!
  role: { type: String, enum: ["admin", "owner"], required: true },
});

module.exports = mongoose.model("User", userSchema);
