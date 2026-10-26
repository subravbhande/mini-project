import React, { createContext, useContext, useState, useEffect } from "react";
import {
  fetchCurrentUserApi,
  loginApi,
  registerApi,
  sendOtpApi,
  verifyOtpApi,
  resetPinApi,
  updateProfileApi,
} from "../services/priceApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("agrisense_token") || null);
  const [loading, setLoading] = useState(true);

  // Initialize and validate token on application load
  useEffect(() => {
    async function initAuth() {
      const storedToken = localStorage.getItem("agrisense_token");
      if (storedToken) {
        try {
          const currentUser = await fetchCurrentUserApi();
          setUser(currentUser);
          setToken(storedToken);
        } catch (err) {
          console.warn("[Auth] Token expired or invalid, clearing session:", err.message);
          localStorage.removeItem("agrisense_token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (phone, pin) => {
    const data = await loginApi(phone, pin);
    if (data.token) {
      localStorage.setItem("agrisense_token", data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const register = async (payload) => {
    const data = await registerApi(payload);
    if (data.token) {
      localStorage.setItem("agrisense_token", data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem("agrisense_token");
    setToken(null);
    setUser(null);
  };

  const sendOtp = async (phone, purpose = "register") => {
    return await sendOtpApi(phone, purpose);
  };

  const verifyOtp = async (phone, otp, purpose = "register") => {
    return await verifyOtpApi(phone, otp, purpose);
  };

  const resetPin = async (payload) => {
    const data = await resetPinApi(payload);
    if (data.token) {
      localStorage.setItem("agrisense_token", data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const updateProfile = async (payload) => {
    const updatedUser = await updateProfileApi(payload);
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        loading,
        login,
        register,
        logout,
        sendOtp,
        verifyOtp,
        resetPin,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
