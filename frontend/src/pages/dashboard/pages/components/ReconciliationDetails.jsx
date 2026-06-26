import { useParams } from "react-router-dom";
import "./ReconciliationDetails.css";
import { useState, useEffect, useRef, useCallback } from "react";
import useAuthStore from "../../../../store/useAuthStore";
import { apiUrl } from '../../../../utils/api';

/* ─── helpers ─── */
const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: 2
    }).format(val);
};

const formatDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d)) return null;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Calculate |invoice_date − bank_date| in whole days */
const dateDiff = (d1, d2) => {
    if (!d1 || !d2) return null;
    const a = new Date(d1), b = new Date(d2);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round(Math.abs(a - b) / 86400000);
};

const getStatus = (r) => {
    if (r === 100) return { label: '✓ Matched',   cls: 'status-matched'   };
    if (r === 0)   return { label: '✗ Unmatched', cls: 'status-unmatched' };
    return                 { label: '~ Partial',   cls: 'status-partial'   };
};

/* ─── column definitions ─── */
const COLS = [
    { key: 'index',          label: '#',              defaultW: 55  },
    { key: 'invoice_id',     label: 'Invoice ID',     defaultW: 155 },
    { key: 'description',    label: 'Description',    defaultW: 250 },
    { key: 'type',           label: 'Type',           defaultW: 105 },
    { key: 'invoice_amount', label: 'Invoice Amount', defaultW: 150 },
    { key: 'bank_txn_id',    label: 'Bank TXN ID',    defaultW: 145 },
    { key: 'bank_amount',    label: 'Bank Amount',    defaultW: 150 },
    { key: 'date_diff',      label: 'Date Gap',       defaultW: 110 },
    { key: 'match_pct',      label: 'Match %',        defaultW: 160 },
    { key: 'status',         label: 'Status',         defaultW: 135 },
];
const MIN_W = 55;

export function ReconciliationDetails() {
    const { id: reconId } = useParams();
    const token = useAuthStore(s => s.token);

    const [results,  setResults] = useState([]);
    const [loading,  setLoading] = useState(true);
    const [error,    setError]   = useState('');
    const [filter,   setFilter]  = useState('all');
    const [search,   setSearch]  = useState('');
    const [widths,   setWidths]  = useState(() => COLS.map(c => c.defaultW));

    /* ── fetch ── */
    useEffect(() => {
        if (!reconId) return;
        (async () => {
            try {
                setLoading(true); setError('');
                const res  = await fetch(apiUrl(`/reconciliation/results/${reconId}`), { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed');
                setResults(data.results || []);
            } catch (e) {
                setError('Failed to load reconciliation results.');
            } finally {
                setLoading(false);
            }
        })();
    }, [reconId, token]);

    /* ── column resize ── */
    const drag = useRef(null);

    const startDrag = useCallback((e, i) => {
        e.preventDefault();
        drag.current = { i, x0: e.clientX, w0: widths[i] };
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [widths]);

    useEffect(() => {
        const onMove = (e) => {
            if (!drag.current) return;
            const { i, x0, w0 } = drag.current;
            const newW = Math.max(MIN_W, w0 + e.clientX - x0);
            setWidths(prev => prev.map((w, idx) => idx === i ? newW : w));
        };
        const onUp = () => {
            if (!drag.current) return;
            drag.current = null;
            document.body.style.cursor     = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
    }, []);

    /* ── derived counts ── */
    const matchedC   = results.filter(r => r.result === 100).length;
    const partialC   = results.filter(r => r.result > 0 && r.result < 100).length;
    const unmatchedC = results.filter(r => r.result === 0).length;
    const total      = results.length;

    /* ── match rate % ── */
    const matchRate = total > 0 ? Math.round((matchedC / total) * 100) : 0;

    /* ── filter + search ── */
    const visible = results
        .filter(r => {
            if (filter === 'matched')   return r.result === 100;
            if (filter === 'partial')   return r.result > 0 && r.result < 100;
            if (filter === 'unmatched') return r.result === 0;
            return true;
        })
        .filter(r => {
            const q = search.toLowerCase();
            return !q ||
                (r.invoice_id  || '').toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q) ||
                (r.bank_txn_id || '').toLowerCase().includes(q);
        });

    const totalW = widths.reduce((s, w) => s + w, 0);

    const cell = (i) => ({
        width:        widths[i],
        minWidth:     widths[i],
        maxWidth:     widths[i],
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
    });

    return (
        <div className="recon-page">

            {/* ── Summary strip ── */}
            {!loading && !error && total > 0 && (
                <div className="recon-summary-strip">
                    <div className="rss-card rss-total">
                        <span className="rss-num">{total}</span>
                        <span className="rss-lbl">Total Records</span>
                    </div>
                    <div className="rss-card rss-matched">
                        <span className="rss-num">{matchedC}</span>
                        <span className="rss-lbl">Matched</span>
                    </div>
                    <div className="rss-card rss-partial">
                        <span className="rss-num">{partialC}</span>
                        <span className="rss-lbl">Partial</span>
                    </div>
                    <div className="rss-card rss-unmatched">
                        <span className="rss-num">{unmatchedC}</span>
                        <span className="rss-lbl">Unmatched</span>
                    </div>
                    <div className="rss-card rss-rate">
                        <span className="rss-num">{matchRate}%</span>
                        <span className="rss-lbl">Match Rate</span>
                    </div>
                </div>
            )}

            {/* ── top bar: tabs + search ── */}
            <div className="recon-bar">
                <div className="recon-tabs">
                    {[
                        { k: 'all',       label: 'All',       n: total,      color: '#6b7280' },
                        { k: 'matched',   label: 'Matched',   n: matchedC,   color: '#22c55e' },
                        { k: 'partial',   label: 'Partial',   n: partialC,   color: '#f59e0b' },
                        { k: 'unmatched', label: 'Unmatched', n: unmatchedC, color: '#ef4444' },
                    ].map(t => (
                        <button
                            key={t.k}
                            className={`rtab ${filter === t.k ? 'rtab-on' : ''}`}
                            onClick={() => setFilter(t.k)}
                        >
                            {t.label}
                            <span className="rbadge" style={{ background: t.color }}>{t.n}</span>
                        </button>
                    ))}
                </div>
                <div className="rsearch">
                    <span>🔍</span>
                    <input
                        placeholder="Search invoice, description…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ border: 'none', background: 'none', cursor: 'pointer',
                                     color: '#94a3b8', fontSize: '16px', lineHeight: 1 }}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {loading && <p className="rmsg">Loading results…</p>}
            {error   && <p className="rmsg rerr">{error}</p>}

            {!loading && !error && (
                <>
                    <div className="recon-scroll">
                        <table
                            className="recon-tbl"
                            style={{ width: totalW, minWidth: totalW }}
                        >
                            {/* ── HEADER ── */}
                            <thead>
                                <tr>
                                    {COLS.map((col, i) => (
                                        <th
                                            key={col.key}
                                            style={{
                                                width:    widths[i],
                                                minWidth: widths[i],
                                                maxWidth: widths[i],
                                                position: 'relative',
                                            }}
                                        >
                                            <span className="th-txt">{col.label}</span>
                                            {i < COLS.length - 1 && (
                                                <span
                                                    className="rhandle"
                                                    onMouseDown={e => startDrag(e, i)}
                                                />
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* ── BODY ── */}
                            <tbody>
                                {visible.length === 0 ? (
                                    <tr>
                                        <td colSpan={COLS.length}
                                            style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                            No records match your filter or search.
                                        </td>
                                    </tr>
                                ) : visible.map((row, idx) => {
                                    const st       = getStatus(row.result);
                                    const isCredit = (row.transaction_type || '').toLowerCase() === 'credit';
                                    const barColor = row.result === 100 ? '#22c55e'
                                                   : row.result === 0   ? '#ef4444'
                                                   : '#f59e0b';
                                    const diff     = dateDiff(row.invoice_date, row.bank_date);
                                    const invDateStr  = formatDate(row.invoice_date);
                                    const bankDateStr = formatDate(row.bank_date);
                                    const diffTitle   = invDateStr && bankDateStr
                                        ? `Invoice: ${invDateStr}  |  Bank: ${bankDateStr}`
                                        : undefined;

                                    return (
                                        <tr key={row.id} className={`rrow ${st.cls}`}>
                                            {/* # */}
                                            <td style={cell(0)} className="idx">{idx + 1}</td>

                                            {/* Invoice ID */}
                                            <td style={cell(1)} title={row.invoice_id || ''} className="mono">
                                                {row.invoice_id || '—'}
                                            </td>

                                            {/* Description */}
                                            <td style={cell(2)} title={row.description || ''}>
                                                {row.description || '—'}
                                            </td>

                                            {/* Type */}
                                            <td style={cell(3)}>
                                                <span className={isCredit ? 'tcredit' : 'tdebit'}>
                                                    {isCredit ? '↑ Credit' : '↓ Debit'}
                                                </span>
                                            </td>

                                            {/* Invoice Amount */}
                                            <td style={{ ...cell(4), textAlign: 'right', fontWeight: 600 }}>
                                                {formatCurrency(row.invoice_amount)}
                                            </td>

                                            {/* Bank TXN ID */}
                                            <td style={cell(5)} title={row.bank_txn_id || ''} className="mono">
                                                {row.bank_txn_id || '—'}
                                            </td>

                                            {/* Bank Amount */}
                                            <td style={{ ...cell(6), textAlign: 'right', fontWeight: 600 }}>
                                                {formatCurrency(row.bank_amount)}
                                            </td>

                                            {/* Date Gap */}
                                            <td style={{ ...cell(7), textAlign: 'center' }} title={diffTitle}>
                                                {diff === null ? (
                                                    <span style={{ color: '#cbd5e1' }}>—</span>
                                                ) : diff === 0 ? (
                                                    <span className="diff-zero">Same day</span>
                                                ) : (
                                                    <span
                                                        className={diff > 20 ? 'diff-high' : diff > 7 ? 'diff-mid' : 'diff-low'}
                                                    >
                                                        {diff}d
                                                    </span>
                                                )}
                                            </td>

                                            {/* Match % */}
                                            <td style={cell(8)}>
                                                <div className="mbar-wrap">
                                                    <div className="mbar-track">
                                                        <div
                                                            className="mbar-fill"
                                                            style={{ width: `${row.result}%`, background: barColor }}
                                                        />
                                                    </div>
                                                    <span className="mbar-pct" style={{ color: barColor }}>
                                                        {row.result}%
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td style={cell(9)}>
                                                <span className={`sbadge ${st.cls}`}>{st.label}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p className="rfooter">Showing {visible.length} of {results.length} records</p>
                </>
            )}
        </div>
    );
}