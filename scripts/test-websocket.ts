import WebSocket from 'ws';

console.log('Attempting to connect to WebSocket server at ws://localhost:3001');
console.log(' Make sure both servers are running with: npm run dev');
console.log('');

let messagesReceived = 0;

// Test WebSocket connection on port 3001
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', function open() {
  console.log('WebSocket connection established');
  console.log('');
  
  // Send a test message
  const testMessage = {
    type: 'user_join',
    data: {
      username: 'TestUser',
      team: 'blue',
      sessionId: 'test-session'
    }
  };
  
  console.log('Sending:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data: Buffer) {
  messagesReceived++;
  console.log(`Received message #${messagesReceived}:`, JSON.parse(data.toString()));
});

ws.on('error', function error(err: Error) {
  console.error('WebSocket error:', err.message);
  if (err.message.includes('ECONNREFUSED') || err.message.includes('socket hang up')) {
    console.error('');
    console.error('The server is not running or not accessible.');
    console.error('Please run: npm run dev');
    console.error('Then run this test again in another terminal.');
  }
  process.exit(1);
});

ws.on('close', function close(code, reason) {
  console.log('');
  console.log('WebSocket connection closed');
  console.log(`   Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
  
  if (messagesReceived === 0 && code === 1006) {
    console.log('');
    console.log('No messages received. The server might not be running.');
    console.log('Make sure you ran "npm run dev" before running this test.');
  }
});

// Close after 5 seconds
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('');
    console.log(' 5 seconds elapsed, closing connection...');
    ws.close();
  }
  setTimeout(() => {
    process.exit(0);
  }, 100);
}, 5000);

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});
