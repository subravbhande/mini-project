const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ML_ROOT = path.join(__dirname, "../../../ml_service");
const venvWin = path.join(ML_ROOT, "venv", "Scripts", "python.exe");
const venvUnix = path.join(ML_ROOT, "venv", "bin", "python");
const defaultPython = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvUnix) ? venvUnix : "python");
const PYTHON  = process.env.PYTHON_PATH || defaultPython;
const SCRIPT  = path.join(ML_ROOT, "predict_api.py");

/**
 * Call the AgriSense XGBoost price model.
 * @param {Object} params
 * @param {string} params.commodity            - "Tomato" | "Onion"
 * @param {string} params.market               - e.g. "Kolhapur", "Sangli"
 * @param {string} params.district             - "Kolhapur" | "Sangli"
 * @param {number} [params.quantity_quintals]  - farmer's harvest qty
 * @param {string} [params.start_date]         - ISO date (default: tomorrow)
 * @param {number} [params.horizon_days]       - 1-14 (default: 7)
 * @param {Array}  [params.weather_forecast]   - optional daily weather array
 * @returns {Promise<Object>} PriceForecast + farmer_summary
 */
function getPriceForecast(params) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT], { cwd: ML_ROOT });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ML process failed (code ${code}): ${stderr}`));
      }
      try {
        const jsonStart = stdout.indexOf("{");
        const jsonEnd = stdout.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
          resolve(JSON.parse(jsonStr));
        } else {
          resolve(JSON.parse(stdout));
        }
      } catch (e) {
        reject(new Error(`Failed to parse ML output. stdout: ${stdout}, error: ${e.message}`));
      }
    });

    proc.stdin.write(JSON.stringify(params));
    proc.stdin.end();
  });
}

module.exports = { getPriceForecast };
