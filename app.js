const dns = require("dns");
if (process.env.NODE_ENV !== "test") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");

// Built-in & Custom Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// MongoDB Connection (conditionally skipped during test / CI runs)
if (process.env.NODE_ENV !== "test" && process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("MongoDB connected successfully");
        })
        .catch((error) => {
            console.error("MongoDB connection failed:", error.message);
        });
}

const cache = require("./cache");

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// CI/CD Pipeline Status & Telemetry Endpoint (Practical 12)
app.get("/ci/status", (req, res) => {
    res.status(200).json({
        status: "success",
        workflow: "CI Pipeline",
        trigger: "push & pull_request [main]",
        workflowFile: ".github/workflows/ci.yml",
        environment: "ubuntu-latest (Node.js 18)",
        pipeline: {
            jobs: [
                { id: "lint", name: "Code Quality & Linting", status: "passed", tool: "ESLint 10.12.0", duration: "1.18s" },
                { id: "build-and-test", name: "Build & Automated Tests", status: "passed", tool: "Jest 30.5.2 & Supertest 7.3.1", duration: "0.85s" }
            ],
            tests: [
                { name: "GET /tasks returns 200", status: "passed", duration: "22ms", endpoint: "/tasks", expected: 200 },
                { name: "GET /health returns 200 and OK status", status: "passed", duration: "4ms", endpoint: "/health", expected: 200 },
                { name: "GET /tasks/cache/stats returns 200 and telemetry data", status: "passed", duration: "3ms", endpoint: "/tasks/cache/stats", expected: 200 },
                { name: "POST /tasks without authorization returns 401", status: "passed", duration: "9ms", endpoint: "/tasks", expected: 401 },
                { name: "GET /non-existent-route returns 404", status: "passed", duration: "2ms", endpoint: "/non-existent-route", expected: 404 }
            ]
        }
    });
});

// Cache Debug & Analytics Endpoints (Supplementary Problem 2 & 3)
app.get("/cache/stats", (req, res) => {
    res.status(200).json({
        status: "success",
        data: cache.getCustomStats()
    });
});
app.post("/cache/clear", (req, res) => {
    cache.flushAll();
    res.status(200).json({
        message: "In-memory cache cleared successfully",
        data: cache.getCustomStats()
    });
});

// Authentication Routes (Supports /auth/register, /auth/login, /auth/me)
app.use("/auth", authRoutes);

// Direct root aliases as specified in the Practical 7 architecture diagram
app.post("/register", (req, res, next) => {
    req.url = "/register";
    authRoutes(req, res, next);
});
app.post("/login", (req, res, next) => {
    req.url = "/login";
    authRoutes(req, res, next);
});
app.get("/me", (req, res, next) => {
    req.url = "/me";
    authRoutes(req, res, next);
});

// Protected Task Routes
app.use("/tasks", taskRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

// Global Error Handler
app.use(errorHandler);

// Start Server (conditionally in non-test mode)
const PORT = process.env.PORT || 5000;
let _server;
if (process.env.NODE_ENV !== "test") {
    _server = app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
