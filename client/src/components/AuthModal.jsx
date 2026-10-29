import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, UserCheck, AlertTriangle, CheckCircle2, Smartphone, Lock, User, MapPin, KeyRound } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, lang = 'mr', theme = 'dark', initialMode = 'login', onSuccess }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';
  const { login, register, sendOtp, resetPin } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(1);

  // Form fields
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Kolhapur');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login');
      setStep(1);
      setError('');
      setSuccessMsg('');
      setOtp('');
      setDevOtp('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const resetFormState = (newMode = 'login') => {
    setMode(newMode);
    setStep(1);
    setError('');
    setSuccessMsg('');
    setOtp('');
    setDevOtp('');
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanPhone = phone.trim();
    if (!/^\d{10}$/.test(cleanPhone)) {
      setError(isMr ? 'कृपया वैध १० अंकी मोबाईल नंबर टाका.' : 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError(isMr ? 'कृपया आपले नाव टाका.' : 'Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(cleanPhone, mode === 'forgot' ? 'reset' : 'register');
      setStep(2);
      setSuccessMsg(isMr ? 'पडताळणी कोड (OTP) खाली तयार झाला आहे.' : 'Verification OTP generated below.');
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!otp || otp.trim().length !== 6) {
      setError(isMr ? 'कृपया ६ अंकी OTP टाका.' : 'Please enter the 6-digit OTP.');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError(isMr ? 'पिन ४ ते ६ अंकी असावा.' : 'PIN must be 4 to 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError(isMr ? 'दोन्ही पिन जुळत नाहीत.' : 'PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      await register({
        phone: phone.trim(),
        name: name.trim() || 'Farmer',
        pin: pin.trim(),
        district,
        otp: otp.trim(),
        preferredLanguage: lang,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('[Register Error]', err);
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!otp || otp.trim().length !== 6) {
      setError(isMr ? 'कृपया ६ अंकी OTP टाका.' : 'Please enter the 6-digit OTP.');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError(isMr ? 'नवीन पिन ४ ते ६ अंकी असावा.' : 'New PIN must be 4 to 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError(isMr ? 'दोन्ही पिन जुळत नाहीत.' : 'PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPin({
        phone: phone.trim(),
        newPin: pin.trim(),
        otp: otp.trim(),
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('[Reset PIN Error]', err);
      setError(err.response?.data?.message || err.message || 'Failed to reset PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    const cleanPhone = phone.trim();
    if (!/^\d{10}$/.test(cleanPhone)) {
      setError(isMr ? 'कृपया १० अंकी मोबाईल नंबर टाका.' : 'Please enter 10-digit mobile number.');
      return;
    }

    if (!pin) {
      setError(isMr ? 'कृपया आपला पिन टाका.' : 'Please enter your PIN.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanPhone, pin.trim());
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

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

        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 8px',
            background: 'var(--bg-pill)',
            border: '1px solid var(--border-highlight)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <UserCheck size={26} color="var(--accent-green)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '3px' }}>
            {mode === 'login'
              ? (isMr ? 'शेतकरी लॉगिन' : 'Farmer Sign In')
              : mode === 'register'
                ? (isMr ? 'नवीन खाते नोंदणी' : 'Create Account')
                : (isMr ? 'पिन विसरलात का?' : 'Reset PIN')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {mode === 'login'
              ? (isMr ? 'इतिहास व नफा पाहण्यासाठी लॉगिन करा' : 'Sign in to access your harvest records')
              : mode === 'register'
                ? (isMr ? 'मोबाईल नंबर आणि OTP द्वारे खाते तयार करा' : 'Quick signup with mobile OTP')
                : (isMr ? 'OTP द्वारे नवीन पिन सेट करा' : 'Verify OTP to reset PIN')}
          </p>
        </div>

        {/* Error / Success Alerts */}
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
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
            {(error.includes('आधीच') || error.toLowerCase().includes('already exists')) && mode !== 'login' && (
              <button
                type="button"
                onClick={() => resetFormState('login')}
                style={{
                  alignSelf: 'flex-start',
                  background: 'var(--accent-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '2px',
                }}
              >
                {isMr ? 'येथे क्लिक करून लॉगिन करा' : 'Click here to Sign In'}
              </button>
            )}
            {(error.includes('नोंदणीकृत नाही') || error.toLowerCase().includes('not found') || error.toLowerCase().includes('register')) && mode === 'login' && (
              <button
                type="button"
                onClick={() => resetFormState('register')}
                style={{
                  alignSelf: 'flex-start',
                  background: 'var(--accent-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '2px',
                }}
              >
                {isMr ? 'येथे क्लिक करून नवीन खाते तयार करा' : 'Click here to Register'}
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(131, 170, 70, 0.15)',
            border: '1px solid var(--border-highlight)',
            color: 'var(--text-emerald)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.8rem',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Instant Verification OTP Card */}
        {devOtp && (
          <div style={{
            background: 'var(--bg-pill)',
            border: '1px solid var(--border-highlight)',
            borderRadius: '12px',
            padding: '10px 14px',
            fontSize: '0.82rem',
            color: 'var(--text-emerald)',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
                {isMr ? 'पडताळणी कोड (OTP):' : 'Verification OTP:'}
              </span>
              <strong style={{ fontSize: '1.25rem', letterSpacing: '0.15em', color: 'var(--text-emerald)' }}>
                {devOtp}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setOtp(devOtp)}
              className="btn-primary"
              style={{
                padding: '6px 12px',
                fontSize: '0.76rem',
                borderRadius: '8px',
              }}
            >
              {isMr ? 'स्वयं-भरा' : 'Auto-fill'}
            </button>
          </div>
        )}

        {/* MODE 1: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                <Smartphone size={14} color="var(--text-emerald)" />
                <span>{isMr ? 'मोबाईल नंबर' : 'Mobile Number'}</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                placeholder="उदा. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                required
                className="input-base"
                style={{ fontSize: '1.05rem', fontWeight: 600 }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  <Lock size={14} color="var(--text-emerald)" />
                  <span>{isMr ? 'सुरक्षा पिन' : 'Security PIN'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => resetFormState('forgot')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-blue)',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {isMr ? 'पिन विसरलात?' : 'Forgot PIN?'}
                </button>
              </div>
              <input
                type="password"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
                className="input-base"
                style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '4px' }}
            >
              {loading ? <span className="loading-spinner" /> : <span>{isMr ? 'लॉगिन करा' : 'Sign In'}</span>}
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isMr ? 'खाते नाही का?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => resetFormState('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-emerald)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isMr ? 'नवीन खाते उघडा' : 'Register now'}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: REGISTER */}
        {mode === 'register' && (
          <div>
            {step === 1 ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <User size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'शेतकऱ्याचे नाव' : 'Full Name'}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={isMr ? 'उदा. संतोष पाटील' : 'e.g. Ramesh Patil'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="input-base"
                    style={{ fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Smartphone size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'मोबाईल नंबर' : 'Mobile Number'}</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.05rem', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <MapPin size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'जिल्हा' : 'District'}</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="input-base"
                    style={{ fontSize: '0.92rem' }}
                  >
                    <option value="Kolhapur">कोल्हापूर (Kolhapur)</option>
                    <option value="Sangli">सांगली (Sangli)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '4px' }}
                >
                  {loading ? <span className="loading-spinner" /> : <span>{isMr ? 'OTP पाठवा' : 'Send Verification OTP'}</span>}
                </button>

                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'आधीच खाते आहे का?' : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => resetFormState('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-emerald)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isMr ? 'लॉगिन करा' : 'Login here'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Smartphone size={14} color="var(--text-emerald)" />
                    {phone}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem' }}
                  >
                    {isMr ? 'नंबर बदला' : 'Change Number'}
                  </button>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <KeyRound size={14} color="var(--text-emerald)" />
                    <span>{isMr ? '६ अंकी OTP' : '6-Digit OTP'}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.2rem', letterSpacing: '0.25em', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Lock size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'नवीन ४-६ अंकी पिन' : 'Set 4-to-6 Digit PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Lock size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'पिन पुन्हा टाका' : 'Confirm PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '4px' }}
                >
                  {loading ? <span className="loading-spinner" /> : <span>{isMr ? 'खाते तयार करा' : 'Verify & Create Account'}</span>}
                </button>
              </form>
            )}
          </div>
        )}

        {/* MODE 3: FORGOT PIN */}
        {mode === 'forgot' && (
          <div>
            {step === 1 ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Smartphone size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'नोंदणीकृत मोबाईल नंबर' : 'Mobile Number'}</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.05rem', fontWeight: 600 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '4px' }}
                >
                  {loading ? <span className="loading-spinner" /> : <span>{isMr ? 'OTP पाठवा' : 'Send Reset OTP'}</span>}
                </button>

                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.8rem' }}>
                  <button
                    type="button"
                    onClick={() => resetFormState('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isMr ? 'लॉगिनकडे परत जा' : 'Back to Login'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <KeyRound size={14} color="var(--text-emerald)" />
                    <span>{isMr ? '६ अंकी OTP' : 'Enter 6-Digit OTP'}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.2rem', letterSpacing: '0.25em', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Lock size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'नवीन ४-६ अंकी पिन' : 'New 4-to-6 Digit PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <Lock size={14} color="var(--text-emerald)" />
                    <span>{isMr ? 'नवीन पिन पुन्हा टाका' : 'Confirm New PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    required
                    className="input-base"
                    style={{ fontSize: '1.1rem', letterSpacing: '0.2em' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', marginTop: '4px' }}
                >
                  {loading ? <span className="loading-spinner" /> : <span>{isMr ? 'नवीन पिन जतन करा' : 'Save New PIN'}</span>}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
