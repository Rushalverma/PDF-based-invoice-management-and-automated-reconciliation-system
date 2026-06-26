-- ═══════════════════════════════════════════════════════════════
--  Reconciliation Migration Script
--  Run once with your configured MySQL environment variables and database name.
--  Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add invoice_number column to bank_statement_records ──────
ALTER TABLE bank_statement_records
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) DEFAULT NULL AFTER transaction_id;

-- ── 2. Ensure reconciliation_results table exists with all columns ─
CREATE TABLE IF NOT EXISTS reconciliation_results (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    reconciliation_id        INT NOT NULL,
    ledger_record_id         INT DEFAULT NULL,
    bank_statement_record_id INT DEFAULT NULL,
    invoice_id               VARCHAR(100) DEFAULT NULL,
    description              TEXT DEFAULT NULL,
    transaction_type         VARCHAR(20)  DEFAULT NULL,
    invoice_amount           DECIMAL(15,2) DEFAULT NULL,
    bank_amount              DECIMAL(15,2) DEFAULT NULL,
    bank_txn_id              VARCHAR(100)  DEFAULT NULL,
    result                   TINYINT UNSIGNED NOT NULL DEFAULT 0
                               COMMENT '0=unmatched, 1-99=partial, 100=matched',
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reconciliation_id)
        REFERENCES reconciliation_groups(id)
        ON DELETE CASCADE
);

-- ── 3. Add result column if it's missing (upgrade guard) ──────────
ALTER TABLE reconciliation_results
  MODIFY COLUMN result TINYINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT '0=unmatched, 1-99=partial, 100=matched';

-- ── 4. Index for fast lookups per reconciliation run ──────────────
CREATE INDEX IF NOT EXISTS idx_recon_results_recon_id
    ON reconciliation_results (reconciliation_id);

CREATE INDEX IF NOT EXISTS idx_bsr_invoice_number
    ON bank_statement_records (invoice_number);

-- ═══════════════════════════════════════════════════════════════
--  Done
-- ═══════════════════════════════════════════════════════════════
