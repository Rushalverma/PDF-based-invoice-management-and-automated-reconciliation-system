# PDF-Based Invoice Management And Automated Reconciliation System

## Plugins

VS Code Extensions

REST Client by Huachao Mao 
Better Comments by Aaron Bond


## Tech Stack

- Backend: Node.js + Express
- Database: MySQL
- PDF extraction: pdf-parse
- CSV parsing: csv-parse
- Auth: JWT

## Current Features

- User registration and login
- MySQL schema bootstrap on app startup
- Invoice upload API (PDF)
- Bank statement upload API (CSV)
- Reconciliation engine with configurable tolerance
- Dashboard summary and latest reconciliation results
- Audit logs for core actions

## Database Entities

- users
- invoices
- bank_transactions
- reconciliation_results
- audit_logs

## Setup

1. Install dependencies:

	 npm install

2. Configure environment variables using `.env.example`.

3. Start the server:

	 node server.js

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## API Endpoints

Base URL: /api/v1/reconciliation

- POST /upload-invoice
	- Auth: required (Bearer token)
	- Form-data field: invoice (PDF file)

- POST /upload-bank-statement
	- Auth: required (Bearer token)
	- Form-data field: statement (CSV file)

- POST /run
	- Auth: required (Bearer token)
	- Optional JSON body:
		- amountToleranceAbs
		- amountTolerancePercent
		- dateToleranceDays

- GET /dashboard
	- Auth: required (Bearer token)
	- Returns summary counts and recent reconciliation records

## Notes

- This version is optimized for text-based PDFs and intentionally does not use OCR.
- OCR/image-based invoice support can be added as an extension.
