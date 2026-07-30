//Initial Parsing & Header Normalization
//Searching for Synonyms
//The Date Construction Engine
//Smart Credit / Debit Detection
//Database Insertion
const fs = require('fs');
const Papa = require('papaparse');
const db = require('../config/db');
const AccountModel = require('../model/accountModel');
const { getActiveBusinessId } = require('../utils/businessHelper');

const normalizeKey = (key) => String(key || '').trim().toLowerCase().replace(/_/g, ' ');

const findValue = (row, targetKeys) => {
  for (const key in row) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const normalized = normalizeKey(key);
    if (targetKeys.includes(normalized)) {
      return row[key];
    }
  }
  return undefined;
};

const parseDateValue = (value) => {
  if (!value) return null;
  const strValue = String(value).trim();
  
  let dateCandidate = new Date(strValue);
  
  if (Number.isNaN(dateCandidate.getTime())) {
    const parts = strValue.split(/[\/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; 
      let year = parseInt(parts[2], 10);
      
      if (year < 100) year += 2000;
      dateCandidate = new Date(year, month, day);
    }
  }

  if (Number.isNaN(dateCandidate.getTime())) return null;

  const y = dateCandidate.getFullYear();
  const m = String(dateCandidate.getMonth() + 1).padStart(2, '0');
  const d = String(dateCandidate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseNumericValue = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[^0-9.-]/g, '').trim();
  if (normalized === '') return null;
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeTransactionRecord = (row, index) => {
  const transaction_id = String(findValue(row, [
    'transaction id', 'tx id', 'id', 'reference', 'transaction reference', 'transaction ref'
  ]) || '').trim() || null;

  const invoice_number = String(findValue(row, [
    'invoice number', 'invoice no', 'inv'
  ]) || '').trim() || null;

  const customer_name = String(findValue(row, [
    'customer name', 'customer', 'client', 'name'
  ]) || '').trim() || null;

  const rawDate = findValue(row, ['date', 'transaction date', 'posted date', 'value date']);
  let transaction_date = parseDateValue(rawDate);

  if (!transaction_date) {
    const rawDay = findValue(row, ['day', 'd', 'date part']);
    const rawMonth = findValue(row, ['month', 'm', 'month part']);
    const rawYear = findValue(row, ['year', 'y', 'year part']);
    
    if (rawDay && rawMonth && rawYear) {
      const dayStr = String(rawDay).trim();
      const monthStr = String(rawMonth).trim();
      const yearStr = String(rawYear).trim();
      
      const combined = `${dayStr}/${monthStr}/${yearStr}`;
      transaction_date = parseDateValue(combined);
      
      if (!transaction_date) {
        const fallbackDate = new Date(`${dayStr} ${monthStr} ${yearStr}`);
        if (!Number.isNaN(fallbackDate.getTime())) {
          transaction_date = `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, '0')}-${String(fallbackDate.getDate()).padStart(2, '0')}`;
        }
      }
    }
  }

  if (!transaction_date) {
    const d = new Date();
    transaction_date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const rawDebit = findValue(row, ['debit', 'dr', 'debit amount']);
  const rawCredit = findValue(row, ['credit', 'cr', 'credit amount']);
  const rawAmount = findValue(row, ['amount', 'transaction amount', 'amt', 'value', 'grand total', 'total']);
  const rawType = String(findValue(row, ['type', 'transaction type', 'txn type']) || '').trim().toLowerCase();

  let amount = parseNumericValue(rawAmount);
  const debit = parseNumericValue(rawDebit);
  const credit = parseNumericValue(rawCredit);

  let transaction_type = 'debit';

  if (debit !== null && credit === null) {
    amount = Math.abs(debit);
    transaction_type = 'debit';
  } else if (credit !== null && debit === null) {
    amount = Math.abs(credit);
    transaction_type = 'credit';
  } else if (amount !== null) {
    if (rawType === 'credit' || rawType === 'cr' || String(amount).startsWith('-') === false && String(rawAmount).includes('-') === false) {
      transaction_type = amount < 0 ? 'debit' : 'credit';
      amount = Math.abs(amount);
    } else {
      transaction_type = amount < 0 ? 'debit' : 'credit';
      amount = Math.abs(amount);
    }
  } else {
    transaction_type = rawType === 'credit' || rawType === 'cr' ? 'credit' : 'debit';
    amount = 0.0;
  }

  const description = String(findValue(row, ['description', 'details', 'narration', 'transaction description', 'text']) || '').trim() || 'Bank statement row';

  return {
    transaction_id,
    invoice_number,
    customer_name,
    transaction_date,
    amount: amount || 0.0,
    transaction_type,
    description,
    index_number: index + 1
  };
};

const parseCsvRows = (csvText) => {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeKey(header)
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const errorMessages = parsed.errors.map((err) => `${err.message} at row ${err.row}`).join('; ');
    throw new Error(`CSV parse error: ${errorMessages}`);
  }

  const validRecords = [];
  parsed.data.forEach((row, index) => {
    const rec = normalizeTransactionRecord(row, index);
    // Ignore unparsed/footer rows missing both transaction_id and valid amount/description
    if (!rec.transaction_id && (!rec.amount || Number(rec.amount) === 0) && (!rec.description || rec.description === 'Bank statement row')) {
      return;
    }
    validRecords.push({ ...rec, index_number: validRecords.length + 1 });
  });

  return validRecords;
};

const uploadStatementGroup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded.' });
    }

    const { name, month, year, bankAccountId } = req.body;
    if (!name || !month || !year || !bankAccountId) {
      return res.status(400).json({ message: 'Missing required bank statement group metadata.' });
    }

    const bankAccountIdNumber = parseInt(bankAccountId, 10);
    if (Number.isNaN(bankAccountIdNumber)) {
      return res.status(400).json({ message: 'Invalid bankAccountId.' });
    }

    const activeBusinessId = await getActiveBusinessId(req);
    if (!activeBusinessId) {
      return res.status(400).json({ message: 'No active business found for your account.' });
    }

    // Verify bank account belongs to active business
    const bankAccount = await AccountModel.findByIdAndBusinessId(bankAccountIdNumber, activeBusinessId);
    if (!bankAccount) {
      return res.status(400).json({ message: 'Selected bank account does not belong to your currently active business.' });
    }

    const [groupResult] = await db.execute(
      'INSERT INTO bank_statement_groups (bank_account_id, name, target_month, target_year) VALUES (?, ?, ?, ?)',
      [bankAccountIdNumber, name, parseInt(month, 10), parseInt(year, 10)]
    );

    const bankStatementGroupId = groupResult.insertId;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedRecords = parseCsvRows(fileContent);

    const [fileResult] = await db.execute(
      'INSERT INTO bank_statement_files (bank_statement_group_id, file_path) VALUES (?, ?)',
      [bankStatementGroupId, filePath]
    );

    const bankStatementFileId = fileResult.insertId;

    const insertPromises = parsedRecords.map((record) => db.execute(
      'INSERT INTO bank_statement_records (bank_statement_group_id, bank_statement_file_id, transaction_id, invoice_number, index_number, transaction_date, amount, transaction_type, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        bankStatementGroupId,
        bankStatementFileId,
        record.transaction_id,
        record.invoice_number || null,
        record.index_number,
        record.transaction_date,
        record.amount,
        record.transaction_type,
        record.description
      ]
    ));

    await Promise.all(insertPromises);

    res.status(201).json({
      message: 'Bank statement CSV uploaded, stored, and parsed successfully.',
      bankStatementGroup: {
        id: bankStatementGroupId,
        name,
        bankAccountId: bankAccountIdNumber,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        entries: parsedRecords.length,
        createdAt: new Date().toISOString()
      },
      parsedRecordsCount: parsedRecords.length
    });
  } catch (error) {
    console.error('Bank statement upload error:', error);
    if (String(error.message).includes('CSV parse error')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error while processing bank statement CSV.' });
  }
};

const getStatementGroups = async (req, res) => {
  try {
    const activeBusinessId = await getActiveBusinessId(req);
    if (!activeBusinessId) {
      return res.status(200).json({ groups: [] });
    }

    const [rows] = await db.execute(
      `SELECT g.id,
              g.bank_account_id,
              g.name,
              g.target_month AS month,
              g.target_year AS year,
              g.created_at AS createdAt,
              b.bank_name,
              b.account_nickname,
              b.account_last_four,
              (SELECT COUNT(*) FROM bank_statement_records r WHERE r.bank_statement_group_id = g.id) AS entries
       FROM bank_statement_groups g
       JOIN bank_accounts b ON g.bank_account_id = b.id
       WHERE b.business_id = ?
       ORDER BY g.created_at DESC`,
      [activeBusinessId]
    );

    const groups = rows.map((row) => ({
      id: row.id,
      bankAccountId: row.bank_account_id,
      name: row.name,
      month: row.month,
      year: row.year,
      createdAt: row.createdAt,
      entries: row.entries,
      bankAccount: `${row.bank_name} ${row.account_nickname ? `(${row.account_nickname})` : ''}`.trim() || row.bank_name,
      accountLastFour: row.account_last_four
    }));

    res.status(200).json({ groups });
  } catch (error) {
    console.error('Fetch statement groups error:', error);
    res.status(500).json({ message: 'Could not fetch bank statement groups.' });
  }
};

const getStatementGroupById = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) {
      return res.status(400).json({ message: 'Invalid statement group ID.' });
    }

    const [groupRows] = await db.execute(
      `SELECT g.id,
              g.name,
              g.target_month AS month,
              g.target_year AS year,
              g.created_at AS createdAt,
              b.bank_name,
              b.account_nickname,
              b.account_last_four
       FROM bank_statement_groups g
       JOIN bank_accounts b ON g.bank_account_id = b.id
       WHERE g.id = ?`,
      [groupId]
    );

    if (!groupRows.length) {
      return res.status(404).json({ message: 'Bank statement group not found.' });
    }

    const [records] = await db.execute(
      `SELECT id,
              transaction_id AS transactionId,
              is_reconciled AS isReconciled,
              transaction_date AS date,
              amount,
              transaction_type AS type,
              description,
              index_number AS indexNumber
       FROM bank_statement_records
       WHERE bank_statement_group_id = ?
       ORDER BY index_number ASC`,
      [groupId]
    );

    const formattedRecords = records.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      reconciled: row.isReconciled ? 'Yes' : 'No',
      date: row.date ? (() => {
        const d = new Date(row.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })() : '',
      amount: Number(row.amount).toFixed(2),
      type: row.type,
      description: row.description,
      indexNumber: row.indexNumber
    }));

    res.status(200).json({
      group: {
        id: groupRows[0].id,
        name: groupRows[0].name,
        month: groupRows[0].month,
        year: groupRows[0].year,
        createdAt: groupRows[0].createdAt,
        bankAccount: `${groupRows[0].bank_name} ${groupRows[0].account_nickname ? `(${groupRows[0].account_nickname})` : ''}`.trim()
      },
      records: formattedRecords
    });
  } catch (error) {
    console.error('Fetch statement group detail error:', error);
    res.status(500).json({ message: 'Could not fetch statement group details.' });
  }
};

const deleteStatementGroup = async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (Number.isNaN(groupId)) {
      return res.status(400).json({ message: 'Invalid statement group ID.' });
    }

    const [groupRows] = await db.execute('SELECT id FROM bank_statement_groups WHERE id = ?', [groupId]);
    if (!groupRows.length) {
      return res.status(404).json({ message: 'Bank statement group not found.' });
    }

    await db.execute('DELETE FROM bank_statement_groups WHERE id = ?', [groupId]);
    
    res.status(200).json({ message: 'Bank statement group deleted successfully.' });
  } catch (error) {
    console.error('Delete statement group error:', error);
    res.status(500).json({ message: 'Could not delete bank statement group.' });
  }
};

module.exports = {
  uploadStatementGroup,
  getStatementGroups,
  getStatementGroupById,
  deleteStatementGroup
};
