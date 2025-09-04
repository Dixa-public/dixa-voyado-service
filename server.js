const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Store the latest CSAT rating event (overwrites previous)
let latestCsatEvent = null;

// Middleware
app.use(express.json());

// Helper function to calculate points based on CSAT score
function calculatePoints(score) {
  if (score <= 2) {
    return 10; // Higher points for low scores (compensation)
  } else if (score >= 4) {
    return 15; // Higher points for high scores (reward)
  } else {
    return 5; // Default points for neutral scores
  }
}

// Helper function to make Voyado API request
async function addPointsToVoyado(contactId, points, description) {
  try {
    const voyadoUrl = `${process.env.VOYADO_API_BASE_URL}/point-transactions`;
    const transactionId = `dixa-automation-${uuidv4()}`;
    const now = new Date().toISOString();

    const payload = {
      accountId: contactId, // Using contactId as accountId for simplicity
      transactionId: transactionId,
      transactionType: "Addition",
      amount: points,
      description: description,
      source: "Automation",
      transactionDate: now,
      validFrom: now,
      validTo: now,
    };

    const response = await axios.post(voyadoUrl, payload, {
      headers: {
        Authorization: `Bearer ${process.env.VOYADO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log(
      `✅ Successfully added ${points} points to Voyado for contact ${contactId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `❌ Error adding points to Voyado:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

// Dixa CSAT Rating Webhook Endpoint
app.post("/webhook/dixa/csat", (req, res) => {
  try {
    const event = req.body;

    // Validate the webhook event
    if (!event.event_fqn || event.event_fqn !== "CONVERSATION_RATED") {
      return res.status(400).json({ error: "Invalid event type" });
    }

    // Store the latest event (overwrites previous)
    latestCsatEvent = event;

    const score = event.data.score;
    const comment = event.data.comment;
    const contactEmail = event.data.conversation.requester.email;
    const contactName = event.data.conversation.requester.name;

    console.log("📊 CSAT Rating Received:");
    console.log(`   Score: ${score}/5`);
    console.log(`   Comment: "${comment}"`);
    console.log(`   Contact: ${contactName} (${contactEmail})`);
    console.log(`   Event ID: ${event.event_id}`);

    // Calculate points based on score
    const points = calculatePoints(score);
    console.log(`   Points to award: ${points}`);

    // Add points to Voyado (using email as contact identifier)
    // Note: In a real implementation, you'd need to map the email to a Voyado contact ID
    addPointsToVoyado(
      contactEmail,
      points,
      `CSAT feedback - Score: ${score}/5 - ${comment}`
    )
      .then(() => {
        console.log(`   ✅ Points successfully added to Voyado`);
      })
      .catch((error) => {
        console.error(`   ❌ Failed to add points to Voyado:`, error.message);
      });

    res.status(200).json({
      message: "CSAT webhook processed successfully",
      score: score,
      pointsAwarded: points,
      contactEmail: contactEmail,
    });
  } catch (error) {
    console.error("❌ Error processing Dixa CSAT webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Voyado Point Balance Webhook Endpoint
app.post("/webhook/voyado/points", (req, res) => {
  try {
    const event = req.body;

    // Validate the webhook event
    if (!event.eventType || event.eventType !== "point.balance.updated") {
      return res.status(400).json({ error: "Invalid event type" });
    }

    const payload = event.payload;

    console.log("💰 Voyado Points Balance Updated:");
    console.log(`   Account ID: ${payload.accountId}`);
    console.log(`   Contact ID: ${payload.contactId}`);
    console.log(`   New Balance: ${payload.balance}`);
    console.log(`   Balance Expires: ${payload.balanceExpires}`);
    console.log(`   Definition ID: ${payload.definitionId}`);
    console.log(`   Event ID: ${event.eventId}`);

    res.status(200).json({
      message: "Voyado points webhook processed successfully",
      accountId: payload.accountId,
      balance: payload.balance,
    });
  } catch (error) {
    console.error("❌ Error processing Voyado points webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get latest CSAT event
app.get("/latest-csat", (req, res) => {
  if (!latestCsatEvent) {
    return res.status(404).json({ message: "No CSAT events received yet" });
  }

  res.json({
    message: "Latest CSAT event",
    event: latestCsatEvent,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Dixa-Voyado Webhook Service",
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  const localAddress = `http://localhost:${PORT}`;
  const networkAddress = `http://0.0.0.0:${PORT}`;
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local address: ${localAddress}`);
  console.log(`🌐 Network address: ${networkAddress}`);
  console.log(`📊 Dixa CSAT webhook endpoint: ${localAddress}/webhook/dixa/csat`);
  console.log(`💰 Voyado points webhook endpoint: ${localAddress}/webhook/voyado/points`);
  console.log(`🔍 Latest CSAT endpoint: ${localAddress}/latest-csat`);
  console.log(`❤️  Health check: ${localAddress}/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
