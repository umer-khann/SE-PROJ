const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  licensePlate: { type: String, unique: true },
  model: String,
  type: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Vehicle", vehicleSchema);
