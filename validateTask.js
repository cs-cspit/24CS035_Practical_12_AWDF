const mongoose = require("mongoose");

/**
 * Validation Middleware for creating a task (POST /tasks)
 * Rejects malformed requests before they reach the database
 */
const validateCreateTask = (req, res, next) => {
    const { title, completed } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({
            message: "Validation error: Task title is required and cannot be empty"
        });
    }

    if (completed !== undefined && typeof completed !== "boolean") {
        return res.status(400).json({
            message: "Validation error: 'completed' must be a boolean value (true or false)"
        });
    }

    // Sanitize title and description
    req.body.title = title.trim();
    if (req.body.description && typeof req.body.description === "string") {
        req.body.description = req.body.description.trim();
    }

    next();
};

/**
 * Validation Middleware for updating a task (PUT /tasks/:id)
 */
const validateUpdateTask = (req, res, next) => {
    const { id } = req.params;
    const { title, completed } = req.body;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            message: "Validation error: Invalid task ID format"
        });
    }

    if (title !== undefined) {
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({
                message: "Validation error: Task title cannot be empty"
            });
        }
        req.body.title = title.trim();
    }

    if (completed !== undefined && typeof completed !== "boolean") {
        return res.status(400).json({
            message: "Validation error: 'completed' must be a boolean value (true or false)"
        });
    }

    if (req.body.description && typeof req.body.description === "string") {
        req.body.description = req.body.description.trim();
    }

    next();
};

/**
 * Validation Middleware for task ID parameter (DELETE /tasks/:id, GET /tasks/:id)
 */
const validateTaskId = (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            message: "Validation error: Invalid task ID format"
        });
    }
    next();
};

module.exports = {
    validateCreateTask,
    validateUpdateTask,
    validateTaskId
};
