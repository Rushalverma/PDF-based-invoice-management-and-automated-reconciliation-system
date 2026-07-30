const db = require('../config/db');

class UserModel {
    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async updateLastActiveBusiness(userId, businessId) {
        const [result] = await db.execute(
            'UPDATE users SET last_active_business_id = ? WHERE id = ?',
            [businessId, userId]
        );
        return result.affectedRows;
    }

    static async updateUsername(userId, newUsername) {
        const [result] = await db.execute(
            'UPDATE users SET username = ? WHERE id = ?',
            [newUsername, userId]
        );
        return result.affectedRows;
    }

    static async delete(userId) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        return result.affectedRows;
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    }

    static async create(userData) {
        const { username, email, password_hash } = userData;
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password_hash, last_active_business_id) VALUES (?, ?, ?, ?)',
            [username, email, password_hash, null]
        );
        return result.insertId;
    }

    static async setResetToken(userId, token, expiresAt) {
        const [result] = await db.execute(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [token, expiresAt, userId]
        );
        return result.affectedRows;
    }

    static async findByResetToken(token) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
            [token]
        );
        return rows[0] || null;
    }

    static async updatePassword(userId, passwordHash) {
        const [result] = await db.execute(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [passwordHash, userId]
        );
        return result.affectedRows;
    }

    static async setRefreshToken(userId, refreshToken) {
        const [result] = await db.execute(
            'UPDATE users SET refresh_token = ? WHERE id = ?',
            [refreshToken, userId]
        );
        return result.affectedRows;
    }

    static async findByRefreshToken(refreshToken) {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE refresh_token = ?',
            [refreshToken]
        );
        return rows[0] || null;
    }

    static async clearRefreshToken(userId) {
        const [result] = await db.execute(
            'UPDATE users SET refresh_token = NULL WHERE id = ?',
            [userId]
        );
        return result.affectedRows;
    }
}

module.exports = UserModel;
