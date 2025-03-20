const mongoose = require("mongoose");

const parkingRateSchema = new mongoose.Schema({
  vehicleType: String,
  rateType: String, // hourly or daily
  rate: Number,
  discount: { type: Number, default: 0 },
});

module.exports = mongoose.model("ParkingRate", parkingRateSchema);
