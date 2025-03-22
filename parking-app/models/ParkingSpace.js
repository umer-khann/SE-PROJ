const mongoose = require("mongoose");

const parkingSpaceSchema = new mongoose.Schema({
  number: Number,
  type: String,
  rules: String,
  rate: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ParkingSpace", parkingSpaceSchema);
