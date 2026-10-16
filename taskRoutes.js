const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const auth = require("../middleware/auth");
const cache = require("../cache");
const mongoose = require("mongoose");
const {
    validateCreateTask,
    validateUpdateTask,
    validateTaskId
} = require("../middleware/validateTask");

// Helper to calculate elapsed high-res time in milliseconds
const getDurationMs = (startTime) => {
    const diff = process.hrtime(startTime);
    return ((diff[0] * 1e3) + (diff[1] * 1e-6)).toFixed(2);
};

// Optional auth middleware for GET /: attaches req.user if Bearer token is provided
const optionalAuth = (req, res, next) => {
    if (req.headers && req.headers.authorization) {
        return auth(req, res, next);
    }
    next();
};

/**
 * @route   GET /tasks/cache/stats
 * @desc    Debug endpoint exposing cache-hit/cache-miss counters and cache state (Supplementary Problem 2)
 * @access  Public / Debug
 */
router.get("/cache/stats", (req, res) => {
    const stats = cache.getCustomStats();
    res.status(200).json({
        status: "success",
        data: stats
    });
});

/**
 * @route   POST /tasks/cache/clear
 * @desc    Debug endpoint to flush all cached keys
 * @access  Public / Debug
 */
router.post("/cache/clear", (req, res) => {
    cache.flushAll();
    res.status(200).json({
        message: "In-memory cache cleared successfully",
        data: cache.getCustomStats()
    });
});

/**
 * @route   POST /tasks/cache/ttl
 * @desc    Debug endpoint to experiment with different TTL values (Supplementary Problem 3)
 * @access  Public / Debug
 */
router.post("/cache/ttl", (req, res) => {
    const { ttl } = req.body;
    if (!ttl || isNaN(ttl) || parseInt(ttl, 10) <= 0) {
        return res.status(400).json({
            message: "Please provide a valid positive TTL in seconds."
        });
    }
    cache.setTTL(ttl);
    res.status(200).json({
        message: `Standard TTL updated to ${ttl} seconds`,
        stdTTL: cache.getTTL()
    });
});

/**
 * @route   GET /tasks
 * @desc    Retrieve all tasks with node-cache in-memory caching (60s TTL)
 * @access  Public / Authenticated (supports both guest and authenticated user views)
 */
router.get("/", optionalAuth, async (req, res, next) => {
    const startTime = process.hrtime();
    const bypass = req.query.nocache === "true" || req.headers["x-cache-bypass"] === "true";
    const cacheKey = req.user ? `tasks_${req.user.id}` : "all_tasks";

    try {
        // Step 3: Check in-memory cache first if bypass is not requested
        if (!bypass) {
            const cached = cache.get(cacheKey) || (req.user ? null : cache.get("all_tasks"));
            if (cached) {
                const duration = getDurationMs(startTime);
                res.set("X-Cache", "HIT");
                res.set("X-Response-Time", `${duration}ms`);
                res.set("X-Cache-Key", cacheKey);
                return res.status(200).json(cached);
            }
        }

        // Cache MISS or bypass requested: Query MongoDB or in-memory fallback
        let tasks = [];
        try {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                const query = req.user
                    ? { $or: [{ user: req.user.id }, { user: { $exists: false } }, { user: null }] }
                    : {};
                tasks = await Task.find(query).sort({ createdAt: -1 });
            } else {
                tasks = [
                    { _id: "66f00112233445566778899a", title: "Setup GitHub Actions CI Pipeline", completed: true, priority: "High" },
                    { _id: "66f00112233445566778899b", title: "Automate Jest and Supertest Suite", completed: true, priority: "High" },
                    { _id: "66f00112233445566778899c", title: "Deploy Containerized Task Manager", completed: false, priority: "Medium" }
                ];
            }
        } catch {
            tasks = [
                { _id: "66f00112233445566778899a", title: "Setup GitHub Actions CI Pipeline", completed: true, priority: "High" },
                { _id: "66f00112233445566778899b", title: "Automate Jest and Supertest Suite", completed: true, priority: "High" },
                { _id: "66f00112233445566778899c", title: "Deploy Containerized Task Manager", completed: false, priority: "Medium" }
            ];
        }

        // Store fetched tasks in cache with configured TTL
        if (!bypass) {
            cache.set(cacheKey, tasks);
            cache.set("all_tasks", tasks);
        }

        const duration = getDurationMs(startTime);
        res.set("X-Cache", bypass ? "BYPASS" : "MISS");
        res.set("X-Response-Time", `${duration}ms`);
        res.set("X-Cache-Key", cacheKey);
        res.status(200).json(tasks);
    } catch (error) {
        next(error);
    }
});

// Protect remaining mutating CRUD task routes with Authentication Middleware
router.use(auth);

/**
 * @route   GET /tasks/:id
 * @desc    Retrieve a single task by ID with dedicated per-task caching (Supplementary Problem 1)
 * @access  Private
 */
router.get("/:id", validateTaskId, async (req, res, next) => {
    const startTime = process.hrtime();
    const singleCacheKey = `task_${req.params.id}`;
    const bypass = req.query.nocache === "true" || req.headers["x-cache-bypass"] === "true";

    try {
        if (!bypass) {
            const cachedTask = cache.get(singleCacheKey);
            if (cachedTask) {
                const duration = getDurationMs(startTime);
                res.set("X-Cache", "HIT");
                res.set("X-Response-Time", `${duration}ms`);
                res.set("X-Cache-Key", singleCacheKey);
                return res.status(200).json(cachedTask);
            }
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (!bypass) {
            cache.set(singleCacheKey, task);
        }

        const duration = getDurationMs(startTime);
        res.set("X-Cache", bypass ? "BYPASS" : "MISS");
        res.set("X-Response-Time", `${duration}ms`);
        res.set("X-Cache-Key", singleCacheKey);
        res.status(200).json(task);
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /tasks
 * @desc    Create a new task and invalidate cached task collections (Step 4)
 * @access  Private
 */
router.post("/", validateCreateTask, async (req, res, next) => {
    try {
        const task = new Task({
            title: req.body.title,
            description: req.body.description || "",
            completed: req.body.completed || false,
            user: req.user.id
        });
        const savedTask = await task.save();

        // Step 4: Invalidate cache after successful write
        cache.del("all_tasks");
        if (req.user) {
            cache.del(`tasks_${req.user.id}`);
        }

        res.status(201).json({
            message: "Task created successfully",
            task: savedTask
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /tasks/:id
 * @desc    Update a task and invalidate both task lists and single-task cache
 * @access  Private
 */
router.put("/:id", validateUpdateTask, async (req, res, next) => {
    try {
        const task = await Task.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );
        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        // Step 4 & Supplementary: Invalidate collection cache and individual task cache
        cache.del("all_tasks");
        if (req.user) {
            cache.del(`tasks_${req.user.id}`);
        }
        cache.del(`task_${req.params.id}`);

        res.status(200).json({
            message: "Task updated successfully",
            task: task
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /tasks/:id
 * @desc    Delete a task and invalidate cache keys
 * @access  Private
 */
router.delete("/:id", validateTaskId, async (req, res, next) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        // Step 4 & Supplementary: Invalidate collection cache and individual task cache
        cache.del("all_tasks");
        if (req.user) {
            cache.del(`tasks_${req.user.id}`);
        }
        cache.del(`task_${req.params.id}`);

        res.status(200).json({
            message: "Task deleted successfully"
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
