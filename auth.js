const jwt = require("jsonwebtoken");

/**
 * Authentication Middleware
 * Verifies JWT token from 'Authorization: Bearer <token>' header
 * Attaches decoded user payload to req.user
 */
const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                message: "Access denied. No authorization token provided."
            });
        }

        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return res.status(401).json({
                message: "Malformed token. Expected format: 'Bearer <token>'"
            });
        }

        const token = parts[1];

        if (!process.env.JWT_SECRET) {
            console.error("FATAL: JWT_SECRET environment variable is not defined");
            return res.status(500).json({
                message: "Server configuration error: JWT secret is missing"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired. Please log in again."
            });
        }
        return res.status(401).json({
            message: "Invalid token. Authentication failed."
        });
    }
};

module.exports = auth;
