#!/bin/bash
echo "🔍 Finding process on port 9002..."
PID=$(lsof -t -i :9002)

if [ -n "$PID" ]; then
  echo "❌ Port 9002 is in use by PID $PID"
  echo "🔥 Killing process..."
  kill -9 $PID
  echo "✅ Port 9002 freed!"
else
  echo "✅ Port 9002 is free!"
fi
