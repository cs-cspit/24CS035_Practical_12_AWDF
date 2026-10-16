function errorHandler(err, req, res, _next) {
    if (process.env.NODE_ENV !== "test") {
        console.error(err);
    }

    // Mongoose Validation Error
    if (err.name === "ValidationError") {
        const errors = {};
        for (let field in err.errors) {
            errors[field] = err.errors[field].message;
        }
        return res.status(400).json({
            message: "Validation failed",
            errors: errors
        });
    }

    // Invalid MongoDB ID
    if (err.name === "CastError") {
        return res.status(400).json({
            message: "Invalid task ID"
        });
    }

    // Other errors
    res.status(500).json({
        message: "Internal Server Error"
    });
}

module.exports = errorHandler;
