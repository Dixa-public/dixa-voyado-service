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

// Helper function to lookup contact by email or phone
async function lookupContactId(identifier, type = "email") {
  try {
    const queryParam = type === "phone" ? "mobilePhone" : "email";
    const encodedIdentifier = encodeURIComponent(identifier);
    const lookupUrl = `${process.env.VOYADO_API_BASE_URL}/contacts/id?${queryParam}=${encodedIdentifier}`;

    console.log(`🔍 Looking up contact with ${type}: ${identifier}`);

    const response = await axios.get(lookupUrl, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`📡 Response status: ${response.status}`);

    // Handle both response formats: string ID or object with id property
    let contactId = null;
    if (typeof response.data === "string" && response.data) {
      // Direct string response (what Voyado actually returns)
      contactId = response.data;
      console.log(`✅ Found contact ID (string): ${contactId}`);
    } else if (response.data && response.data.id) {
      // Object response with id property
      contactId = response.data.id;
      console.log(`✅ Found contact ID (object): ${contactId}`);
    } else {
      console.log(`❌ No contact found for ${type}: ${identifier}`);
      console.log(`❌ Response data structure:`, response.data);
      return null;
    }

    return contactId;
  } catch (error) {
    console.error(`❌ Error looking up contact: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
    }
    return null;
  }
}

// Helper function to get point account for a contact
async function getPointAccount(contactId) {
  try {
    const accountUrl = `${process.env.VOYADO_API_BASE_URL}/point-accounts?contactId=${contactId}`;

    console.log(`🔍 Getting point account for contact: ${contactId}`);

    const response = await axios.get(accountUrl, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`📡 Point account response status: ${response.status}`);
    console.log(
      `📡 Point account response data:`,
      JSON.stringify(response.data, null, 2)
    );

    if (
      response.data &&
      Array.isArray(response.data) &&
      response.data.length > 0
    ) {
      const account = response.data[0];
      console.log(`✅ Found point account: ${account.id}`);
      return account.id;
    } else {
      console.log(`❌ No point account found for contact: ${contactId}`);
      console.log(`❌ Response data structure:`, response.data);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error getting point account: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
    }
    return null;
  }
}

// Helper function to make Voyado API request
async function addPointsToVoyado(contactId, points, description) {
  try {
    const voyadoUrl = `${process.env.VOYADO_API_BASE_URL}/point-transactions`;
    const transactionId = uuidv4();
    const now = new Date().toISOString();

    // Debug: Verify UUID generation
    console.log(`   Generated UUID: ${uuidv4()}`);
    console.log(`   Full transaction ID: ${transactionId}`);

    const payload = {
      accountId: contactId, // Using contactId as accountId for simplicity
      transactionId: transactionId,
      transactionType: "Addition",
      amount: points,
      description: description,
      source: "Automation",
      transactionDate: now,
      validFrom: now,
      validTo: null,
    };

    console.log(
      `💰 Adding ${points} points to Voyado for contact ${contactId}`
    );
    console.log(`   Transaction ID: ${transactionId}`);
    console.log(`   Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(voyadoUrl, payload, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(
      `✅ Successfully added ${points} points to Voyado for contact ${contactId}`
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error adding points to Voyado: ${error.message}`);
    console.error(
      `❌ Response data:`,
      JSON.stringify(error.response.data, null, 2)
    );
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
    }
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

    console.log(
      `📊 CSAT Rating: ${score}/5 - "${comment}" from ${contactName} (${contactEmail})`
    );

    // Calculate points based on score
    const points = calculatePoints(score);
    console.log(`   Points to award: ${points}`);

    // First lookup the contact ID in Voyado, then get point account, then add points
    let foundContactId = null;
    lookupContactId(contactEmail, "email")
      .then((contactId) => {
        if (contactId) {
          foundContactId = contactId; // Store for later use
          console.log(`   ✅ Contact found, getting point account...`);
          return getPointAccount(contactId);
        } else {
          console.log(
            `   ⚠️  No Voyado contact found for email: ${contactEmail}`
          );
          return null;
        }
      })
      .then((accountId) => {
        if (accountId) {
          console.log(`   ✅ Point account found, adding points...`);
          return addPointsToVoyado(
            accountId,
            points,
            `CSAT feedback - Score: ${score}/5 - ${comment}`
          );
        } else {
          console.log(
            `   ❌ No point account found for contact: ${foundContactId}`
          );
          console.log(
            `   ⚠️  Points cannot be awarded without an existing point account`
          );
          return null;
        }
      })
      .then((result) => {
        if (result) {
          console.log(`   ✅ Points successfully added to Voyado`);
        } else {
          console.log(`   ⚠️  No points added - no point account available`);
        }
      })
      .catch((error) => {
        console.error(`   ❌ Failed to add points to Voyado: ${error.message}`);
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

// Test contact lookup endpoint
app.get("/test-lookup/:type/:identifier", async (req, res) => {
  try {
    const { type, identifier } = req.params;

    if (!["email", "phone"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'email' or 'phone'" });
    }

    console.log(`🧪 Testing contact lookup for ${type}: ${identifier}`);

    const contactId = await lookupContactId(identifier, type);

    if (contactId) {
      res.json({
        message: "Contact found",
        type: type,
        identifier: identifier,
        contactId: contactId,
      });
    } else {
      res.status(404).json({
        message: "Contact not found",
        type: type,
        identifier: identifier,
      });
    }
  } catch (error) {
    console.error("❌ Error in test lookup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test add points endpoint
app.post("/test-add-points", async (req, res) => {
  const { contactId, points, description } = req.body;

  if (!contactId || !points) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: contactId and points",
    });
  }

  console.log(
    `🧪 Testing add points: ${points} points to contact ${contactId}`
  );

  try {
    // First try to get the point account
    const accountId = await getPointAccount(contactId);

    if (accountId) {
      console.log(`   ✅ Using existing point account: ${accountId}`);
      const result = await addPointsToVoyado(
        accountId,
        points,
        description || "Test points"
      );
      res.json({
        success: true,
        message: `Successfully added ${points} points using point account ${accountId}`,
        result,
      });
    } else {
      console.log(`   ❌ No point account found for contact: ${contactId}`);
      res.status(400).json({
        success: false,
        error: `No point account found for contact: ${contactId}. Points cannot be added without an existing point account.`,
      });
      return;
    }
  } catch (error) {
    console.error(`   ❌ Failed to add points: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
const server = app.listen(PORT, "0.0.0.0", () => {
  const localAddress = `http://localhost:${PORT}`;
  const networkAddress = `http://0.0.0.0:${PORT}`;

  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local address: ${localAddress}`);
  console.log(`🌐 Network address: ${networkAddress}`);
  console.log(
    `📊 Dixa CSAT webhook endpoint: ${localAddress}/webhook/dixa/csat`
  );
  console.log(
    `💰 Voyado points webhook endpoint: ${localAddress}/webhook/voyado/points`
  );
  console.log(`🔍 Latest CSAT endpoint: ${localAddress}/latest-csat`);
  console.log(
    `🧪 Test lookup endpoint: ${localAddress}/test-lookup/:type/:identifier`
  );
  console.log(`🧪 Test add points endpoint: ${localAddress}/test-add-points`);
  console.log(`❤️  Health check: ${localAddress}/health`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

module.exports = app;
