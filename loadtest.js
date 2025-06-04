/**
 * Load Test Script for Cinema Seat Reservation System
 * This script simulates multiple concurrent users trying to book seats
 */

const fetch = require('node-fetch');
const async = require('async');

// Configuration
const config = {
  baseUrl: 'http://localhost:3000/api',
  screeningId: 1, // Change this to match your testing environment
  concurrency: 100, // Number of concurrent users
  usersPerBatch: 10, // Number of users to process in parallel
  seatIds: [], // Will be filled dynamically
  userIdStart: 1000, // Starting user ID for test users
};

// Statistics
const stats = {
  total: 0,
  successful: 0,
  failed: 0,
  startTime: null,
  endTime: null,
  errors: {},
};

/**
 * Load available seats for a screening
 */
async function loadAvailableSeats() {
  try {
    console.log(
      `Loading available seats for screening #${config.screeningId}...`,
    );

    const response = await fetch(
      `${config.baseUrl}/seat-reservations/available-seats/${config.screeningId}`,
    );
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const seats = await response.json();
    console.log(`Found ${seats.length} available seats`);

    // Extract seat IDs
    return seats.map((seat) => seat.id);
  } catch (error) {
    console.error(`Error loading seats: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Reserve seats for a user
 */
async function reserveSeats(userId, seatIds) {
  try {
    const response = await fetch(`${config.baseUrl}/seat-reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        screening_id: config.screeningId,
        seat_ids: seatIds,
        reservation_type: 'temporary',
        require_all: true,
        suggest_alternatives: false,
      }),
    });

    const result = await response.json();
    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Release seats for a user
 */
async function releaseSeats(userId) {
  try {
    await fetch(
      `${config.baseUrl}/seat-reservations/user/${userId}/screening/${config.screeningId}`,
      {
        method: 'DELETE',
      },
    );
  } catch (error) {
    console.error(`Error releasing seats for user ${userId}: ${error.message}`);
  }
}

/**
 * Run the load test
 */
async function runLoadTest() {
  // Load available seats first
  const availableSeats = await loadAvailableSeats();
  if (availableSeats.length < config.concurrency) {
    console.error(
      `Not enough seats available (${availableSeats.length}) for the requested concurrency (${config.concurrency})`,
    );
    process.exit(1);
  }

  // Prepare test data - each user will try to book 1-2 seats
  const testUsers = [];
  let seatIndex = 0;

  for (let i = 0; i < config.concurrency; i++) {
    const userId = config.userIdStart + i;
    const seatCount = Math.random() > 0.5 ? 2 : 1; // Randomly pick 1 or 2 seats
    const userSeats = [];

    for (let j = 0; j < seatCount && seatIndex < availableSeats.length; j++) {
      userSeats.push(availableSeats[seatIndex++]);
    }

    testUsers.push({ userId, seatIds: userSeats });
  }

  console.log(
    `Prepared ${testUsers.length} test users, using ${seatIndex} total seats`,
  );
  console.log(
    `Starting load test with ${config.concurrency} concurrent users...`,
  );

  // Start the test
  stats.startTime = Date.now();
  stats.total = testUsers.length;

  // Process in batches to avoid overwhelming the system
  await async.eachLimit(testUsers, config.usersPerBatch, async (user) => {
    const result = await reserveSeats(user.userId, user.seatIds);

    if (result.success) {
      stats.successful++;
      console.log(
        `✅ User ${user.userId} successfully reserved seats: ${user.seatIds.join(', ')}`,
      );

      // Release the seats after a random delay (1-5 seconds)
      setTimeout(
        () => {
          releaseSeats(user.userId);
        },
        1000 + Math.random() * 4000,
      );
    } else {
      stats.failed++;
      const errorKey = result.error || 'Unknown error';
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      console.log(
        `❌ User ${user.userId} failed to reserve seats: ${result.error}`,
      );
    }
  });

  // Test completed
  stats.endTime = Date.now();
  const testDuration = (stats.endTime - stats.startTime) / 1000;

  console.log('\n--- LOAD TEST RESULTS ---');
  console.log(`Duration: ${testDuration.toFixed(2)} seconds`);
  console.log(`Total requests: ${stats.total}`);
  console.log(
    `Successful: ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(2)}%)`,
  );
  console.log(
    `Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(2)}%)`,
  );
  console.log(
    `Throughput: ${(stats.total / testDuration).toFixed(2)} requests/second`,
  );

  if (stats.failed > 0) {
    console.log('\nError breakdown:');
    for (const [error, count] of Object.entries(stats.errors)) {
      console.log(`- ${error}: ${count} occurrences`);
    }
  }
}

// Run the load test
runLoadTest().catch((error) => {
  console.error('Load test failed:', error);
});
