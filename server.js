const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const authRoute = require('./routes/authRoute');
const settingsRoute = require('./routes/settingsRoute');
const invoiceRoute = require('./routes/invoiceRoute');
const bankStatementRoute = require('./routes/bankStatementRoute');
const statsRoute = require('./routes/statsRoute');
const initSchema = require('./config/initSchema');
const { getEnvConfig } = require('./config/env');

const ledgerRoute = require('./routes/ledgerRoute');
const reconciliationRoute = require('./routes/reconciliationRoute');


const app = express();
const uploadsRoot = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        const { corsOrigins } = getEnvConfig();

        if (!origin) {
            callback(null, true);
            return;
        }

        if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsRoot));

// Basic health check route
app.get('/lol', (req, res) => {
    res.status(200).json({ message: 'API is running cleanly' });
});
// Routes
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/settings', settingsRoute);
app.use('/api/v1/invoice', invoiceRoute);
app.use('/api/v1/ledger', ledgerRoute);
app.use('/api/v1/bank-statement', bankStatementRoute);
app.use('/api/v1/stats', statsRoute);
app.use('/api/v1/reconciliation', reconciliationRoute);

// Initialize database and start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        getEnvConfig();
        await initSchema();
        console.log('Database initialized successfully.');
    } catch (error) {
        console.error('Server configuration/startup error:', error.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
};

startServer();
