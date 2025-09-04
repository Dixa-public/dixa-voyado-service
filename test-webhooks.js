const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Test data for different CSAT scores
const testCases = [
  {
    name: "Low Score (1) - Should award 10 points",
    score: 1,
    comment: "Very poor service experience",
  },
  {
    name: "Medium Score (3) - Should award 5 points",
    score: 3,
    comment: "Average service, could be better",
  },
  {
    name: "High Score (5) - Should award 15 points",
    score: 5,
    comment: "Excellent service, very satisfied!",
  },
];

async function testDixaWebhook(testCase) {
  try {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`   Score: ${testCase.score}/5`);
    console.log(`   Comment: "${testCase.comment}"`);

    const payload = {
      event_id: `test-${Date.now()}-${testCase.score}`,
      event_fqn: "CONVERSATION_RATED",
      event_version: "1",
      event_timestamp: new Date().toISOString(),
      data: {
        conversation: {
          requester: {
            name: "Test User",
            email: `test-score-${testCase.score}@example.com`,
          },
          subject: "Test Conversation",
        },
        score: testCase.score,
        comment: testCase.comment,
        type: "Csat",
      },
    };

    const response = await axios.post(`${BASE_URL}/webhook/dixa/csat`, payload);
    console.log(`   ✅ Response: ${response.data.message}`);
    console.log(`   💰 Points awarded: ${response.data.pointsAwarded}`);
  } catch (error) {
    console.error(
      `   ❌ Error: ${error.response?.data?.error || error.message}`
    );
  }
}

async function testVoyadoWebhook() {
  try {
    console.log("\n🧪 Testing Voyado Points Webhook");

    const payload = {
      eventId: `test-${Date.now()}`,
      eventType: "point.balance.updated",
      isEncrypted: false,
      payload: {
        accountId: 999,
        balance: 2500.75,
        balanceExpires: "2024-12-31T23:59:59.999+01:00",
        contactId: "test-contact-123",
        definitionId: 1,
      },
      tenant: "test-tenant",
    };

    const response = await axios.post(
      `${BASE_URL}/webhook/voyado/points`,
      payload
    );
    console.log(`   ✅ Response: ${response.data.message}`);
    console.log(`   💰 New balance: ${response.data.balance}`);
  } catch (error) {
    console.error(
      `   ❌ Error: ${error.response?.data?.error || error.message}`
    );
  }
}

async function testAddPoints() {
  try {
    console.log("\n🧪 Testing Add Points Endpoint");

    // First, get a contact ID by looking up nederby@gmail.com
    console.log("   🔍 Looking up contact: nederby@gmail.com");
    const lookupResponse = await axios.get(
      `${BASE_URL}/test-lookup/email/nederby%40gmail.com`
    );

    if (lookupResponse.data.contactId) {
      const contactId = lookupResponse.data.contactId;
      console.log(`   ✅ Found contact ID: ${contactId}`);

      // Test adding 25 test points
      const pointsPayload = {
        contactId: contactId,
        points: 25,
        description: "Test points for API testing",
      };

      console.log(`   💰 Adding ${pointsPayload.points} points...`);
      const addResponse = await axios.post(
        `${BASE_URL}/test-add-points`,
        pointsPayload
      );

      console.log(`   ✅ Response: ${addResponse.data.message}`);
      if (addResponse.data.result) {
        console.log(
          `   📊 Result:`,
          JSON.stringify(addResponse.data.result, null, 2)
        );
      }
    } else {
      console.log("   ❌ No contact found for testing");
    }
  } catch (error) {
    console.error(
      `   ❌ Error: ${error.response?.data?.error || error.message}`
    );
  }
}

async function runTests() {
  console.log("🚀 Starting Webhook Service Tests\n");

  // Test health endpoint
  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log(`✅ Health check: ${health.data.status}`);
  } catch (error) {
    console.error(`❌ Health check failed: ${error.message}`);
    return;
  }

  // Test Dixa webhooks with different scores
  for (const testCase of testCases) {
    await testDixaWebhook(testCase);
    // Wait a bit between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Test Voyado webhook
  await testVoyadoWebhook();

  // Test add points endpoint
  await testAddPoints();

  // Check latest CSAT event
  try {
    const latest = await axios.get(`${BASE_URL}/latest-csat`);
    console.log(`\n📊 Latest CSAT Event:`);
    console.log(`   Event ID: ${latest.data.event.event_id}`);
    console.log(`   Score: ${latest.data.event.data.score}/5`);
    console.log(`   Comment: "${latest.data.event.data.comment}"`);
  } catch (error) {
    console.error(`❌ Failed to get latest CSAT: ${error.message}`);
  }

  console.log("\n🎉 All tests completed!");
}

// Run the tests
runTests().catch(console.error);
