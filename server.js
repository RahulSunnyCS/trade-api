const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const dotenv = require("dotenv");
const speakeasy = require("speakeasy");
const axios = require("axios");

dotenv.config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize body parser
app.use(bodyParser.json());

const DATA_FILE = "./data.json";

// Check if data.json exists, if not, create it based on environment variables
if (!fs.existsSync(DATA_FILE)) {
  const accountIds = process.env.ACCOUNT_IDS.split(",");
  const passwords = process.env.PASSWORDS.split(",");
  const authKeys = process.env.AUTH_KEYS.split(",");

  const accounts = accountIds.map((id, index) => ({
    id: id,
    password: passwords[index],
    secret: authKeys[index],
  }));

  const initialData = {
    ACCOUNT_DETAILS: accounts,
    quantiplyAuthToken: "", // Initial value for quantipleAuthToken
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  console.log("Generated data.json from .env");
}

// Function to read data from the file
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const writeData = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Get all accounts
app.get("/accounts", (req, res) => {
  const data = readData();
  console.log("Fetching all accounts");
  res.json(data.ACCOUNT_DETAILS);
});

// Add or update an account
app.post("/accounts", (req, res) => {
  const { id, password, secret } = req.body;
  if (!id || !password || !secret)
    return res
      .status(400)
      .json({ message: "id, password and secret are required" });

  const data = readData();
  const existing = data.ACCOUNT_DETAILS.find((acc) => acc.id === id);

  let message;
  if (existing) {
    existing.password = password;
    existing.secret = secret;
    message = "Account updated";
  } else {
    data.ACCOUNT_DETAILS.push({ id, password, secret });
    message = "Account created";
  }

  writeData(data);
  res.json({ message });
});

// Get auth token
app.get("/token", (req, res) => {
  const data = readData();
  res.json({ quantipleAuthToken: data.quantipleAuthToken });
});

// Update auth token
app.put("/token", (req, res) => {
  const { quantipleAuthToken } = req.body;
  if (typeof quantipleAuthToken !== "string")
    return res.status(400).json({ message: "Token must be a string" });

  const data = readData();
  data.quantipleAuthToken = quantipleAuthToken;

  writeData(data);
  res.json({ message: "Token updated" });
});

// Broker Login Route
app.post("/broker-login", async (req, res) => {
  const data = readData();
  const results = [];

  const authToken = data.quantiplyAuthToken;
  if (!authToken) {
    return res
      .status(400)
      .json({ message: "quantiplyAuthToken is missing in data.json" });
  }

  for (const account of data.ACCOUNT_DETAILS) {
    const { id, password, secret } = account;

    // Generate 2FA token using TOTP
    const factor2 = speakeasy.totp({
      secret,
      encoding: "base32", // most authenticator apps use base32 encoding
    });

    try {
      const quantiplyApiUrl =
        process.env.QUANTIPLY_API_URL || "https://api.quantiply.tech/";
      const response = await axios.post(
        `${quantiplyApiUrl}brokers/finvasia/login/${id}`,
        {
          password,
          factor2,
        },
        {
          headers: {
            accept: "application/json, text/plain, */*",
            authorization: `Bearer ${authToken}`,
            "cache-control": "no-cache",
            "content-type": "application/json;charset=UTF-8",
            origin: "https://app.quantiply.tech",
            referer: `https://app.quantiply.tech/broker-login/finvasia/FA${id}`,
            "user-agent": "Mozilla/5.0",
          },
        }
      );

      results.push({
        id,
        status: "success",
        response: response.data,
      });
    } catch (error) {
      results.push({
        id,
        status: "error",
        message: error.response?.data?.message || error.message,
      });
    }
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
