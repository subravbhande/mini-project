import React, { useState, useEffect } from 'react';
import { fetchUserBatchesApi, fetchHistorySummaryApi, deleteBatchApi } from '../services/priceApi';
import RecordSaleModal from './RecordSaleModal';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Clock,
  Target,
  Package,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export default function FarmerHistoryView({ user: propUser, lang = 'mr', theme = 'dark', onBackToAdvisory, onNavigateAdvisory }) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const handleBack = onBackToAdvisory || onNavigateAdvisory;
  const isMr = lang === 'mr';

  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected batch for recording sale
  const [selectedBatchForSale, setSelectedBatchForSale] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [batchList, sumStats] = await Promise.all([
        fetchUserBatchesApi(),
        fetchHistorySummaryApi(),
      ]);
      setBatches(batchList);
      setSummary(sumStats);
    } catch (err) {
      console.error('Failed to load farmer history:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (batchId) => {
    if (!window.confirm(isMr ? 'हा शेतमाल रेकॉर्ड नक्की काढून टाकायचा आहे का?' : 'Are you sure you want to delete this batch?')) {
      return;
    }
    try {
      await deleteBatchApi(batchId);
      loadData();
    } catch (err) {
      alert(err.message || 'Delete failed.');
    }
  };

  const activeBatches = batches.filter((b) => b.status === 'active');
  const soldBatches = batches.filter((b) => b.status === 'sold');

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-emerald)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
              marginBottom: '6px',
            }}
          >
            ← {isMr ? 'बाजार भाव सल्ल्याकडे परत जा' : 'Back to Market Advisory'}
          </button>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={24} color="var(--text-emerald)" />
            <span>{isMr ? 'माझा शेतमाल इतिहास व नफा विश्लेषण' : 'My Harvest History & Net Uplift'}</span>
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isMr
              ? `शेतकरी: ${user?.name || 'बळीराजा'}${user?.phone ? ` (${user.phone})` : ''} • जिल्हा: ${user?.district || 'Kolhapur'}`
              : `Farmer: ${user?.name || 'Farmer'}${user?.phone ? ` (${user.phone})` : ''} • District: ${user?.district || 'Kolhapur'}`}
          </p>
        </div>

        <button
          onClick={loadData}
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: 'var(--text-body)',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={14} />
          <span>{isMr ? 'रिफ्रेश करा' : 'Refresh Data'}</span>
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: 'var(--text-red)',
          padding: '12px 18px',
          borderRadius: '12px',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Financial Impact Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Card 1: Cumulative Uplift */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-gold)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={15} />
              <span>{isMr ? 'एकूण मिळवलेला जादा नफा' : 'Total Realized Uplift'}</span>
            </div>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: summary.totalRealizedUplift >= 0 ? 'var(--text-emerald)' : 'var(--text-red)',
            }}>
              {summary.totalRealizedUplift >= 0 ? `+₹${summary.totalRealizedUplift.toLocaleString()}` : `-₹${Math.abs(summary.totalRealizedUplift).toLocaleString()}`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isMr ? 'AI सल्ला वापरून साधलेला अतिरिक्त फायदा' : 'Cumulative extra earnings vs day-0 sale'}
            </div>
          </div>

          {/* Card 2: Total Revenue */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet size={15} />
              <span>{isMr ? 'एकूण प्रत्यक्ष विक्री रक्कम' : 'Total Revenue Realized'}</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-blue)' }}>
              ₹{summary.totalRealizedRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isMr ? `${summary.soldBatches} पूर्ण विक्री लॉट्समधून` : `From ${summary.soldBatches} completed sales`}
            </div>
          </div>

          {/* Card 3: Active Batches */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} />
              <span>{isMr ? 'चालू शेतमाल लॉट्स (Holding)' : 'Active Holding Batches'}</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-title)' }}>
              {summary.activeBatches}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isMr ? 'सध्या साठवणुकीत असणारा माल' : 'Currently monitoring for optimal price'}
            </div>
          </div>

          {/* Card 4: Success Rate */}
          <div className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={15} />
              <span>{isMr ? 'नफ्यातील व्यवहार' : 'Profitable Sales'}</span>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-emerald)' }}>
              {summary.profitableSalesCount} / {summary.soldBatches || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isMr ? 'बाजारभावाचा फायदा घेतलेली विक्री' : 'Batches sold with positive holding uplift'}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE BATCHES SECTION */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--text-gold)" />
            <span>{isMr ? 'चालू शेतमाल (Active Harvest Batches)' : 'Active Harvest Batches'}</span>
            <span style={{
              fontSize: '0.75rem',
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              padding: '2px 8px',
              borderRadius: '12px',
              color: 'var(--text-muted)',
            }}>
              {activeBatches.length}
            </span>
          </h2>
        </div>

        {loading && batches.length === 0 ? (
          <div className="glass-card" style={{ padding: '36px', textAlign: 'center', borderRadius: '16px' }}>
            <span className="loading-spinner" style={{ display: 'inline-block', marginBottom: '12px' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {isMr ? 'माहिती लोड होत आहे...' : 'Loading harvest batches...'}
            </p>
          </div>
        ) : activeBatches.length === 0 ? (
          <div className="glass-card" style={{ padding: '36px', textAlign: 'center', borderRadius: '16px' }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
              <Package size={36} color="var(--text-muted)" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)', marginBottom: '6px' }}>
              {isMr ? 'सध्या कोणताही चालू माल नाही' : 'No Active Batches'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 16px' }}>
              {isMr
                ? 'बाजार भाव सल्ला पृष्ठावर जाऊन आपल्या मालाचा अंदाज तपासा आणि "हा सल्ला सेव्ह करा" वर क्लिक करा.'
                : 'Run a market timing query on the main page and click "Save Advisory to My Batches" to track it here.'}
            </p>
            <button onClick={handleBack} className="btn-primary" style={{ padding: '8px 18px', borderRadius: '8px' }}>
              {isMr ? 'नवीन सल्ला तपासा' : 'Check Price Advisory'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 380px))', gap: '20px' }}>
            {activeBatches.map((batch) => {
              const dec = batch.latestDecision;
              const isHold = dec?.decision === 'HOLD';
              const isPartial = dec?.decision === 'PARTIAL_SELL';
              const badgeColor = isHold ? '#10b981' : isPartial ? '#f59e0b' : '#ef4444';

              // Format uplift properly to 2 decimals
              let rawU = dec?.upliftPct;
              let numU = Number(rawU) || 0;
              if (Math.abs(numU) > 0 && Math.abs(numU) < 1) numU *= 100;
              const formattedUplift = `${numU > 0 ? '+' : ''}${numU.toFixed(2)}%`;

              return (
                <div
                  key={batch._id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    borderLeft: `4px solid ${badgeColor}`,
                    width: '100%',
                    maxWidth: '380px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                          padding: '2px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        }}>
                          <img
                            src={batch.commodity.toLowerCase() === 'onion' ? '/onion.jpg' : '/tomato.jpg'}
                            alt={batch.commodity}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                        <span>{batch.commodity}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {batch.market} ({batch.district})
                      </div>
                    </div>

                    <span style={{
                      background: `${badgeColor}22`,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}66`,
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                    }}>
                      {dec?.decision || 'PENDING'}
                    </span>
                  </div>

                  {/* Volume & Harvest Date */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    background: 'var(--bg-subtle)',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{isMr ? 'वजन:' : 'Quantity:'}</span>{' '}
                      <strong style={{ color: 'var(--text-title)' }}>{batch.quantityQuintals} क्विंटल</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>{isMr ? 'साठवणूक:' : 'Storage:'}</span>{' '}
                      <strong style={{ color: 'var(--text-title)' }}>{batch.storageType}</strong>
                    </div>
                  </div>

                  {/* Advisory Timing */}
                  {dec && (
                    <div style={{ fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{isMr ? 'कारवाईची तारीख:' : 'Act-by Date:'}</span>
                        <strong style={{ color: 'var(--text-title)' }}>{dec.actByDate}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{isMr ? 'अपेक्षित नफा:' : 'Projected Uplift:'}</span>
                        <strong style={{ color: numU > 0 ? 'var(--text-emerald)' : 'var(--text-red)' }}>
                          {formattedUplift}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
                    <button
                      id="record-sale-btn"
                      onClick={() => setSelectedBatchForSale(batch)}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Wallet size={14} />
                      <span>{isMr ? 'विक्री नोंदवा (Sold)' : 'Record Sale'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(batch._id)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-red)',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Delete Batch"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLETED / SOLD BATCHES SECTION */}
      {soldBatches.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} color="var(--text-emerald)" />
            <span>{isMr ? 'पूर्ण विक्री इतिहास (Completed Sales)' : 'Completed Sales History'}</span>
            <span style={{
              fontSize: '0.75rem',
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-subtle)',
              padding: '2px 8px',
              borderRadius: '12px',
              color: 'var(--text-muted)',
            }}>
              {soldBatches.length}
            </span>
          </h2>

          <div className="glass-card" style={{ padding: '16px', borderRadius: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  <th style={{ padding: '10px 14px' }}>{isMr ? 'पीक व बाजार' : 'Crop & Market'}</th>
                  <th style={{ padding: '10px 14px' }}>{isMr ? 'वजन' : 'Quantity'}</th>
                  <th style={{ padding: '10px 14px' }}>{isMr ? 'काढणी दिनांक' : 'Harvest Date'}</th>
                  <th style={{ padding: '10px 14px' }}>{isMr ? 'स्थिती' : 'Status'}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>{isMr ? 'कृती' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {soldBatches.map((batch) => (
                  <tr key={batch._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-title)' }}>
                      {batch.commodity} • {batch.market}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-body)' }}>
                      {batch.quantityQuintals} qtl
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                      {batch.harvestDate ? new Date(batch.harvestDate).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--text-emerald)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}>
                        SOLD
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(batch._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Delete record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Recording Sale Outcome */}
      {selectedBatchForSale && (
        <RecordSaleModal
          isOpen={Boolean(selectedBatchForSale)}
          onClose={() => setSelectedBatchForSale(null)}
          batch={selectedBatchForSale}
          lang={lang}
          theme={theme}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
