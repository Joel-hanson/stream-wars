#!/bin/sh
set -e

# Start the compiled Next.js server (using compiled JS from dist/)
node dist/server.js &
NEXTJS_PID=$!

# Start the compiled WebSocket server (using compiled JS from dist/)
node dist/websocket-server.js &
WS_PID=$!

# Wait for either process to exit
wait -n

# If either process exits, kill the other
kill $NEXTJS_PID $WS_PID 2>/dev/null
exit $?
