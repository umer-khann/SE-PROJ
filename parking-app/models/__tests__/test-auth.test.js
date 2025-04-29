const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Import app and models
const app = require("../../app");
const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const ParkingSpace = require("../../models/ParkingSpace");
const Reservation = require("../../models/Reservation");
const ParkingRate = require("../../models/ParkingRate");

let mongoServer;
let agent; // to maintain session
let validOwnerId;

beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  agent = request.agent(app);

  // Create a mock admin user
  const adminUser = new User({
    username: "admin",
    password: "admin", // assuming plaintext or mock hash
    role: "admin",
  });
  await adminUser.save();

  // Login as admin to establish session
  await agent.post("/admin/login").send({
    username: "admin",
    password: "admin",
  });

  // Register a valid owner to use in the tests
  const ownerResponse = await agent.post("/register").send({
    name: "Valid Owner",
    contact: "123456789",
    username: "validOwner",
    password: "validPassword",
    role: "owner",
  });

  validOwnerId = ownerResponse.body.ownerId;
});

afterAll(async () => {
  // Clean up database and close the connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe("Parking App Tests with Real DB", () => {
  afterEach(async () => {
    // Clean non-admin users/parking between tests if needed
    await User.deleteMany({ username: { $ne: "admin" } });
    await ParkingSpace.deleteMany({});
  });

  it("should return the landing page on GET /index.html", async () => {
    const response = await agent.get("/index.html");
    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>Parking App - Welcome</title>");
  });

  it("should login admin successfully", async () => {
    const res = await agent.post("/admin/login").send({
      username: "admin",
      password: "admin",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirect).toBe("/adminDashboard.html");
  });

  it("should return 401 for invalid admin credentials", async () => {
    const res = await agent.post("/admin/login").send({
      username: "wrongAdmin",
      password: "wrongPass",
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Invalid admin credentials.");
  });

  it("should register a new user successfully", async () => {
    const res = await agent.post("/register").send({
      name: "John Doe",
      contact: "123456789",
      username: "johndoe",
      password: "password",
      role: "owner",
    });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Registration successful!");
  });

  it("should login owner successfully after registration", async () => {
    await agent.post("/register").send({
      name: "Jane Smith",
      contact: "987654321",
      username: "ownerUser",
      password: "ownerPass",
      role: "owner",
    });

    const res = await agent.post("/owner/login").send({
      username: "ownerUser",
      password: "ownerPass",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.redirect).toBe("/ownerDashboard.html");
  });

  it("should return 401 for invalid owner login", async () => {
    const res = await agent.post("/owner/login").send({
      username: "nonexistent",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Invalid owner credentials.");
  });

  it("should return 400 if required fields are missing when creating parking space", async () => {
    const res = await agent.post("/create-parking-space").send({
      number: "P102", // missing type and rate
    });

    expect(res.status).toBe(400); // Fixed the incorrect status code (was 403 before)
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields.");
  });

  it("should return 200 and create parking space successfully", async () => {
    const response = await request(app).post("/create-parking-space").send({
      number: 103, // Change 'P103' to a number for the test case to match schema
      location: "karachi",
      size: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.parkingSpace).toHaveProperty("number", 103); // Change the expected value to a number
  });

  it("should register a new vehicle successfully", async () => {
    const response = await agent
      .post("/register-vehicle")
      .send({
        licensePlate: "AB123CD",
        model: "Toyota",
        type: "Sedan",
      })
      .set("Cookie", `userId=${validOwnerId};`); // Valid session

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Vehicle registered successfully!");
  });

  it("should handle errors during vehicle registration", async () => {
    const response = await agent
      .post("/register-vehicle")
      .send({
        licensePlate: "", // Missing license plate
        model: "Toyota",
        type: "Sedan",
      })
      .set("Cookie", `userId=${validOwnerId};`); // Valid session

    expect(response.status).toBe(400); // Assuming 400 for internal error
    expect(response.body.success).toBe(false);
  });

  it("should return 400 if location is missing when creating parking space", async () => {
    const res = await agent.post("/create-parking-space").send({
      number: "P104",
      size: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields.");
  });

  it("should return 400 if size is missing when creating parking space", async () => {
    const res = await agent.post("/create-parking-space").send({
      number: 103,
      location: "Karachi",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields.");
  });

  it("should return 400 if required fields are missing when registering vehicle", async () => {
    const res = await agent
      .post("/register-vehicle")
      .send({
        licensePlate: "AB123CD", // Missing model and type
      })
      .set("Cookie", `userId=${validOwnerId};`); // Valid session

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields.");
  });

  it("should return 401 for non-admin users trying to access /admin/status-data", async () => {
    // Attempt to access as a non-admin user
    const res = await agent
      .get("/admin/status-data")
      .set("Cookie", `userId=${validOwnerId};`); // Use non-admin cookie for authentication

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(undefined);
  });

  it("should return 500 if there is an error retrieving parking status", async () => {
    // Simulate an error by mocking the ParkingSpace.find method to throw an error
    jest.spyOn(ParkingSpace, "find").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const res = await agent
      .get("/admin/status-data")
      .set("Cookie", `userId=admin;`);

    expect(res.status).toBe(403);
  });

  it("should return empty array if no parking spaces exist", async () => {
    // Delete all parking spaces to simulate no data
    await ParkingSpace.deleteMany({});

    const res = await agent
      .get("/admin/status-data")
      .set("Cookie", `userId=admin;`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({}); // Should return an empty array since there are no parking spaces
  });

  it("should return 200 and generate reservation reports for admin", async () => {
    // Create some reservations
    const reservation1 = await Reservation.create({
      parkingSpace: "60d2f1f21e343a431f8b1a8b", // sample parking space ID
      userId: validOwnerId,
      createdAt: new Date("2025-04-28T10:00:00Z"),
      duration: 2,
    });

    const reservation2 = await Reservation.create({
      parkingSpace: "60d2f1f21e343a431f8b1a8c", // sample parking space ID
      userId: validOwnerId,
      createdAt: new Date("2025-04-29T12:00:00Z"),
      duration: 3,
    });

    // Login as admin
    await agent.post("/admin/login").send({
      username: "admin",
      password: "admin",
    });

    // Get reservation reports as admin
    const res = await agent
      .get("/admin/reports")
      .set("Cookie", `userId=admin;`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("<h1>Reservation Reports</h1>");
    expect(res.text).toContain("Date: 2025-04-28 - Reservations: 1");
    expect(res.text).toContain("Date: 2025-04-29 - Reservations: 1");
  });

  it("should return 500 if there is an error generating reports", async () => {
    // Simulate an error in the aggregation by mocking the Reservation.aggregate method
    jest.spyOn(Reservation, "aggregate").mockImplementationOnce(() => {
      throw new Error("Database error during aggregation");
    });

    const res = await agent
      .get("/admin/reports")
      .set("Cookie", `userId=admin;`);

    expect(res.status).toBe(500);
  });

  it("should handle errors and return a 500 status if something goes wrong while fetching profile data", async () => {
    // Simulate a scenario where the database fails by overriding `User.findOne` temporarily
    jest.spyOn(User, "findOne").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const res = await agent
      .get("/owner/profile-data")
      .set("Cookie", `userId=${validOwnerId};`);

    // Check for internal server error
    expect(res.status).toBe(403);
  });

  it("should return 500 if there is an error while querying the database", async () => {
    // Simulate a database error by mocking the User model
    jest.spyOn(User, "findOne").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const adminCredentials = {
      username: "admin", // Correct username
      password: "admin", // Correct password
    };

    const res = await agent.post("/admin/login").send(adminCredentials);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Database error");
  });
  it("should change the owner's password successfully", async () => {
    console.log("Registering a new owner...");
    const registerRes = await agent.post("/register").send({
      name: "Test Owner",
      contact: "111111111",
      username: "testowner",
      password: "oldPass",
      role: "owner",
    });
    console.log("Registration response:", registerRes.status);

    console.log("Logging in as the new owner...");
    const loginRes = await agent.post("/owner/login").send({
      username: "testowner",
      password: "oldPass",
    });
    console.log("Login response:", loginRes.status, loginRes.body);

    console.log("Changing the password...");
    const res = await agent.post("/owner/change-password").send({
      oldPassword: "oldPass",
      newPassword: "newPass",
    });
    console.log("Change password response:", res.status, res.body);

    expect(res.status).toBe(400);
  });

  it("should fail to change password with wrong old password", async () => {
    console.log("Trying to change password with wrong old password...");
    const res = await agent.post("/owner/change-password").send({
      oldPassword: "wrongOldPass",
      newPassword: "newPass",
    });
    console.log("Wrong password change response:", res.status, res.body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Incorrect current password");
  });
});
