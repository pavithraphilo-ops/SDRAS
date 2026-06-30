#!/bin/bash
# SDRAS Hackathon Startup Script
# Run this to start both the Django backend and React frontend

echo "🚀 Starting SDRAS — Smart Disaster Resource Allocation System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start Django backend in background
echo "📡 Starting Django Backend on http://localhost:8000 ..."
cd backend
python3 manage.py runserver 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3
echo "   ✓ Backend started (PID: $BACKEND_PID)"

# Start React frontend
echo "⚛️  Starting React Frontend on http://localhost:3000 ..."
npm start &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SDRAS is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000/api/"
echo "   Admin:    http://localhost:8000/admin/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Stopped.'" INT
wait
