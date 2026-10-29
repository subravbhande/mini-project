import React, { useState, useEffect } from 'react';
import { Sprout } from 'lucide-react';

export default function AgriLoader({ lang = 'en', compact = false, customMessage = null }) {
  const isMr = lang === 'mr';

  const stages = isMr
    ? [
        { icon: '🌱', text: 'कोल्हापूर व सांगली APMC बाजारभाव तपासत आहे...' },
        { icon: '🌦️', text: 'स्थानिक तापमान, आर्द्रता व पाऊस अंदाज तपासत आहे...' },
        { icon: '📉', text: 'नैसर्गिक साठवणूक घट व वजन नुकसानीचे गणित...' },
        { icon: '⚖️', text: 'ब्रेक-इव्हन भाव व निव्वळ नफा तुलना तयार करत आहे...' },
      ]
    : [
        { icon: '🌱', text: 'Connecting to Kolhapur & Sangli APMC markets...' },
        { icon: '🌦️', text: 'Analyzing localized weather & temperature forecast...' },
        { icon: '📉', text: 'Modeling natural shelf-life decay & storage cost...' },
        { icon: '⚖️', text: 'Calculating break-even threshold & optimal sale timing...' },
      ];

  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (compact) return;
    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev + 1) % stages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [compact, stages.length]);

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
        <span style={{ fontSize: '0.85rem' }}>
          {customMessage || (isMr ? 'विश्लेषण सुरू आहे...' : 'Analyzing...')}
        </span>
      </div>
    );
  }

  return (
    <div
      className="glass-card"
      style={{
        padding: '36px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        minHeight: '260px',
        position: 'relative',
        overflow: 'hidden',
        border: '1.5px solid var(--border-highlight)',
        boxShadow: 'var(--shadow-glow)',
      }}
    >
      {/* Background organic glow */}
      <div
        style={{
          position: 'absolute',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(131, 170, 70, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Animated Sprout Illustration */}
      <div
        className="soil-pulsing"
        style={{
          width: '74px',
          height: '74px',
          borderRadius: '22px',
          background: 'var(--bg-subtle)',
          border: '1.5px solid var(--border-highlight)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div className="sprout-animated" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sprout size={38} color="var(--accent-green)" className="leaf-glowing" />
        </div>
      </div>

      {/* Progress Message */}
      <div style={{ maxWidth: '420px', zIndex: 1 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-pill)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '0.8rem',
            color: 'var(--text-emerald)',
            fontWeight: 700,
            marginBottom: '10px',
            transition: 'all 0.3s ease',
          }}
        >
          <span>{stages[currentStage].icon}</span>
          <span>{isMr ? 'कृत्रिम बुद्धिमत्ता विश्लेषण' : 'AI Decision Engine'}</span>
        </div>

        <h3
          key={currentStage}
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-title)',
            lineHeight: 1.4,
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeInScale 0.3s ease',
          }}
        >
          {customMessage || stages[currentStage].text}
        </h3>
      </div>

      {/* Progress Dots Indicator */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        {stages.map((_, idx) => (
          <span
            key={idx}
            style={{
              width: idx === currentStage ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: idx === currentStage ? 'var(--accent-green)' : 'var(--border-subtle)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
