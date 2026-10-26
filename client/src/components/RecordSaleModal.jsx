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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
    }}>
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          position: 'relative',
          border: `1.5px solid ${isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(16, 185, 129, 0.4)'}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            <Wallet size={36} color="var(--text-emerald)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)' }}>
            {isMr ? 'प्रत्यक्ष विक्रीची नोंद करा' : 'Record Actual Harvest Sale'}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {batch.commodity} • {batch.market} ({batch.quantityQuintals} क्विंटल)
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'var(--text-red)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <Calendar size={14} />
              <span>{isMr ? 'विक्रीचा दिनांक (Sale Date)' : 'Actual Sale Date'}</span>
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-title)',
                fontSize: '0.92rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <Banknote size={14} />
              <span>{isMr ? 'मिळालेला प्रत्यक्ष भाव (₹/क्विंटल)' : 'Actual Sale Price (₹/Quintal)'}</span>
            </label>
            <input
              type="number"
              placeholder="उदा. 1250"
              value={actualPrice}
              onChange={(e) => setActualPrice(e.target.value)}
              required
              min="1"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-title)',
                fontSize: '1.1rem',
                fontWeight: 700,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <Scale size={14} />
              <span>{isMr ? 'विक्री केलेले वजन (क्विंटल)' : 'Actual Quantity Sold (Quintals)'}</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={quantitySold}
              onChange={(e) => setQuantitySold(e.target.value)}
              required
              min="0.1"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-title)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {estimatedTotal > 0 && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isMr ? 'एकूण जमा रक्कम:' : 'Total Gross Income:'}
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--text-emerald)' }}>
                ₹{estimatedTotal.toLocaleString()}
              </strong>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <FileText size={14} />
              <span>{isMr ? 'टीप (वैकल्पिक)' : 'Notes / Remarks (Optional)'}</span>
            </label>
            <input
              type="text"
              placeholder={isMr ? 'उदा. सकाळच्या लिलावात भाव चांगला मिळाला' : 'e.g. morning auction, premium quality'}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-title)',
                fontSize: '0.88rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              marginTop: '6px',
            }}
          >
            {loading ? (isMr ? 'जतन करत आहे...' : 'Saving...') : (isMr ? 'विक्री नोंदवा (Confirm Sale Record)' : 'Save Sale Record')}
          </button>
        </form>
      </div>
    </div>
  );
}
