import React, { useState } from 'react';
import { recordSaleOutcomeApi } from '../services/priceApi';
import { X, Wallet, AlertTriangle, Calendar, Banknote, Scale, FileText } from 'lucide-react';

export default function RecordSaleModal({ isOpen, onClose, batch, lang = 'mr', theme = 'dark', onSuccess }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';

  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualPrice, setActualPrice] = useState('');
  const [quantitySold, setQuantitySold] = useState(batch?.quantityQuintals || 50);
  const [userNotes, setUserNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen && batch) {
      setQuantitySold(batch.quantityQuintals || 50);
      setActualPrice('');
      setUserNotes('');
      setError('');
      setSaleDate(new Date().toISOString().slice(0, 10));
    }
  }, [isOpen, batch]);

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const priceNum = Number(actualPrice);
    const qtyNum = Number(quantitySold);

    if (!priceNum || priceNum <= 0) {
      setError(isMr ? 'कृपया मिळालेला प्रत्यक्ष भाव टाका.' : 'Please enter actual price received.');
      return;
    }

    if (!qtyNum || qtyNum <= 0) {
      setError(isMr ? 'कृपया प्रत्यक्ष विक्रीचे वजन टाका.' : 'Please enter actual quantity sold.');
      return;
    }

    setLoading(true);
    try {
      await recordSaleOutcomeApi({
        batchId: batch._id,
        actualSaleDate: saleDate,
        actualPrice: priceNum,
        actualQuantitySold: qtyNum,
        actualRevenue: Math.round(priceNum * qtyNum),
        userNotes: userNotes.trim(),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to record sale.');
    } finally {
      setLoading(false);
    }
  };

  const estimatedTotal = (Number(actualPrice) || 0) * (Number(quantitySold) || 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content-card"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 'clamp(20px, 4vw, 28px)' }}
      >
        {/* Mobile drag handle */}
        <div className="sheet-handle" />

        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'var(--bg-pill)',
            border: '1px solid var(--border-highlight)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px',
          }}>
            <Wallet size={26} color="var(--accent-green)" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)' }}>
            {isMr ? 'प्रत्यक्ष विक्रीची नोंद करा' : 'Record Actual Sale'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {batch.commodity} • {batch.market} ({batch.quantityQuintals} qtl)
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'var(--text-red)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.8rem',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              <Calendar size={14} color="var(--text-emerald)" />
              <span>{isMr ? 'विक्रीचा दिनांक' : 'Sale Date'}</span>
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
              className="input-base"
              style={{ fontSize: '0.95rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              <Banknote size={14} color="var(--text-emerald)" />
              <span>{isMr ? 'मिळालेला भाव (₹/क्विंटल)' : 'Actual Price (₹/Quintal)'}</span>
            </label>
            <input
              type="number"
              placeholder="उदा. 1250"
              value={actualPrice}
              onChange={(e) => setActualPrice(e.target.value)}
              required
              min="1"
              className="input-base"
              style={{ fontSize: '1.05rem', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              <Scale size={14} color="var(--text-emerald)" />
              <span>{isMr ? 'विक्री वजन (क्विंटल)' : 'Quantity Sold (Quintals)'}</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={quantitySold}
              onChange={(e) => setQuantitySold(e.target.value)}
              required
              min="0.1"
              className="input-base"
              style={{ fontSize: '0.95rem', fontWeight: 600 }}
            />
          </div>

          {estimatedTotal > 0 && (
            <div style={{
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-highlight)',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isMr ? 'एकूण रक्कम:' : 'Gross Revenue:'}
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--text-emerald)' }}>
                ₹{estimatedTotal.toLocaleString()}
              </strong>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
              <FileText size={14} color="var(--text-emerald)" />
              <span>{isMr ? 'टीप (वैकल्पिक)' : 'Notes (Optional)'}</span>
            </label>
            <input
              type="text"
              placeholder={isMr ? 'उदा. सकाळच्या लिलावात चांगला भाव' : 'e.g. morning auction'}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              className="input-base"
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '12px',
                color: 'var(--text-title)',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isMr ? 'रद्द करा' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 2, padding: '12px', fontSize: '0.88rem' }}
            >
              {loading ? (
                <span className="loading-spinner" />
              ) : (
                <span>{isMr ? 'नोंद जतन करा' : 'Save Record'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
