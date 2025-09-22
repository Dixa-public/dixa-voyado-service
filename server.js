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

// Helper function to store CSAT interaction data in Voyado
async function storeCSATInteraction(
  contactId,
  csatScore,
  conversationId,
  supportChannel
) {
  try {
    const interactionUrl = `${process.env.VOYADO_API_BASE_URL}/interactions`;

    const payload = {
      contactId: contactId,
      schemaId: "DixaCSATScore",
      createdDate: new Date().toISOString(),
      payload: {
        csatScore: csatScore,
        conversationId: conversationId,
        supportChannel: supportChannel,
      },
    };

    console.log(`📊 Storing CSAT interaction for contact ${contactId}`);
    console.log(`   CSAT Score: ${csatScore}`);
    console.log(`   Conversation ID: ${conversationId}`);
    console.log(`   Support Channel: ${supportChannel}`);
    console.log(`   Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(interactionUrl, payload, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(
      `✅ Successfully stored CSAT interaction for contact ${contactId}`
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error storing CSAT interaction: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    throw error;
  }
}

// Helper function to fetch Voyado interactions for a contact by schema
async function fetchVoyadoInteractionsBySchema(
  contactId,
  schemaId = "completedProductRating"
) {
  try {
    const interactionsUrl = `${process.env.VOYADO_API_BASE_URL}/interactions?contactId=${contactId}&schemaId=${schemaId}`;

    console.log(
      `🔍 Fetching interactions for contact ${contactId} with schema ${schemaId}`
    );

    const response = await axios.get(interactionsUrl, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`📡 Interactions response status: ${response.status}`);
    console.log(`📡 Interactions:`, JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching interactions: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    return null;
  }
}

// Helper function to fetch specific Voyado interaction details
async function fetchVoyadoInteractionDetails(interactionId) {
  try {
    const interactionUrl = `${process.env.VOYADO_API_BASE_URL}/interactions/${interactionId}`;

    console.log(
      `🔍 Fetching specific interaction details for ${interactionId}`
    );

    const response = await axios.get(interactionUrl, {
      headers: {
        apikey: process.env.VOYADO_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`📡 Interaction details response status: ${response.status}`);
    console.log(
      `📡 Interaction details:`,
      JSON.stringify(response.data, null, 2)
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching interaction details: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    return null;
  }
}

// Helper function to lookup end user in Dixa
async function lookupDixaEndUser(contactData, config) {
  try {
    const dixaUrl = "https://dev.dixa.io/v1/endusers";

    // Build query parameters based on available contact data
    const queryParams = new URLSearchParams();

    if (contactData.email) {
      queryParams.append("email", contactData.email);
    }

    if (contactData.phone) {
      queryParams.append("phoneNumber", contactData.phone);
    }

    if (contactData.contactId) {
      queryParams.append("externalId", contactData.contactId);
    }

    const lookupUrl = `${dixaUrl}?${queryParams.toString()}`;

    console.log(
      `🔍 Looking up Dixa end user with query: ${queryParams.toString()}`
    );

    const response = await axios.get(lookupUrl, {
      headers: {
        Authorization: config.apiToken,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`📡 Dixa end user lookup response status: ${response.status}`);
    console.log(
      `📡 Dixa end user lookup response:`,
      JSON.stringify(response.data, null, 2)
    );

    // Check if we found any end users
    if (response.data && response.data.data && response.data.data.length > 0) {
      const endUser = response.data.data[0];
      console.log(`✅ Found existing Dixa end user: ${endUser.id}`);
      return endUser;
    } else {
      console.log(`❌ No existing Dixa end user found`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error looking up Dixa end user: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    return null;
  }
}

// Helper function to create end user in Dixa
async function createDixaEndUser(contactData, config) {
  try {
    const dixaUrl = "https://dev.dixa.io/v1/endusers";

    // Prepare end user payload
    const endUserPayload = {
      displayName:
        contactData.displayName ||
        contactData.email ||
        contactData.phone ||
        "Voyado Customer",
      email: contactData.email,
      phoneNumber: contactData.phone,
      externalId: contactData.contactId,
    };

    // Remove undefined/null values
    Object.keys(endUserPayload).forEach((key) => {
      if (endUserPayload[key] === undefined || endUserPayload[key] === null) {
        delete endUserPayload[key];
      }
    });

    console.log(`👤 Creating Dixa end user`);
    console.log(`👤 Payload:`, JSON.stringify(endUserPayload, null, 2));

    const response = await axios.post(dixaUrl, endUserPayload, {
      headers: {
        Authorization: config.apiToken,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`✅ Successfully created Dixa end user`);
    console.log(`👤 Response:`, JSON.stringify(response.data, null, 2));

    return response.data.data;
  } catch (error) {
    console.error(`❌ Error creating Dixa end user: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    throw error;
  }
}

// Helper function to get or create Dixa end user
async function getOrCreateDixaEndUser(contactData, config) {
  try {
    // First, try to lookup existing end user
    console.log(`🔍 Looking up existing Dixa end user...`);
    let endUser = await lookupDixaEndUser(contactData, config);

    if (endUser) {
      return endUser;
    }

    // If no end user found, create a new one
    console.log(`👤 No existing end user found, creating new one...`);
    endUser = await createDixaEndUser(contactData, config);

    return endUser;
  } catch (error) {
    console.error(
      `❌ Error getting or creating Dixa end user: ${error.message}`
    );
    throw error;
  }
}

// Helper function to create Dixa conversation
async function createDixaConversation(endUser, interactionData, config) {
  try {
    const dixaUrl = "https://dev.dixa.io/v1/conversations";

    // Prepare the conversation payload
    const conversationPayload = {
      requesterId: endUser.id,
      emailIntegrationId: config.emailIntegrationId || "",
      subject: `Review from Voyado`,
      message: {
        content: {
          value: "Review submitted via Voyado",
          _type: "Html",
        },
        attachments: [],
        _type: "Inbound",
      },
      _type: "Email",
    };

    console.log(`📧 Creating Dixa conversation for end user: ${endUser.id}`);
    console.log(`📧 Payload:`, JSON.stringify(conversationPayload, null, 2));

    const response = await axios.post(dixaUrl, conversationPayload, {
      headers: {
        Authorization: config.apiToken,
        "Content-Type": "application/json",
        "User-Agent": "DixaVoyadoService/1.0",
      },
    });

    console.log(`✅ Successfully created Dixa conversation`);
    console.log(`📧 Response:`, JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error(`❌ Error creating Dixa conversation: ${error.message}`);
    if (error.response) {
      console.error(`❌ Response status: ${error.response.status}`);
      console.error(
        `❌ Response data:`,
        JSON.stringify(error.response.data, null, 2)
      );
    }
    throw error;
  }
}

// Voyado Review Webhook Endpoint
app.post("/webhook/voyado/review", async (req, res) => {
  try {
    const reviewData = req.body;

    console.log(
      `📝 Received Voyado review webhook:`,
      JSON.stringify(reviewData, null, 2)
    );

    // Validate required fields
    if (!reviewData.contactId && !reviewData.email && !reviewData.phone) {
      return res.status(400).json({
        error:
          "Missing required contact identifier. Must provide at least one of: contactId, email, or phone",
      });
    }

    // Extract contact information with priority: contactId > email > phone
    const contactData = {
      contactId: reviewData.contactId,
      email: reviewData.email,
      phone: reviewData.phone,
    };

    // Get configuration (with webhook payload overrides)
    const config = {
      emailIntegrationId:
        reviewData.dixaEmailIntegrationId ||
        process.env.DIXA_EMAIL_INTEGRATION_ID,
      apiToken: reviewData.dixaApiToken || process.env.DIXA_PUBLIC_API_TOKEN,
    };

    // Validate configuration
    if (!config.apiToken) {
      return res.status(500).json({
        error:
          "Missing Dixa API token. Set DIXA_PUBLIC_API_TOKEN environment variable or provide dixaApiToken in webhook payload",
      });
    }

    // Fetch additional interaction details if contactId is provided
    let interactionData = {
      rating: reviewData.rating,
    };

    if (contactData.contactId) {
      console.log(`🔍 Fetching interactions for contact...`);

      // First, get all interactions for the contact with the completedProductRating schema
      const interactions = await fetchVoyadoInteractionsBySchema(
        contactData.contactId,
        reviewData.schemaId || "completedProductRating"
      );

      if (interactions && interactions.data && interactions.data.length > 0) {
        // Get the most recent interaction (first in the array, assuming they're sorted by date)
        const mostRecentInteraction = interactions.data[0];
        console.log(
          `📅 Most recent interaction ID: ${mostRecentInteraction.id}`
        );

        // Fetch detailed information for the most recent interaction
        const details = await fetchVoyadoInteractionDetails(
          mostRecentInteraction.id
        );
        if (details) {
          // Merge additional details from Voyado
          interactionData = {
            ...interactionData,
            ...details.payload,
            interactionId: mostRecentInteraction.id,
          };
        }
      } else {
        console.log(
          `📭 No interactions found for contact ${contactData.contactId}`
        );
      }
    }

    // Get or create Dixa end user
    console.log(`👤 Getting or creating Dixa end user...`);
    const endUser = await getOrCreateDixaEndUser(contactData, config);

    // Create Dixa conversation
    console.log(`📧 Creating Dixa conversation...`);
    const conversation = await createDixaConversation(
      endUser,
      interactionData,
      config
    );

    res.status(200).json({
      message: "Review webhook processed successfully",
      conversationId: conversation.data?.id,
      endUserId: endUser.id,
      contactData: contactData,
      interactionData: interactionData,
    });
  } catch (error) {
    console.error("❌ Error processing Voyado review webhook:", error);

    // Return appropriate error status based on error type
    if (error.response) {
      const status = error.response.status;
      if (status === 400) {
        return res.status(400).json({
          error: "Invalid request data",
          details: error.response.data,
        });
      } else if (status === 401) {
        return res.status(401).json({
          error: "Unauthorized - check API token",
          details: error.response.data,
        });
      } else if (status === 404) {
        return res.status(404).json({
          error: "Resource not found",
          details: error.response.data,
        });
      } else {
        return res.status(500).json({
          error: "External API error",
          details: error.response.data,
        });
      }
    } else {
      return res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  }
});

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
    const conversationId =
      parseInt(event.data.conversation.id) ||
      parseInt(event.event_id) ||
      Date.now(); // Use conversation ID as integer or fallback to timestamp
    const supportChannel = event.data.conversation.channel || "Other"; // Extract channel or default to "Other"

    console.log(
      `📊 CSAT Rating: ${score}/5 - "${comment}" from ${contactName} (${contactEmail})`
    );
    console.log(`   Conversation ID: ${conversationId}`);
    console.log(`   Support Channel: ${supportChannel}`);

    // Calculate points based on score
    const points = calculatePoints(score);
    console.log(`   Points to award: ${points}`);

    // First lookup the contact ID in Voyado, then get point account, then add points and store interaction
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
      .then(() => {
        console.log(`   ✅ Points successfully added to Voyado`);

        // Store CSAT interaction data in Voyado (if contact was found)
        if (foundContactId) {
          console.log(`   📊 Storing CSAT interaction data...`);
          return storeCSATInteraction(
            foundContactId,
            score,
            conversationId,
            supportChannel
          );
        } else {
          console.log(`   ⚠️  Skipping interaction storage - no contact found`);
          return null;
        }
      })
      .then(() => {
        console.log(`   ✅ CSAT interaction data successfully stored`);
      })
      .catch((error) => {
        console.error(`   ❌ Failed to process CSAT data: ${error.message}`);
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

// Test Dixa end user lookup endpoint
app.get("/test-dixa-enduser-lookup", async (req, res) => {
  const { email, phone, contactId } = req.query;

  if (!email && !phone && !contactId) {
    return res.status(400).json({
      success: false,
      error: "Must provide at least one of: email, phone, or contactId",
    });
  }

  console.log(`🧪 Testing Dixa end user lookup`);

  try {
    const contactData = { email, phone, contactId };
    const config = {
      apiToken: process.env.DIXA_PUBLIC_API_TOKEN,
    };

    if (!config.apiToken) {
      return res.status(500).json({
        success: false,
        error: "Missing DIXA_PUBLIC_API_TOKEN environment variable",
      });
    }

    const endUser = await lookupDixaEndUser(contactData, config);

    if (endUser) {
      res.json({
        success: true,
        message: "End user found",
        endUser: endUser,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No end user found",
        contactData: contactData,
      });
    }
  } catch (error) {
    console.error(`   ❌ Failed to lookup Dixa end user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test Voyado interactions endpoint
app.get("/test-voyado-interactions", async (req, res) => {
  const { contactId, schemaId } = req.query;

  if (!contactId) {
    return res.status(400).json({
      success: false,
      error: "Must provide contactId",
    });
  }

  console.log(`🧪 Testing Voyado interactions lookup`);

  try {
    const interactions = await fetchVoyadoInteractionsBySchema(
      contactId,
      schemaId || "completedProductRating"
    );

    if (interactions && interactions.data && interactions.data.length > 0) {
      const mostRecentInteraction = interactions.data[0];

      // Fetch detailed information for the most recent interaction
      const details = await fetchVoyadoInteractionDetails(
        mostRecentInteraction.id
      );

      res.json({
        success: true,
        message: "Interactions found",
        totalInteractions: interactions.data.length,
        mostRecentInteraction: {
          id: mostRecentInteraction.id,
          details: details,
        },
        allInteractions: interactions.data,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No interactions found",
        contactId: contactId,
        schemaId: schemaId || "completedProductRating",
      });
    }
  } catch (error) {
    console.error(
      `   ❌ Failed to fetch Voyado interactions: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test Dixa end user creation endpoint
app.post("/test-dixa-enduser-create", async (req, res) => {
  const { email, phone, contactId, displayName } = req.body;

  if (!email && !phone && !contactId) {
    return res.status(400).json({
      success: false,
      error: "Must provide at least one of: email, phone, or contactId",
    });
  }

  console.log(`🧪 Testing Dixa end user creation`);

  try {
    const contactData = { email, phone, contactId, displayName };
    const config = {
      apiToken: process.env.DIXA_PUBLIC_API_TOKEN,
    };

    if (!config.apiToken) {
      return res.status(500).json({
        success: false,
        error: "Missing DIXA_PUBLIC_API_TOKEN environment variable",
      });
    }

    const endUser = await createDixaEndUser(contactData, config);

    res.json({
      success: true,
      message: "End user created successfully",
      endUser: endUser,
    });
  } catch (error) {
    console.error(`   ❌ Failed to create Dixa end user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test Voyado review webhook endpoint
app.post("/test-voyado-review", async (req, res) => {
  const {
    contactId,
    email,
    phone,
    interactionId,
    rating,
    schemaId,
    dixaApiToken,
    dixaEmailIntegrationId,
  } = req.body;

  if (!contactId && !email && !phone) {
    return res.status(400).json({
      success: false,
      error:
        "Missing required contact identifier. Must provide at least one of: contactId, email, or phone",
    });
  }

  console.log(`🧪 Testing Voyado review webhook processing`);

  try {
    // Simulate the webhook payload
    const webhookPayload = {
      contactId,
      email,
      phone,
      interactionId,
      rating,
      schemaId,
      dixaApiToken,
      dixaEmailIntegrationId,
    };

    // Create a mock request/response to test the webhook logic
    const mockReq = { body: webhookPayload };
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          res.status(code).json({
            success: code >= 200 && code < 300,
            testResult: data,
            webhookPayload: webhookPayload,
          });
        },
      }),
    };

    // Call the webhook handler logic directly
    await app._router.stack
      .find(
        (layer) => layer.route && layer.route.path === "/webhook/voyado/review"
      )
      .route.stack[0].handle(mockReq, mockRes);
  } catch (error) {
    console.error(
      `   ❌ Failed to test Voyado review webhook: ${error.message}`
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test CSAT interaction endpoint
app.post("/test-csat-interaction", async (req, res) => {
  const { contactId, csatScore, conversationId, supportChannel } = req.body;

  if (!contactId || !csatScore) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: contactId and csatScore",
    });
  }

  // Validate CSAT score
  if (csatScore < 1 || csatScore > 5) {
    return res.status(400).json({
      success: false,
      error: "CSAT score must be between 1 and 5",
    });
  }

  // Validate support channel
  const validChannels = ["Chat", "Email", "Phone", "Social", "Other"];
  const channel = supportChannel || "Other";
  if (!validChannels.includes(channel)) {
    return res.status(400).json({
      success: false,
      error: `Support channel must be one of: ${validChannels.join(", ")}`,
    });
  }

  console.log(
    `🧪 Testing CSAT interaction: Score ${csatScore} for contact ${contactId}`
  );

  try {
    const result = await storeCSATInteraction(
      contactId,
      csatScore,
      conversationId || Date.now(),
      channel
    );

    res.json({
      success: true,
      message: `Successfully stored CSAT interaction for contact ${contactId}`,
      data: {
        contactId,
        csatScore,
        conversationId: conversationId || Date.now(),
        supportChannel: channel,
      },
      result,
    });
  } catch (error) {
    console.error(`   ❌ Failed to store CSAT interaction: ${error.message}`);
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
    `📝 Voyado Review webhook endpoint: ${localAddress}/webhook/voyado/review`
  );
  console.log(`🔍 Latest CSAT endpoint: ${localAddress}/latest-csat`);
  console.log(
    `🧪 Test lookup endpoint: ${localAddress}/test-lookup/:type/:identifier`
  );
  console.log(`🧪 Test add points endpoint: ${localAddress}/test-add-points`);
  console.log(
    `🧪 Test CSAT interaction endpoint: ${localAddress}/test-csat-interaction`
  );
  console.log(
    `🧪 Test Voyado review endpoint: ${localAddress}/test-voyado-review`
  );
  console.log(
    `🧪 Test Dixa end user lookup: ${localAddress}/test-dixa-enduser-lookup`
  );
  console.log(
    `🧪 Test Dixa end user create: ${localAddress}/test-dixa-enduser-create`
  );
  console.log(
    `🧪 Test Voyado interactions: ${localAddress}/test-voyado-interactions`
  );
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
