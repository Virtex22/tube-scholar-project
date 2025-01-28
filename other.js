const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// YouTube API key and endpoint
const YOUTUBE_API_KEY = "AIzaSyAGzZuBwW9hsn-fduVQtPM5Hw3EFEML-80"; // Replace with your YouTube API key
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search";

// Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "23211A6727@bvrit", // Update with your MySQL password
  database: "hackthon", // Database name
});

// Connect to Database
db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
    return;
  }
  console.log("Connected to the database");
});

// ===================== Registration Functionality =====================
app.post("/api/register", (req, res) => {
  console.log("Registration endpoint hit");
  console.log("Request body:", req.body);

  const { full_name, email, password, age, interest } = req.body;

  // Validate Input Data
  if (!full_name || !email || !password || !age || !interest) {
    console.log("Missing fields in the request");
    return res.status(400).send("All fields are required.");
  }

  // Check if Email Already Exists
  db.query(
    "SELECT * FROM register_for_hackthon WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).send("Database error.");
      }

      if (results.length > 0) {
        console.log("Email already registered:", email);
        return res.status(400).send("Email is already registered.");
      }

      // Insert New User into the Database
      const query =
        "INSERT INTO register_for_hackthon (full_name, email, password, age, interest, register_time) VALUES (?, ?, ?, ?, ?, NOW())";
      db.query(
        query,
        [full_name, email, password, age, interest],
        (err,result) => {
          if (err) {
            console.error("Error inserting user into database:", err);
            return res.status(500).send("Database error.");
          }
	  console.log("Number of records inserted: " + result.affectedRows);
          console.log("User registered successfully:", email);
          res.status(201).send("Registration successful."+result.affectedRows);
        }
      );
    }
  );
});

// ===================== Login Functionality =====================
app.post("/api/login", (req, res) => {
  console.log("Login endpoint hit");
  console.log("Request body:", req.body);

  const { email, password } = req.body;

  // Validate Input Data
  if (!email || !password) {
    console.log("Missing email or password");
    return res.status(400).send("Email and password are required.");
  }

  // Check if Email and Password Match a Registered User
  db.query(
    "SELECT * FROM register_for_hackthon WHERE email = ? AND password = ?",
    [email, password],
    (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return res.status(500).send("Database error.");
      }

      if (results.length > 0) {
        console.log("Login successful for:", email);
        const user = results[0];
        res.json({
          message: "Login successful.",
          user: {
            full_name: user.full_name,
            email: user.email,
            age: user.age,
            interest: user.interest,
          },
        });
      } else {
        console.log("Invalid credentials for:", email);
        res.status(401).send("Invalid email or password.");
      }
    }
  );
});

// ===================== Video Search Functionality =====================
app.get("/api/videos", async (req, res) => {
  const { topic } = req.query;

  // Ensure topic is provided
  if (!topic) {
    return res.status(400).send("Topic is required.");
  }

  try {
    // YouTube API request
    const response = await axios.get(YOUTUBE_API_URL, {
      params: {
        part: "snippet",
        q: topic,
        type: "video",
        key: YOUTUBE_API_KEY,
        maxResults: 1, // Get the top video result
        order: "viewCount", // Ensure videos are sorted by view count (top-rated)
      },
    });

    if (response.data.items.length > 0) {
      const video = response.data.items[0]; // Fetch the first (top-rated) video
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      const videoDescription = video.snippet.description;

      // Check if the video already exists in the 'project' table
      db.query(
        "SELECT * FROM project WHERE videoId = ?",
        [videoId],
        (err, results) => {
          if (err) {
            console.error("Error checking video in database:", err);
            return res.status(500).send("Error checking video in the database.");
          }

          // If the video is not already in the database, insert it
          if (results.length === 0) {
            const insertQuery =
              "INSERT INTO project (name, description, videoId) VALUES (?, ?, ?)";
            db.query(
              insertQuery,
              [videoTitle, videoDescription, videoId],
              (err) => {
                if (err) {
                  console.error(
                    "Error inserting video into the database:",
                    err
                  );
                  return res
                    .status(500)
                    .send("Error saving video data.");
                }

                // Send the video data as a response
                res.json([
                  {
                    videoId,
                    name: videoTitle,
                    description: videoDescription,
                  },
                ]);
              }
            );
          } else {
            // Video already exists in the database, return the existing data
            res.json([
              {
                videoId: results[0].videoId,
                name: results[0].name,
                description: results[0].description,
              },
            ]);
          }
        }
      );
    } else {
      res.status(404).json({ error: "No videos found for the given topic." });
    }
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
    res.status(500).send("Error fetching videos from YouTube.");
  }
});

// Start the Server
app.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});
