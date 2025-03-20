const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
  parkingSpace: { type: mongoose.Schema.Types.ObjectId, ref: "ParkingSpace" },
  startTime: Date,
  endTime: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Reservation", reservationSchema);
