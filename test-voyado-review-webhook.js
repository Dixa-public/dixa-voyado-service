#!/usr/bin/env node

/**
 * Test script for the Voyado Review Webhook endpoint
 *
 * This script demonstrates how to test the new webhook endpoint that receives
 * review submissions from Voyado and creates conversations in Dixa.
 */

const axios = require("axios");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const WEBHOOK_ENDPOINT = `${BASE_URL}/webhook/voyado/review`;
const TEST_ENDPOINT = `${BASE_URL}/test-voyado-review`;
const DIXA_ENDUSER_LOOKUP_ENDPOINT = `${BASE_URL}/test-dixa-enduser-lookup`;
const DIXA_ENDUSER_CREATE_ENDPOINT = `${BASE_URL}/test-dixa-enduser-create`;

// Test data examples
const testCases = [
  {
    name: "Review with contactId",
    data: {
      contactId: "cbe3f42c-c1d0-4721-b8ce-ab35001ce051",
      rating: 5,
      interactionId: "interaction-123",
    },
  },
  {
    name: "Review with email address",
    data: {
      email: "customer@example.com",
      rating: 3,
      interactionId: "interaction-456",
    },
  },
  {
    name: "Review with phone number (E.164 format)",
    data: {
      phone: "+1234567890",
      rating: 5,
    },
  },
  {
    name: "Review with API token override",
    data: {
      contactId: "cbe3f42c-c1d0-4721-b8ce-ab35001ce051",
      rating: 4,
      dixaApiToken: "YOUR_CUSTOM_API_TOKEN_HERE",
      dixaEmailIntegrationId: "custom-email-integration-id",
    },
  },
  {
    name: "Review with missing contact identifier (should fail)",
    data: {
      rating: 5,
    },
    shouldFail: true,
  },
];

async function testWebhook(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 Data:`, JSON.stringify(testCase.data, null, 2));

  try {
    const response = await axios.post(WEBHOOK_ENDPOINT, testCase.data, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (testCase.shouldFail) {
      console.log(`❌ Expected failure but got success: ${response.status}`);
      console.log(`📧 Response:`, JSON.stringify(response.data, null, 2));
    } else {
      console.log(`✅ Success: ${response.status}`);
      console.log(`📧 Response:`, JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    if (testCase.shouldFail) {
      console.log(
        `✅ Expected failure: ${error.response?.status || "Network Error"}`
      );
      console.log(
        `📧 Error:`,
        JSON.stringify(error.response?.data || error.message, null, 2)
      );
    } else {
      console.log(
        `❌ Unexpected error: ${error.response?.status || "Network Error"}`
      );
      console.log(
        `📧 Error:`,
        JSON.stringify(error.response?.data || error.message, null, 2)
      );
    }
  }
}

async function testTestEndpoint(testCase) {
  console.log(`\n🧪 Testing via test endpoint: ${testCase.name}`);

  try {
    const response = await axios.post(TEST_ENDPOINT, testCase.data, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    console.log(
      `📧 Test endpoint response:`,
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.log(
      `❌ Test endpoint error: ${error.response?.status || "Network Error"}`
    );
    console.log(
      `📧 Error:`,
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
  }
}

async function testDixaEndUserLookup(contactData) {
  console.log(`\n🧪 Testing Dixa end user lookup`);
  console.log(`📝 Contact data:`, JSON.stringify(contactData, null, 2));

  try {
    const queryParams = new URLSearchParams();
    if (contactData.email) queryParams.append("email", contactData.email);
    if (contactData.phone) queryParams.append("phone", contactData.phone);
    if (contactData.contactId)
      queryParams.append("contactId", contactData.contactId);

    const response = await axios.get(
      `${DIXA_ENDUSER_LOOKUP_ENDPOINT}?${queryParams.toString()}`,
      {
        timeout: 10000,
      }
    );

    console.log(
      `📧 End user lookup response:`,
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.log(
      `❌ End user lookup error: ${error.response?.status || "Network Error"}`
    );
    console.log(
      `📧 Error:`,
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
  }
}

async function testDixaEndUserCreate(contactData) {
  console.log(`\n🧪 Testing Dixa end user creation`);
  console.log(`📝 Contact data:`, JSON.stringify(contactData, null, 2));

  try {
    const response = await axios.post(
      DIXA_ENDUSER_CREATE_ENDPOINT,
      contactData,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log(
      `📧 End user creation response:`,
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.log(
      `❌ End user creation error: ${error.response?.status || "Network Error"}`
    );
    console.log(
      `📧 Error:`,
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
  }
}

async function runTests() {
  console.log(`🚀 Starting Voyado Review Webhook Tests`);
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔗 Webhook Endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log(`🧪 Test Endpoint: ${TEST_ENDPOINT}`);

  // Test health endpoint first
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log(`\n❤️  Health check: ${healthResponse.status}`);
    console.log(
      `📧 Health response:`,
      JSON.stringify(healthResponse.data, null, 2)
    );
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    console.log(`⚠️  Make sure the server is running on ${BASE_URL}`);
    return;
  }

  // Run webhook tests
  console.log(`\n📝 Running webhook tests...`);
  for (const testCase of testCases) {
    await testWebhook(testCase);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }

  // Run test endpoint tests (only for valid cases)
  console.log(`\n🧪 Running test endpoint tests...`);
  for (const testCase of testCases.filter((tc) => !tc.shouldFail)) {
    await testTestEndpoint(testCase);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }

  // Run Dixa end user tests
  console.log(`\n👤 Running Dixa end user tests...`);
  const testContactData = {
    email: "test@example.com",
    phone: "+1234567890",
    contactId: "test-contact-id",
    displayName: "Test User",
  };

  await testDixaEndUserLookup(testContactData);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await testDixaEndUserCreate(testContactData);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`\n✅ All tests completed!`);
  console.log(`\n📋 Test Summary:`);
  console.log(`   - Webhook endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log(`   - Test endpoint: ${TEST_ENDPOINT}`);
  console.log(`   - Dixa end user lookup: ${DIXA_ENDUSER_LOOKUP_ENDPOINT}`);
  console.log(`   - Dixa end user create: ${DIXA_ENDUSER_CREATE_ENDPOINT}`);
  console.log(`   - Total test cases: ${testCases.length}`);
  console.log(
    `   - Expected failures: ${testCases.filter((tc) => tc.shouldFail).length}`
  );
}

// Example usage instructions
function printUsageInstructions() {
  console.log(`\n📖 Usage Instructions:`);
  console.log(`\n1. Start the server:`);
  console.log(`   npm start`);
  console.log(`\n2. Run this test script:`);
  console.log(`   node test-voyado-review-webhook.js`);
  console.log(`\n3. Or test with a custom base URL:`);
  console.log(
    `   TEST_BASE_URL=https://your-deployed-service.com node test-voyado-review-webhook.js`
  );
  console.log(`\n4. Test individual webhook calls:`);
  console.log(`   curl -X POST ${WEBHOOK_ENDPOINT} \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"contactId": "test-id", "rating": 5}'`);
  console.log(`\n5. Test with test endpoint:`);
  console.log(`   curl -X POST ${TEST_ENDPOINT} \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"email": "test@example.com", "rating": 5}'`);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testWebhook,
  testTestEndpoint,
  testDixaEndUserLookup,
  testDixaEndUserCreate,
  runTests,
  testCases,
};
