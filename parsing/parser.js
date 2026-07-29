/**
 * PDF Parser Module
 * 
 * This module extracts structured invoice data from PDF documents using:
 * 1. pdf.js for text + spatial data extraction
 * 2. Fuse.js for fuzzy-matching text items against known field labels
 * 3. Regex for inline value extraction
 * 4. Spatial proximity (X/Y coordinates) for finding values near their labels
 * 
 * Prerequisites:
 * npm install pdfjs-dist fuse.js
 */

const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Fuse = require('fuse.js');
const { trainingData } = require('./trainingData');

pdfjsLib.GlobalWorkerOptions.workerSrc = false;

// ─────────────────────────────────────────────
// 1. Build Fuse.js instances from trainingData
// ─────────────────────────────────────────────

/**
 * Picks the label group from trainingData by label name
 * and creates a Fuse instance for fuzzy searching.
 */
function buildFuseForLabel(label) {
    const group = trainingData.find(g => g.label === label);
    if (!group) return null;

    // Each phrase becomes a searchable document
    const docs = group.phrases.map(p => ({ phrase: p }));
    return new Fuse(docs, {
        keys: ['phrase'],
        threshold: 0.4,       // 0 = exact match, 1 = match anything
        includeScore: true,
    });
}

const fuseTransactionId = buildFuseForLabel('transaction_id_anchor');
const fuseTransactionDate = buildFuseForLabel('transaction_date_anchor');
const fuseAmount = buildFuseForLabel('amount_anchor');
const fuseDescription = buildFuseForLabel('description_anchor');

// High-priority total keywords — these take precedence over generic "Amount"
const TOTAL_KEYWORDS = [
    'total', 'grand total', 'net payable', 'final amount', 'net total',
    'total amount', 'total due', 'amount due', 'balance due',
    'total payable', 'invoice total', 'bill total', 'final total',
    'amount payable', 'total invoice value', 'total bill value'
];

// ─────────────────────────────────────────────
// 2. Spatial helpers
// ─────────────────────────────────────────────

/** Get X position from a pdf.js text item */
function getX(item) { return item.transform[4]; }

/** Get Y position from a pdf.js text item (PDF Y goes upward) */
function getY(item) { return item.transform[5]; }

/**
 * Find the nearest text item to the RIGHT of the anchor.
 * Same row = Y within ±5, X must be greater.
 */
function findRight(anchor, items) {
    const ax = getX(anchor);
    const ay = getY(anchor);
    let best = null;
    let bestDist = Infinity;

    for (const item of items) {
        if (item === anchor) continue;
        const ix = getX(item);
        const iy = getY(item);

        // Same row (Y tolerance ±5) and to the right (no max distance)
        if (Math.abs(iy - ay) <= 5 && ix > ax) {
            const dist = ix - ax;
            if (dist < bestDist) {
                bestDist = dist;
                best = item;
            }
        }
    }
    return best;
}

/**
 * Find the nearest text item BELOW the anchor.
 * Same column = X within ±50, Y must be lower (smaller value in PDF coords).
 */
function findBelow(anchor, items) {
    const ax = getX(anchor);
    const ay = getY(anchor);
    let best = null;
    let bestDist = Infinity;

    for (const item of items) {
        if (item === anchor) continue;
        const ix = getX(item);
        const iy = getY(item);

        // Same column (X tolerance ±50) and below (Y is smaller in PDF)
        if (Math.abs(ix - ax) <= 50 && ay > iy && ay - iy < 50) {
            const dist = ay - iy;
            if (dist < bestDist) {
                bestDist = dist;
                best = item;
            }
        }
    }
    return best;
}

// ─────────────────────────────────────────────
// 3. Regex patterns for inline value extraction
// ─────────────────────────────────────────────

// Matches IDs like INV-2024-001, DB/2024/0042, 123456, etc.
const TRANSACTION_ID_REGEX = /[A-Z]{0,5}[-\/]?\d{3,}[-\/A-Z0-9]*/i;

// Matches dates:
//   Numeric:    DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
//   Month name: 23 April 2026, 15 Jan 2024, 1-Mar-2025
const DATE_REGEX = /(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i;

// Matches amounts: ₹1,775,000.00, $500.00, 1234.56, ₹2,094,500.0.00, etc.
// Greedy: grabs currency symbol + all digits/commas/dots in sequence
const AMOUNT_REGEX = /[₹$€£]\s?[\d,]+(?:\.\d+)+|[\d,]+\.\d{2}/;

// ─────────────────────────────────────────────
// 4. Core extraction logic
// ─────────────────────────────────────────────

/**
 * Searches all text items for the best fuzzy match against a Fuse instance.
 * Returns { anchor: textItem, score } or null.
 */
function findBestAnchor(fuseInstance, items) {
    if (!fuseInstance) return null;

    let bestAnchor = null;
    let bestScore = Infinity; // lower = better in Fuse

    for (const item of items) {
        const text = item.str.trim();
        if (!text) continue;

        const results = fuseInstance.search(text);
        if (results.length > 0 && results[0].score < bestScore) {
            bestScore = results[0].score;
            bestAnchor = item;
        }
    }

    // Only accept if below threshold
    if (bestAnchor && bestScore <= 0.4) {
        return { anchor: bestAnchor, score: bestScore };
    }
    return null;
}

/**
 * Searches text items for a "Total" keyword match.
 * 
 * Two-pass priority:
 *   Pass 1: text STARTS with keyword → "TOTAL: ₹..." matches, "Subtotal:" does NOT
 *   Pass 2: text CONTAINS keyword (fallback only if Pass 1 finds nothing)
 * 
 * Within each pass, prefers the longest matching keyword.
 */
function findTotalAnchor(items) {
    let bestItem = null;
    let bestKeywordLen = 0;

    // Pass 1: Prefer items where text STARTS with a total keyword
    for (const item of items) {
        const text = item.str.trim().toLowerCase();
        if (!text) continue;

        for (const keyword of TOTAL_KEYWORDS) {
            if (text.startsWith(keyword) && keyword.length > bestKeywordLen) {
                bestKeywordLen = keyword.length;
                bestItem = item;
            }
        }
    }

    if (bestItem) return bestItem;

    // Pass 2: Fallback — text contains a total keyword anywhere
    bestKeywordLen = 0;
    for (const item of items) {
        const text = item.str.trim().toLowerCase();
        if (!text) continue;

        for (const keyword of TOTAL_KEYWORDS) {
            if (text.includes(keyword) && keyword.length > bestKeywordLen) {
                bestKeywordLen = keyword.length;
                bestItem = item;
            }
        }
    }

    return bestItem;
}

/**
 * Given an anchor item, try to extract a value:
 * 1. First try inline (value embedded in the same text as the label)
 * 2. Then try spatial: right neighbor, then below neighbor
 */
function extractValue(anchor, items, regex) {
    const text = anchor.str;

    // Step A: Inline extraction
    // Try to split on common separators like ":", then match regex on the value part
    const separatorIndex = text.search(/[:]\s*/);
    if (separatorIndex !== -1) {
        const valuePart = text.substring(separatorIndex + 1).trim();
        const match = valuePart.match(regex);
        if (match) return match[0].trim();
    }

    // Also try matching the full text (for cases like "TOTAL: ₹2,094,500.00")
    const fullMatch = text.match(regex);
    if (fullMatch) {
        // Make sure the matched value isn't just the label itself
        const matchedVal = fullMatch[0].trim();
        // Check if the match is significantly different from the anchor text
        // (avoid returning "No" from "Invoice No" as a transaction ID)
        if (matchedVal.length > 2 || regex === AMOUNT_REGEX) {
            return matchedVal;
        }
    }

    // Step B: Spatial — look to the right first
    const rightItem = findRight(anchor, items);
    if (rightItem) {
        const rightMatch = rightItem.str.trim().match(regex);
        if (rightMatch) return rightMatch[0].trim();
    }

    // Step C: Spatial — look below
    const belowItem = findBelow(anchor, items);
    if (belowItem) {
        const belowMatch = belowItem.str.trim().match(regex);
        if (belowMatch) return belowMatch[0].trim();
    }

    return null;
}

/**
 * Extract description by collecting text items below the description anchor.
 * Walks downward in the same column, stops at large Y gap or another anchor.
 */
function extractDescription(anchor, items) {
    const ax = getX(anchor);
    const ay = getY(anchor);

    // Collect items that are below and in similar X column
    const candidates = items
        .filter(item => {
            if (item === anchor) return false;
            const ix = getX(item);
            const iy = getY(item);
            // Below the anchor, within column tolerance
            return iy < ay && Math.abs(ix - ax) <= 60 && (ay - iy) < 200;
        })
        .sort((a, b) => getY(b) - getY(a)); // Sort top to bottom (descending Y)

    if (candidates.length === 0) return null;

    // Collect text until we hit a large gap (> 25 units between consecutive items)
    const descParts = [];
    let prevY = ay;

    for (const item of candidates) {
        const gap = prevY - getY(item);
        if (gap > 25 && descParts.length > 0) break; // large gap = new section

        const text = item.str.trim();
        if (text) descParts.push(text);
        prevY = getY(item);
    }

    return descParts.length > 0 ? descParts.join(', ') : null;
}

// ─────────────────────────────────────────────
// 5. Main parsing pipeline
// ─────────────────────────────────────────────

/**
 * Formats an extracted date string to MySQL-compatible YYYY-MM-DD format.
 */
function formatDateForMySQL(dateStr) {
    if (!dateStr) return null;
    
    // First, try standard JS Date parsing
    let date = new Date(dateStr);
    
    // If it's invalid, try DD/MM/YYYY or DD-MM-YYYY
    if (isNaN(date.getTime())) {
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                const day = parts[0];
                const month = parts[1];
                const year = parts[2];
                date = new Date(`${year}-${month}-${day}`);
            } else if (parts[0].length === 4) {
                const year = parts[0];
                const month = parts[1];
                const day = parts[2];
                date = new Date(`${year}-${month}-${day}`);
            }
        }
    }

    if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    return dateStr;
}

/**
 * Parses a PDF and extracts structured invoice data from every page.
 * 
 * @param {string|Buffer} pdfInput - Path to the PDF file or Buffer instance
 * @returns {Promise<Array>} Array of invoice data objects (one per page)
 */
async function parsePdf(pdfInput) {
    try {
        console.log(`[Parser] Starting extraction for PDF input`);

        let dataBuffer;
        if (Buffer.isBuffer(pdfInput)) {
            dataBuffer = pdfInput;
        } else if (typeof pdfInput === 'string') {
            dataBuffer = await fs.promises.readFile(pdfInput);
        } else {
            throw new Error('Invalid PDF input: must be a Buffer or file path string');
        }

        const dataUint8Array = new Uint8Array(dataBuffer);

        const loadingTask = pdfjsLib.getDocument({ data: dataUint8Array });
        const pdfDocument = await loadingTask.promise;

        console.log(`[Parser] Successfully loaded PDF. Total pages: ${pdfDocument.numPages}`);

        const allInvoiceData = [];

        for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            console.log(`\n--- Processing Page ${pageNum} ---`);

            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Strip unnecessary properties
            for (let i = 0; i < textContent.items.length; i++) {
                const item = textContent.items[i];
                delete item.dir;
                delete item.hasEOL;
                delete item.fontName;
            }

            const invoiceData = getInvoiceDataFromPageItems(textContent.items);
            invoiceData.page = pageNum;

            console.log(`[Parser] Page ${pageNum} result:`);
            console.dir(invoiceData, { depth: null, colors: true });

            allInvoiceData.push(invoiceData);
        }

        console.log(`\n[Parser] Finished processing ${pdfPath}. Extracted ${allInvoiceData.length} record(s).`);
        return allInvoiceData;

    } catch (error) {
        console.error(`[Parser] Error occurred while parsing the PDF:`, error);
        throw error;
    }
}

/**
 * Extracts a single invoice data object from a page's text items.
 */
function getInvoiceDataFromPageItems(pageItems) {
    const filteredItems = pageItems.filter(item => item.str && item.str.trim() !== '');

    // --- Transaction ID ---
    let transaction_id = null;
    const txIdAnchor = findBestAnchor(fuseTransactionId, filteredItems);
    if (txIdAnchor) {
        console.log(`[Anchor] transaction_id: "${txIdAnchor.anchor.str}" (score: ${txIdAnchor.score.toFixed(3)})`);
        transaction_id = extractValue(txIdAnchor.anchor, filteredItems, TRANSACTION_ID_REGEX);
    }

    // --- Transaction Date ---
    let transaction_date = null;
    const dateAnchor = findBestAnchor(fuseTransactionDate, filteredItems);
    if (dateAnchor) {
        console.log(`[Anchor] transaction_date: "${dateAnchor.anchor.str}" (score: ${dateAnchor.score.toFixed(3)})`);
        let raw_date = extractValue(dateAnchor.anchor, filteredItems, DATE_REGEX);
        transaction_date = formatDateForMySQL(raw_date);
    }

    // --- Amount (Priority: Total > generic Amount) ---
    let amount = null;
    const totalAnchor = findTotalAnchor(filteredItems);
    if (totalAnchor) {
        console.log(`[Anchor] amount (TOTAL priority): "${totalAnchor.str}"`);
        amount = extractValue(totalAnchor, filteredItems, AMOUNT_REGEX);
    } else {
        // Fallback to generic amount anchor via fuzzy search
        const amountAnchor = findBestAnchor(fuseAmount, filteredItems);
        if (amountAnchor) {
            console.log(`[Anchor] amount (fallback): "${amountAnchor.anchor.str}" (score: ${amountAnchor.score.toFixed(3)})`);
            amount = extractValue(amountAnchor.anchor, filteredItems, AMOUNT_REGEX);
        }
    }

    // Clean amount for DECIMAL(15,2) format
    if (amount) {
        // Strip currency symbols, commas, spaces
        let cleaned = amount.replace(/[₹$€£,\s]/g, '');
        // Handle malformed decimals like "2094500.0.00" → keep only the last dot
        const dotParts = cleaned.split('.');
        if (dotParts.length > 2) {
            // Join all parts except last as the integer part, last part is decimals
            const decimals = dotParts.pop();
            cleaned = dotParts.join('') + '.' + decimals;
        }
        amount = parseFloat(cleaned);
        if (isNaN(amount)) amount = null;
    }

    // --- Transaction Type ---
    const transaction_type = getInvoiceType(filteredItems);

    // --- Description ---
    let description = null;
    const descAnchor = findBestAnchor(fuseDescription, filteredItems);
    if (descAnchor) {
        console.log(`[Anchor] description: "${descAnchor.anchor.str}" (score: ${descAnchor.score.toFixed(3)})`);
        description = extractDescription(descAnchor.anchor, filteredItems);
    }

    return {
        transaction_id,
        transaction_date,
        amount,
        transaction_type,
        description
    };
}

/**
 * Determines if the invoice is a debit or credit based on keyword analysis.
 */
function getInvoiceType(pageItems) {
    const fullText = pageItems
        .map(item => item.str.trim())
        .filter(str => str !== '')
        .join(' ');

    const creditRegex = /\b(bill\s+to|invoice\s+to|sold\s+to|amount\s+received|receipt)\b/i;
    const debitRegex = /\b(bill\s+from|invoice\s+from|payable\s+to|remit\s+to|amount\s+due)\b/i;

    const hasCreditSignal = creditRegex.test(fullText);
    const hasDebitSignal = debitRegex.test(fullText);

    if (hasCreditSignal && !hasDebitSignal) return 'credit';
    if (hasDebitSignal && !hasCreditSignal) return 'debit';

    return 'debit';
}

// Export the function so it can be integrated with API routes
module.exports = {
    parsePdf
};
