#!/bin/bash

# Development helper script for Stream Wars

case "$1" in
  start)
    echo "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up
    ;;
  
  up)
    echo "Starting development environment in background..."
    docker-compose -f docker-compose.dev.yml up -d
    echo "Services started."
    echo "   App: http://localhost:3000"
    echo "   WebSocket: ws://localhost:3001"
    echo ""
    echo "View logs with: ./dev.sh logs"
    ;;
  
  down)
    echo "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    echo "Services stopped."
    ;;
  
  restart)
    echo "Restarting development environment..."
    docker-compose -f docker-compose.dev.yml restart
    echo "Services restarted."
    ;;
  
  logs)
    echo "Showing logs (Ctrl+C to exit)..."
    docker-compose -f docker-compose.dev.yml logs -f app
    ;;
  
  rebuild)
    echo "Rebuilding containers..."
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.dev.yml up --build
    ;;
  
  clean)
    echo "Cleaning up Docker resources..."
    docker-compose -f docker-compose.dev.yml down -v
    docker system prune -f
    echo "Cleanup complete."
    ;;
  
  *)
    echo "Stream Wars - Development Helper"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start    - Start dev environment (foreground, with logs)"
    echo "  up       - Start dev environment (background)"
    echo "  down     - Stop dev environment"
    echo "  restart  - Restart dev environment"
    echo "  logs     - Show application logs"
    echo "  rebuild  - Rebuild containers from scratch"
    echo "  clean    - Clean up all Docker resources"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh up        # Start dev environment"
    echo "  ./dev.sh logs      # View logs"
    echo "  ./dev.sh down      # Stop everything"
    ;;
esac

