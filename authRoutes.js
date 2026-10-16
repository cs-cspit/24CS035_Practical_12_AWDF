const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// Validation helper
const isValidEmail = (email) => {
    return typeof email === "string" && /^\S+@\S+\.\S+$/.test(email.trim());
};

/**
 * @route   POST /auth/register
 * @desc    Register a new user, hash password using bcrypt, save to MongoDB
 * @access  Public
 */
router.post("/register", async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                message: "Validation error: A valid email address is required"
            });
        }

        if (!password || typeof password !== "string" || password.length < 6) {
            return res.status(400).json({
                message: "Validation error: Password must be at least 6 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                message: "User with this email already exists"
            });
        }

        // Hash password using bcrypt (salt rounds = 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user document to MongoDB
        const user = await User.create({
            name: name ? name.trim() : "",
            email: normalizedEmail,
            password: hashedPassword
        });

        // Generate JWT token on registration as well for convenience
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /auth/login
 * @desc    Authenticate user, verify password with bcrypt, return signed JWT
 * @access  Public
 */
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                message: "Validation error: Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find user by email
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Compare plain password with stored bcrypt hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Sign JWT token with 1-hour expiry
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /auth/me
 * @desc    Supplementary: Returns currently logged-in user details using decoded JWT
 * @access  Private (Protected with Auth Middleware)
 */
router.get("/me", auth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        res.status(200).json({
            message: "User profile fetched successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
