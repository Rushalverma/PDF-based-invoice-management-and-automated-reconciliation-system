const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    register,
    login,
    verify,
    refreshTokenHandler,
    logout,
    forgotPassword,
    resetPassword
} = require('../controller/authController');
const verifyToken = require('../middleware/authMiddleware');
const {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation
} = require('../middleware/validationMiddleware');

const router = express.Router();

// ─── Rate Limiter (1.6) ──────────────────────────────────────────────────────
// Restrict authentication requests to ~10 requests per minute per IP
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { message: 'Too many authentication attempts from this IP, please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiter to all auth routes
router.use(authLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.post('/refresh', refreshTokenHandler);
router.post('/logout', logout);
router.get('/verify', verifyToken, verify);

module.exports = router;