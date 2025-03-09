const mqtt = require("mqtt");
const sqlite3 = require("sqlite3").verbose();
const express = require("express");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());

// Connect to SQLite database
const db = new sqlite3.Database("weather_data.db", (err) => {
    if (err) console.error("Error opening database", err.message);
    else {
        console.log("Connected to SQLite database.");
        db.run(`
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT,
                value TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});

// Connect to MQTT broker
const mqttClient = mqtt.connect("ws://157.173.101.159:9001");

mqttClient.on("connect", () => {
    console.log("Connected to MQTT via WebSockets");
    mqttClient.subscribe("/work_group_01/room_temp/temperature");
    mqttClient.subscribe("/work_group_01/room_temp/humidity");
});

// Save MQTT messages to database
mqttClient.on("message", (topic, message) => {
    const value = message.toString();
    console.log(`Received: ${topic} → ${value}`);

    db.run("INSERT INTO sensor_data (topic, value) VALUES (?, ?)", [topic, value], (err) => {
        if (err) console.error("Error inserting data:", err.message);
    });
});

// API to fetch the last 5 minutes of data
app.get("/data", (req, res) => {
    db.all(
        `SELECT * FROM sensor_data 
         WHERE timestamp >= datetime('now', '-5 minutes') 
         ORDER BY timestamp ASC`, 
        [], 
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

// Close database on exit
process.on("SIGINT", () => {
    console.log("Closing database connection...");
    db.close();
    process.exit();
});
