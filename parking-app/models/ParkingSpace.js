const mongoose = require("mongoose");

const parkingSpaceSchema = new mongoose.Schema({
  number: Number,
  type: String,
  rules: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ParkingSpace", parkingSpaceSchema);
