const mysql  = require('mysql2/promise');
const { getEnvConfig } = require('./env');

let poolPromise;

const initializePool = async () => {
    const { mysql: mysqlConfig } = getEnvConfig();

    return mysql.createPool({
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        database: mysqlConfig.database,
        ssl: mysqlConfig.ssl,
        waitForConnections: true,
        connectionLimit: Number(process.env.MYSQL_POOL_LIMIT) || 10,
        queueLimit: 0,
        connectTimeout: 10000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });
};

const getPool = async () => {
    if (!poolPromise) {
        poolPromise = initializePool();
    }
    return poolPromise;
};

module.exports = {
    query: async (...args) => {
        const pool = await getPool();
        return pool.query(...args);
    },
    execute: async (...args) => {
        const pool = await getPool();
        return pool.execute(...args);
    },
    getConnection: async () => {
        const pool = await getPool();
        return pool.getConnection();
    },
    getPool
};
