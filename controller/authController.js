const UserModel = require('../model/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUserId = await UserModel.create({ username, email, password_hash }); // ? Last active business id is ovb going to be null so doing that inside of the function

        res.status(201).json({
            message: 'User registered successfully',
            userId: newUserId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await UserModel.findByEmail(email);

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash || '');
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id },
            jwtSecret
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, username: user.username, lastActiveBusinessId: user.last_active_business_id }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


const verify = async (req, res) => {
    // If the middleware passes, the token is valid.
    // We send back the user data (which was attached to req by the middleware)
    res.status(200).json({ 
        success: true, 
        user: req.user,
        message: 'Token is valid' 
    });
};

module.exports = { register, login, verify };