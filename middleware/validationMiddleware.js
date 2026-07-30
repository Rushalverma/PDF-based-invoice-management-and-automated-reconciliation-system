const { body, validationResult } = require('express-validator');

// Minimum 8 characters, at least 1 uppercase letter, 1 number, 1 special character
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const validatePassword = (value) => {
    if (!passwordRegex.test(value)) {
        throw new Error('Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.');
    }
    return true;
};

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0].msg;
        return res.status(400).json({ message: firstError, errors: errors.array() });
    }
    next();
};

const registerValidation = [
    body('username').trim().notEmpty().withMessage('Username is required').escape(),
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').custom(validatePassword),
    handleValidationErrors
];

const loginValidation = [
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const forgotPasswordValidation = [
    body('email').trim().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    handleValidationErrors
];

const resetPasswordValidation = [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword').custom(validatePassword),
    handleValidationErrors
];

module.exports = {
    validatePassword,
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
    handleValidationErrors
};
