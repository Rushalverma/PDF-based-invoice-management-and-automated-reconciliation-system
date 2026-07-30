const UserModel = require('../model/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/env');

// Helper to set httpOnly refresh token cookie
const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUserId = await UserModel.create({ username, email, password_hash });

        // Generate 15-min Access Token & 7-day Refresh Token
        const accessToken = jwt.sign({ userId: newUserId }, jwtSecret, { expiresIn: '15m' });
        const refreshToken = crypto.randomBytes(40).toString('hex');

        await UserModel.setRefreshToken(newUserId, refreshToken);
        setRefreshTokenCookie(res, refreshToken);

        res.status(201).json({
            message: 'User registered successfully',
            token: accessToken,
            user: { id: newUserId, email, username, lastActiveBusinessId: null }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash || '');
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate 15-min Access Token & 7-day Refresh Token
        const accessToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '15m' });
        const refreshToken = crypto.randomBytes(40).toString('hex');

        await UserModel.setRefreshToken(user.id, refreshToken);
        setRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            message: 'Login successful',
            token: accessToken,
            user: { id: user.id, email: user.email, username: user.username, lastActiveBusinessId: user.last_active_business_id }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const refreshTokenHandler = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing. Please log in again.' });
        }

        const user = await UserModel.findByRefreshToken(refreshToken);
        if (!user) {
            res.clearCookie('refreshToken');
            return res.status(403).json({ message: 'Invalid or revoked refresh token.' });
        }

        // Rotate Refresh Token
        const newAccessToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '15m' });
        const newRefreshToken = crypto.randomBytes(40).toString('hex');

        await UserModel.setRefreshToken(user.id, newRefreshToken);
        setRefreshTokenCookie(res, newRefreshToken);

        res.status(200).json({
            success: true,
            token: newAccessToken,
            user: { id: user.id, email: user.email, username: user.username, lastActiveBusinessId: user.last_active_business_id }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during token refresh' });
    }
};

const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            const user = await UserModel.findByRefreshToken(refreshToken);
            if (user) {
                await UserModel.clearRefreshToken(user.id);
            }
        }
        res.clearCookie('refreshToken');
        res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during logout' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await UserModel.findByEmail(email);

        if (!user) {
            return res.status(200).json({
                message: 'If an account exists with that email, a password reset link/token has been generated.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await UserModel.setResetToken(user.id, resetToken, expiresAt);

        res.status(200).json({
            message: 'Password reset link/token generated successfully.',
            resetToken,
            expiresAt
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during forgot password request' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await UserModel.findByResetToken(token);
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await UserModel.updatePassword(user.id, password_hash);

        res.status(200).json({ message: 'Password has been reset successfully. Please log in with your new password.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during password reset' });
    }
};

const verify = async (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user,
        message: 'Token is valid'
    });
};

module.exports = {
    register,
    login,
    verify,
    refreshTokenHandler,
    logout,
    forgotPassword,
    resetPassword
};