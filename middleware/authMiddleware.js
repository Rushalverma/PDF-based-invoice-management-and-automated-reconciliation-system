const jwt = require('jsonwebtoken');
const { getEnvConfig } = require('../config/env');


const verifyToken = (req, res, next) => {
    // Extract the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // authHeader is of the form Bearer TOKEN
    // Isolate the actual token string (removing "Bearer ")
    const token = authHeader.split(' ')[1];

    try {
        const { jwtSecret } = getEnvConfig();
        // Verify the token
        const decoded = jwt.verify(token, jwtSecret);

        // Attach the decoded payload to the request
        req.user = decoded;

        // Pass control to the next middleware or controller
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        if (error.code === 'MISSING_ENV_VARS') {
            return res.status(500).json({ message: error.message });
        }
        return res.status(403).json({ message: 'Invalid token.' });
    }
};


module.exports = verifyToken;