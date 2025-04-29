const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");

// Mock the User model
jest.mock("../../models/User");

describe("POST /admin/login", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return success and redirect when credentials are valid", async () => {
    const mockUser = { _id: "user123", role: "admin" };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/admin/login")
      .send({ username: "adminUser", password: "securePass" });

    expect(User.findOne).toHaveBeenCalledWith({
      username: "adminUser",
      password: "securePass",
      role: "admin",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      redirect: "/adminDashboard.html",
    });
  });

  it("should return 401 when credentials are invalid", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/admin/login")
      .send({ username: "wrongUser", password: "wrongPass" });

    expect(User.findOne).toHaveBeenCalledWith({
      username: "wrongUser",
      password: "wrongPass",
      role: "admin",
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: "Invalid admin credentials.",
    });
  });

  it("should return 500 when an error occurs", async () => {
    User.findOne.mockRejectedValue(new Error("Database failure"));

    const res = await request(app)
      .post("/admin/login")
      .send({ username: "adminUser", password: "securePass" });

    expect(User.findOne).toHaveBeenCalledWith({
      username: "adminUser",
      password: "securePass",
      role: "admin",
    });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "Database failure" });
  });
});

describe("GET /logout", () => {
  it("should destroy the session and redirect to /index.html", async () => {
    // Use an agent to preserve session state across requests
    const agent = request.agent(app);

    // First, simulate setting some session data
    // Note: express-session will create a session automatically on first request
    await agent.get("/");

    const res = await agent.get("/logout");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/index.html");
  });
});
