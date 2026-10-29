const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ML_ROOT = path.join(__dirname, "../../../ml_service");
const venvWin = path.join(ML_ROOT, "venv", "Scripts", "python.exe");
const venvUnix = path.join(ML_ROOT, "venv", "bin", "python");
const defaultPython = fs.existsSync(venvWin) ? venvWin : (fs.existsSync(venvUnix) ? venvUnix : "python");
const PYTHON = process.env.PYTHON_PATH || defaultPython;
const SCRIPT = path.join(ML_ROOT, "predict_api.py");

/**
 * Executes the Python ML bridge script passing JSON over stdin.
 * @param {Object} params
 * @returns {Promise<Object>}
 */
function runPythonModel(params) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(PYTHON, [SCRIPT], { cwd: ML_ROOT });
    } catch (spawnErr) {
      return reject(spawnErr);
    }

    const timer = setTimeout(() => {
      try { proc.kill(); } catch (e) {}
      reject(new Error("Python ML model timed out after 45s"));
    }, 45000);

    let stdout = "";
    let stderr = "";

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      clearTimeout(timer);
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

/**
 * Call the AgriSense XGBoost price model.
 */
function getPriceForecast(params) {
  return runPythonModel({ ...params, mode: "forecast" });
}

/**
 * Call the AgriSense timing decision optimizer (Price + Shelf-life decay + Storage cost + Liquidity).
 */
function getTimingDecision(params) {
  return runPythonModel({ ...params, mode: "decide" });
}

module.exports = { getPriceForecast, getTimingDecision };
