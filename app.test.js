const request = require("supertest");
const app = require("../app");

describe("Practical 12: CI/CD Automated Test Suite", () => {
    // Required Step 2: Testing GET /tasks endpoint returns 200
    test("GET /tasks returns 200", async () => {
        const res = await request(app).get("/tasks");
        expect(res.statusCode).toBe(200); // Corrected passing assertion
        expect(Array.isArray(res.body)).toBe(true);
    });

    // Student Assignment / Post Lab Work: Second automated test covering a different endpoint
    test("GET /health returns 200 and OK status", async () => {
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("OK");
        expect(res.body).toHaveProperty("timestamp");
    });

    // Supplementary endpoint test: Cache Telemetry
    test("GET /tasks/cache/stats returns 200 and telemetry data", async () => {
        const res = await request(app).get("/tasks/cache/stats");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.data).toHaveProperty("hits");
        expect(res.body.data).toHaveProperty("misses");
    });

    // Security Pipeline test: Protected route rejects unauthenticated request
    test("POST /tasks without authorization returns 401", async () => {
        const res = await request(app)
            .post("/tasks")
            .send({ title: "Unauthorized test task" });
        expect(res.statusCode).toBe(401);
    });

    // CI/CD Pipeline Telemetry test
    test("GET /ci/status returns 200 and pipeline configuration", async () => {
        const res = await request(app).get("/ci/status");
        expect(res.statusCode).toBe(200);
        expect(res.body.workflow).toBe("CI Pipeline");
        expect(res.body.pipeline.jobs).toHaveLength(2);
    });

    // Not Found Route test: 404 handler
    test("GET /non-existent-route returns 404", async () => {
        const res = await request(app).get("/non-existent-route");
        expect(res.statusCode).toBe(404);
    });
});
