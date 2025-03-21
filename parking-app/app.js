const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

// Import models
const User = require("./models/User");
const Vehicle = require("./models/Vehicle");
const ParkingSpace = require("./models/ParkingSpace");
const Reservation = require("./models/Reservation");
const ParkingRate = require("./models/ParkingRate");


const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/parkingApp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "parkingSecret",
    resave: false,
    saveUninitialized: false,
  })
);

// -----------------------------
// Dynamic Routes (defined BEFORE static middleware)
// -----------------------------

// Landing Page (Role Selection)
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Authentication Routes

// Admin Login
app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password, role: "admin" });
    if (user) {
      req.session.userId = user._id;
      req.session.userRole = user.role;
      res.redirect("/adminDashboard.html");
    } else {
      res.send(
        'Invalid admin credentials. <a href="/adminLogin.html">Try again</a>'
      );
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Owner Login
app.post("/owner/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password, role: "owner" });
    if (user) {
      req.session.userId = user._id;
      req.session.userRole = user.role;
      res.redirect("/ownerDashboard.html");
    } else {
      res.send(
        'Invalid owner credentials. <a href="/ownerLogin.html">Try again</a>'
      );
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// General Registration Route (if needed)
app.post("/register", async (req, res) => {
  try {
    const { name, contact, username, password, role } = req.body;
    const newUser = new User({ name, contact, username, password, role });
    await newUser.save();
    res.send('Registration successful! <a href="/index.html">Login here</a>');
  } catch (error) {
    res.status(500).send("Error registering user: " + error.message);
  }
});

// Admin Registration
app.get("/adminRegister.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminRegister.html"));
});
app.post("/admin/register", async (req, res) => {
  try {
    const { name, contact, username, password } = req.body;
    const newUser = new User({
      name,
      contact,
      username,
      password,
      role: "admin",
    });
    await newUser.save();
    // Redirect to admin login with query parameter
    res.redirect("/adminLogin.html?registered=true");
  } catch (error) {
    res.status(500).send("Error registering admin: " + error.message);
  }
});

// Owner Registration
app.get("/ownerRegister.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ownerRegister.html"));
});
app.post("/owner/register", async (req, res) => {
  try {
    const { name, contact, username, password } = req.body;
    const newUser = new User({
      name,
      contact,
      username,
      password,
      role: "owner",
    });
    await newUser.save();
    // Redirect to login page with a query parameter
    res.redirect("/ownerLogin.html?registered=true");
  } catch (error) {
    res.status(500).send("Error registering owner: " + error.message);
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/index.html");
});

// Middleware for authentication/role-checking
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/index.html");
}
function isAdmin(req, res, next) {
  if (req.session.userRole === "admin") return next();
  res.status(403).send("Access denied");
}
function isOwner(req, res, next) {
  if (req.session.userRole === "owner") return next();
  res.status(403).send("Access denied");
}

// Owner Routes
app.get("/ownerDashboard.html", isAuthenticated, isOwner, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ownerDashboard.html"));
});
app.get("/registerVehicle.html", isAuthenticated, isOwner, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "registerVehicle.html"));
});
app.post("/register-vehicle", isAuthenticated, isOwner, async (req, res) => {
  try {
    const { licensePlate, model, type } = req.body;
    const newVehicle = new Vehicle({
      licensePlate,
      model,
      type,
      owner: req.session.userId,
    });
    await newVehicle.save();
    res.send(
      'Vehicle registered successfully! <a href="/ownerDashboard.html">Back to Dashboard</a>'
    );
  } catch (error) {
    res.status(500).send("Error registering vehicle: " + error.message);
  }
});
// GET route to serve bookParking.html with parking spaces and user cars injected
app.get("/bookParking.html", isAuthenticated, isOwner, async (req, res) => {
  try {
    // Retrieve parking spaces from MongoDB
    const spaces = await ParkingSpace.find();
    // Retrieve only the logged-in user's vehicles from MongoDB using the Vehicle model
    const vehicles = await Vehicle.find({ owner: req.session.userId });

    // Path to your static HTML file in the public folder
    const filePath = path.join(__dirname, "public", "bookParking.html");

    fs.readFile(filePath, "utf8", (err, htmlData) => {
      if (err) {
        return res.status(500).send("Error reading file: " + err.message);
      }

      // Create a script tag that defines global variables for parkingSpaces and userVehicles
      const injection = `<script>
        var parkingSpaces = ${JSON.stringify(spaces)};
        var userVehicles = ${JSON.stringify(vehicles)};
      </script>`;

      // Replace the placeholder in the HTML file with the injection script
      const modifiedHTML = htmlData.replace("<!-- PARKING_SPACES_DATA -->", injection);

      // Send the modified HTML to the client
      res.send(modifiedHTML);
    });
  } catch (error) {
    res.status(500).send("Error retrieving parking spaces: " + error.message);
  }
});

app.post("/book-parking", isAuthenticated, isOwner, async (req, res) => {
  try {
    const { parkingSpaceId, startTime, endTime, vehicle } = req.body;

    // Retrieve the parking space by its ID
    const parkingSpace = await ParkingSpace.findById(parkingSpaceId);
    if (!parkingSpace) {
      return res.status(404).send("Selected parking space not available.");
    }

    // Check if the parking space has available capacity
    if (parkingSpace.initialCapacity <= 0) {
      return res.status(400).send("No available capacity for this parking space.");
    }

    // Retrieve the selected vehicle ensuring it belongs to the logged-in user
    const userVehicle = await Vehicle.findOne({ _id: vehicle, owner: req.session.userId });
    if (!userVehicle) {
      return res.status(400).send("Invalid vehicle selection.");
    }

    // Create a new reservation linking the parking space and the user's selected vehicle
    const newReservation = new Reservation({
      user: req.session.userId,
      vehicle: userVehicle._id,
      parkingSpace: parkingSpace._id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    await newReservation.save();

    // Decrease the parking space's available capacity by 1
    await ParkingSpace.findByIdAndUpdate(parkingSpaceId, { $inc: { number: -1 } });

    res.send(
      `Parking space booked! Reservation ID: ${newReservation._id} <a href="/ownerDashboard.html">Back to Dashboard</a>`
    );
  } catch (error) {
    res.status(500).send("Error booking parking space: " + error.message);
  }
});



app.get("/myReservations.html", isAuthenticated, isOwner, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "myReservations.html"));
});
app.get("/my-reservations-data", isAuthenticated, isOwner, async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.session.userId });
    res.json(reservations);
  } catch (error) {
    res.status(500).send("Error retrieving reservations: " + error.message);
  }
});
app.post("/cancel-reservation", isAuthenticated, isOwner, async (req, res) => {
  try {
    const { id } = req.body;
    await Reservation.findByIdAndDelete(id);
    res.send(
      'Reservation cancelled successfully! <a href="/myReservations.html">Back</a>'
    );
  } catch (error) {
    res.status(500).send("Error cancelling reservation: " + error.message);
  }
});

// Admin Routes
app.get("/adminDashboard.html", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminDashboard.html"));
});
app.get("/adminParking.html", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminParking.html"));
});
app.post(
  "/create-parking-space",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { number, type, rules } = req.body;
      const newParkingSpace = new ParkingSpace({
        number: parseInt(number, 10),
        type,
        rules,
      });
      await newParkingSpace.save();
      res.send(
        'Parking space(s) created successfully! <a href="/adminDashboard.html">Back to Dashboard</a>'
      );
    } catch (error) {
      res.status(500).send("Error creating parking space: " + error.message);
    }
  }
);
app.get("/adminStatus.html", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminStatus.html"));
});

app.get("/admin/status-data", isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Fetch parking spaces as plain objects
    const spaces = await ParkingSpace.find().lean();

    // For each parking space, count the number of reservations and calculate capacity left.
    const updatedSpaces = await Promise.all(
      spaces.map(async (space) => {
        // Count reservations for this parking space.
        const reservedCount = await Reservation.countDocuments({ parkingSpace: space._id });
        // Calculate remaining capacity.
        const capacityLeft = space.initialCapacity - reservedCount;
        // Return updated space data (you can include any additional fields as needed)
        return { ...space, capacityLeft };
      })
    );

    res.json(updatedSpaces);
  } catch (error) {
    res.status(500).send("Error retrieving parking status: " + error.message);
  }
});


app.get("/adminRate.html", isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminRate.html"));
});
app.post("/admin/set-rates", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { vehicleType, rateType, rate, discount } = req.body;
    const newRate = new ParkingRate({
      vehicleType,
      rateType,
      rate: parseFloat(rate),
      discount: discount ? parseFloat(discount) : 0,
    });
    await newRate.save();
    res.send(
      'Parking rate set successfully! <a href="/adminDashboard.html">Back to Dashboard</a>'
    );
  } catch (error) {
    res.status(500).send("Error setting parking rate: " + error.message);
  }
});
app.get("/admin/reports", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const reports = await Reservation.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    let reportHTML = "<h1>Reservation Reports</h1>";
    reports.forEach((report) => {
      reportHTML += `<p>Date: ${report._id} - Reservations: ${report.count}</p>`;
    });
    res.send(reportHTML);
  } catch (error) {
    res.status(500).send("Error generating reports: " + error.message);
  }
});
app.get("/simulate-reminder", (req, res) => {
  res.send(
    "Reminder: Your reservation expires in 10 minutes. An email reminder has been sent."
  );
});

// -----------------------------
// Register static middleware AFTER dynamic routes
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
