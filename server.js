const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const DATA_FILE = "./data.json";

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
    return res.status(400).json({ message: "id and password are required" });

  const data = readData();
  const existing = data.ACCOUNT_DETAILS.find((acc) => acc.id === id);

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

// Login
app.post("/login", (req, res) => {
  const { id, password } = req.body;
  const data = readData();

  const account = data.ACCOUNT_DETAILS.find(
    (acc) => acc.id === id && acc.password === password
  );
  if (!account) return res.status(401).json({ message: "Invalid credentials" });

  res.json({ message: "Login successful" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
