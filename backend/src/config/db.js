const mongoose = require('mongoose');
const dns = require('dns');

// Standard direct replica set URI (does not require SRV DNS lookup, resilient on Windows & Linux cloud containers)
const DIRECT_ATLAS_URI =
  'mongodb://ajitmangsulikar123_db_user:aJ6OgI4OdwJHeRfT@ac-zr6ygit-shard-00-00.vwdme57.mongodb.net:27017,ac-zr6ygit-shard-00-01.vwdme57.mongodb.net:27017,ac-zr6ygit-shard-00-02.vwdme57.mongodb.net:27017/agrisense?ssl=true&replicaSet=atlas-6gz43z-shard-0&authSource=admin&retryWrites=true&w=majority';

let isConnecting = false;

const tryConnect = async (uri) => {
  return await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnecting) {
    // Wait briefly if connection attempt is already in flight
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (mongoose.connection.readyState === 1) return mongoose.connection;
    }
  }

  isConnecting = true;
  try {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (e) {
      // Ignore if host restricts custom DNS
    }

    const primaryUri = process.env.MONGO_URI?.trim();

    // 1. Try primary URI if provided
    if (primaryUri) {
      try {
        const conn = await tryConnect(primaryUri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        isConnecting = false;
        return conn;
      } catch (err) {
        console.warn(`[MongoDB] Primary URI connection failed (${err.message}). Retrying with direct replica set URI...`);
      }
    }

    // 2. Try direct fallback URI
    const fallbackConn = await tryConnect(DIRECT_ATLAS_URI);
    console.log(`MongoDB Connected (Fallback Replica Set): ${fallbackConn.connection.host}`);
    isConnecting = false;
    return fallbackConn;
  } catch (error) {
    console.error(`MongoDB Connection Fatal Error: ${error.message}`);
    isConnecting = false;
  }
};

// Auto-reconnect listeners
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Connection lost. Scheduling auto-reconnect...');
  setTimeout(() => connectDB(), 3000);
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection event error:', err.message);
});

module.exports = connectDB;
