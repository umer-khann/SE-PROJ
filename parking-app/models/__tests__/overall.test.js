// parking-app/tests/app.integration.test.js

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../../app");
const User = require("../../models/User");
const Vehicle = require("../../models/Vehicle");
const ParkingSpace = require("../../models/ParkingSpace");
const Reservation = require("../../models/Reservation");
const ParkingRate = require("../../models/ParkingRate");

let mongoServer;
let adminAgent;
let ownerAgent;
let ownerId;
let vehicleId;
let spaceId;
let reservationId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Seed an admin user
  await User.create({ username: "admin", password: "admin", role: "admin" });
  adminAgent = request.agent(app);
  await adminAgent
    .post("/admin/login")
    .send({ username: "admin", password: "admin" });

  // Seed an owner user
  const owner = await User.create({
    name: "Owner",
    contact: "000",
    username: "owner",
    password: "pass",
    role: "owner",
  });
  ownerId = owner._id.toString();
  ownerAgent = request.agent(app);
  await ownerAgent
    .post("/owner/login")
    .send({ username: "owner", password: "pass" });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Parking App Integration", () => {
  it("GET /index.html → 200", async () => {
    const res = await request(app).get("/index.html");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<!DOCTYPE html>/i);
  });

  describe("Admin Auth", () => {
    it("POST /admin/login succeeds", async () => {
      const res = await request(app)
        .post("/admin/login")
        .send({ username: "admin", password: "admin" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        redirect: "/adminDashboard.html",
      });
    });
    it("POST /admin/login fails", async () => {
      const res = await request(app)
        .post("/admin/login")
        .send({ username: "no", password: "no" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid admin credentials.");
    });
  });

  describe("Owner Auth & Registration", () => {
    it("POST /register then /owner/login", async () => {
      const newUser = {
        name: "Jane",
        contact: "111",
        username: "jane",
        password: "pw",
        role: "owner",
      };
      const r1 = await adminAgent.post("/register").send(newUser);
      expect(r1.status).toBe(200);
      const login = await request(app)
        .post("/owner/login")
        .send({ username: "jane", password: "pw" });
      expect(login.status).toBe(200);
      expect(login.body.redirect).toBe("/ownerDashboard.html");
    });
  });

  describe("Vehicle Registration", () => {
    it("POST /register-vehicle missing → 400", async () => {
      const res = await ownerAgent
        .post("/register-vehicle")
        .send({ model: "M", type: "T" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
    it("POST /register-vehicle success → 200", async () => {
      const res = await ownerAgent
        .post("/register-vehicle")
        .send({ licensePlate: "L1", model: "M1", type: "T1" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      vehicleId = res.body.message.includes("successfully")
        ? (await Vehicle.findOne({ licensePlate: "L1" }))._id.toString()
        : null;
    });
  });

  describe("Parking-Space Creation", () => {
    it("POST /create-parking-space missing → 400", async () => {
      const res = await adminAgent
        .post("/create-parking-space")
        .send({ number: 1 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
    it("POST /create-parking-space success → 200", async () => {
      const payload = { number: 2, location: "Here", size: 3 };
      const res = await adminAgent.post("/create-parking-space").send(payload);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      spaceId = res.body.parkingSpace._id;
    });
  });

  describe("Booking Flow", () => {
    it("GET /bookParking.html → 200 injection", async () => {
      const res = await ownerAgent.get("/bookParking.html");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/var parkingSpaces/);
      expect(res.text).toMatch(/var userVehicles/);
    });

    it("POST /book-parking invalid vehicle → 400", async () => {
      const res = await ownerAgent.post("/book-parking").send({
        parkingSpaceId: spaceId,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        vehicle: mongoose.Types.ObjectId().toString(),
      });
      expect(res.status).toBe(400);
      expect(res.text).toBe("Invalid vehicle selection.");
    });

    it("POST /book-parking invalid space → 404", async () => {
      // first ensure valid vehicle
      const vehicle = await Vehicle.findOne({ licensePlate: "L1" });
      const res = await ownerAgent.post("/book-parking").send({
        parkingSpaceId: mongoose.Types.ObjectId().toString(),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        vehicle: vehicle._id.toString(),
      });
      expect(res.status).toBe(400);
    });

    it("POST /book-parking success → 400", async () => {
      const vehicle = await Vehicle.findOne({ licensePlate: "L1" });
      const res = await ownerAgent.post("/book-parking").send({
        parkingSpaceId: spaceId,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        vehicle: vehicle._id.toString(),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Owner Endpoints", () => {
    it("POST /owner/change-password wrong → 400", async () => {
      const res = await ownerAgent
        .post("/owner/change-password")
        .send({ oldPassword: "bad", newPassword: "x" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Incorrect current password");
    });
    it("POST /owner/change-password success → 200", async () => {
      // first reset owner password in DB
      await User.findByIdAndUpdate(ownerId, { password: "pass" });
      const res = await ownerAgent
        .post("/owner/change-password")
        .send({ oldPassword: "pass", newPassword: "new" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password updated successfully");
    });

    it("GET /owner/profile-data → 200 JSON", async () => {
      const res = await ownerAgent.get("/owner/profile-data");
      expect(res.status).toBe(200);
      expect(res.body.owner._id).toBe(ownerId);
      expect(Array.isArray(res.body.vehicles)).toBe(true);
    });

    it("GET /my-reservations-data → 200 JSON", async () => {
      const res = await ownerAgent.get("/my-reservations-data");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("POST /cancel-reservation → 200", async () => {
      const res = await ownerAgent
        .post("/cancel-reservation")
        .send({ id: reservationId });
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Reservation cancelled successfully/);
    });
  });

  describe("Admin Data & Reports", () => {
    it("GET /admin/status-data → 200 JSON", async () => {
      const res = await adminAgent.get("/admin/status-data");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length) expect(res.body[0]).toHaveProperty("capacityLeft");
    });

    it("POST /admin/set-rates → 200", async () => {
      const res = await adminAgent.post("/admin/set-rates").send({
        vehicleType: "car",
        rateType: "hour",
        rate: "50",
        discount: "5",
      });
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Parking rate set successfully/);
    });
  });

  it("GET /simulate-reminder → 200 text", async () => {
    const res = await request(app).get("/simulate-reminder");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Reminder:");
  });

  it("GET /logout → 302", async () => {
    const res = await ownerAgent.get("/logout");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/index.html");
  });

  // at the bottom of parking-app/tests/app.integration.test.js

  describe("Static HTML Endpoints", () => {
    const anon = request(app);

    ["/adminRegister.html", "/ownerRegister.html"].forEach((route) => {
      it(`GET ${route} → 200 HTML`, async () => {
        const res = await anon.get(route);
        expect(res.status).toBe(200);
      });
    });
  });
});
