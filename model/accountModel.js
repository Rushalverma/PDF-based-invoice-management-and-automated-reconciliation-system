const db = require('../config/db');

class AccountModel {
    static async create(businessId, bankName, accountNickname, accountLastFour) {
        const [result] = await db.execute(
            'INSERT INTO bank_accounts (business_id, bank_name, account_nickname, account_last_four) VALUES (?, ?, ?, ?)',
            [businessId, bankName, accountNickname, accountLastFour]
        );
        return result.insertId;
    }

    static async findByUserId(userId) {
        // Find all accounts for businesses owned by this user
        const [rows] = await db.execute(
            `SELECT ba.* FROM bank_accounts ba 
             JOIN businesses b ON ba.business_id = b.id 
             WHERE b.user_id = ?`,
            [userId]
        );
        return rows;
    }

    static async findByBusinessId(businessId) {
        const [rows] = await db.execute(
            'SELECT * FROM bank_accounts WHERE business_id = ?',
            [businessId]
        );
        return rows;
    }

    static async findByIdAndBusinessId(accountId, businessId) {
        const [rows] = await db.execute(
            'SELECT * FROM bank_accounts WHERE id = ? AND business_id = ?',
            [accountId, businessId]
        );
        return rows[0] || null;
    }

    static async delete(id, userId) {
        // Must ensure the user deleting the account actually owns the business it belongs to
        const [result] = await db.execute(
            `DELETE ba FROM bank_accounts ba
             JOIN businesses b ON ba.business_id = b.id
             WHERE ba.id = ? AND b.user_id = ?`,
            [id, userId]
        );
        return result.affectedRows;
    }
}

module.exports = AccountModel;
