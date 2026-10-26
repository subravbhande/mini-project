import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, UserCheck, AlertTriangle, CheckCircle2, Smartphone, Lock, User, MapPin, KeyRound } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, lang = 'mr', theme = 'dark', initialMode = 'login', onSuccess }) {
  const isMr = lang === 'mr';
  const isDark = theme === 'dark';
  const { login, register, sendOtp, resetPin } = useAuth();

  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [step, setStep] = useState(1); // 1: phone input, 2: OTP + PIN

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

  // Step 1: Send OTP for register or forgot PIN
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
      setSuccessMsg(isMr ? 'पडताळणी कोड (OTP) खालीलप्रमाणे तयार झाला आहे.' : 'Verification OTP generated below.');
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle Registration with OTP + PIN
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

  // Step 2: Handle Forgot PIN Reset
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

  // Handle Standard Login
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
          maxWidth: '440px',
          padding: '30px',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          position: 'relative',
          border: `1.5px solid ${isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(16, 185, 129, 0.4)'}`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Close"
      >
        <X size={18} />
      </button>

      {/* Header Icon & Title */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{
          width: '54px',
          height: '54px',
          margin: '0 auto 10px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <UserCheck size={28} color="var(--text-emerald)" />
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '4px' }}>
          {mode === 'login'
            ? (isMr ? 'शेतकरी लॉगिन (Farmer Login)' : 'Farmer Login')
            : mode === 'register'
              ? (isMr ? 'नवीन खाते नोंदणी (Register)' : 'Create Farmer Account')
              : (isMr ? 'पिन विसरलात का? (Reset PIN)' : 'Reset PIN')}
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {mode === 'login'
            ? (isMr ? 'आपला शेतमाल इतिहास पाहण्यासाठी लॉगिन करा' : 'Login to access your harvest history & insights')
            : mode === 'register'
              ? (isMr ? 'मोबाईल नंबर आणि OTP द्वारे खाते तयार करा' : 'Fast setup with Mobile OTP and quick PIN')
              : (isMr ? 'OTP द्वारे नवीन पिन सेट करा' : 'Verify OTP to create a new secure PIN')}
        </p>
      </div>

      {/* Error / Success Alerts */}
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

      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: 'var(--text-emerald)',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          marginBottom: '16px',
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
          background: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.4)'}`,
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '0.82rem',
          color: 'var(--text-emerald)',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              {isMr ? 'आपला पडताळणी कोड (OTP):' : 'Your Verification OTP:'}
            </span>
            <strong style={{ fontSize: '1.25rem', letterSpacing: '0.15em', color: 'var(--text-emerald)' }}>
              {devOtp}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setOtp(devOtp)}
            style={{
              background: 'var(--emerald-gradient)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isMr ? 'स्वयं-भरा' : 'Auto-fill'}
          </button>
        </div>
      )}

      {/* ----------------- MODE 1: LOGIN ----------------- */}
      {mode === 'login' && (
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              <Smartphone size={14} />
              <span>{isMr ? 'मोबाईल नंबर (10-Digit Mobile)' : 'Mobile Number'}</span>
            </label>
            <input
              type="tel"
              maxLength={10}
              placeholder="उदा. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-title)',
                fontSize: '0.95rem',
                letterSpacing: '0.04em',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Lock size={14} />
                <span>{isMr ? '४-६ अंकी पिन (Security PIN)' : 'Security PIN'}</span>
              </label>
                <button
                  type="button"
                  onClick={() => resetFormState('forgot')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-blue)',
                    fontSize: '0.75rem',
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
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-title)',
                  fontSize: '1rem',
                  letterSpacing: '0.2em',
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (isMr ? 'तपासत आहे...' : 'Logging in...') : (isMr ? 'लॉगिन करा (Login)' : 'Sign In')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {isMr ? 'खाते नाही का?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => resetFormState('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-emerald)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isMr ? 'नवीन खाते नोंदवा' : 'Register now'}
              </button>
            </div>
          </form>
        )}

        {/* ----------------- MODE 2: REGISTER ----------------- */}
        {mode === 'register' && (
          <div>
            {step === 1 ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <User size={14} />
                    <span>{isMr ? 'शेतकऱ्याचे नाव (Farmer Name)' : 'Full Name'}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={isMr ? 'उदा. संतोष पाटील' : 'e.g. Ramesh Patil'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
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

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Smartphone size={14} />
                    <span>{isMr ? 'मोबाईल नंबर (10-Digit Mobile)' : 'Mobile Number'}</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '0.95rem',
                      letterSpacing: '0.04em',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <MapPin size={14} />
                    <span>{isMr ? 'जिल्हा (District)' : 'District'}</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '0.92rem',
                    }}
                  >
                    <option value="Kolhapur">कोल्हापूर (Kolhapur)</option>
                    <option value="Sangli">सांगली (Sangli)</option>
                  </select>
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
                  {loading ? (isMr ? 'OTP पाठवत आहे...' : 'Sending OTP...') : (isMr ? 'OTP पाठवा (Send OTP)' : 'Send Verification OTP')}
                </button>

                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {isMr ? 'आधीच खाते आहे का?' : 'Already have an account?'}{' '}
                  <button
                    type="button"
                    onClick={() => resetFormState('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-emerald)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isMr ? 'लॉगिन करा' : 'Login here'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Smartphone size={14} />
                    {phone}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isMr ? 'नंबर बदला' : 'Change Number'}
                  </button>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <KeyRound size={14} />
                    <span>{isMr ? '६ अंकी OTP टाका (Enter 6-Digit OTP)' : 'Enter 6-Digit OTP'}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1.2rem',
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Lock size={14} />
                    <span>{isMr ? 'नवीन ४-६ अंकी पिन तयार करा (Set Security PIN)' : 'Create 4-to-6 Digit PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1rem',
                      letterSpacing: '0.2em',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Lock size={14} />
                    <span>{isMr ? 'पिन पुन्हा टाका (Confirm PIN)' : 'Confirm PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1rem',
                      letterSpacing: '0.2em',
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
                  {loading ? (isMr ? 'नोंदणी करत आहे...' : 'Creating Account...') : (isMr ? 'खाते तयार करा (Complete Signup)' : 'Verify & Create Account')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ----------------- MODE 3: FORGOT PIN ----------------- */}
        {mode === 'forgot' && (
          <div>
            {step === 1 ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Smartphone size={14} />
                    <span>{isMr ? 'आपला नोंदणीकृत मोबाईल नंबर' : 'Registered Mobile Number'}</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '0.95rem',
                      letterSpacing: '0.04em',
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
                  {loading ? (isMr ? 'OTP पाठवत आहे...' : 'Sending OTP...') : (isMr ? 'OTP पाठवा (Send OTP)' : 'Send Reset OTP')}
                </button>

                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.82rem' }}>
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
              <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <KeyRound size={14} />
                    <span>{isMr ? '६ अंकी OTP टाका' : 'Enter 6-Digit OTP'}</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1.2rem',
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Lock size={14} />
                    <span>{isMr ? 'नवीन ४-६ अंकी पिन' : 'New 4-to-6 Digit PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1rem',
                      letterSpacing: '0.2em',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Lock size={14} />
                    <span>{isMr ? 'नवीन पिन पुन्हा टाका' : 'Confirm New PIN'}</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-title)',
                      fontSize: '1rem',
                      letterSpacing: '0.2em',
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
                  {loading ? (isMr ? 'बदलत आहे...' : 'Resetting...') : (isMr ? 'नवीन पिन जतन करा (Save PIN)' : 'Save New PIN & Login')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
