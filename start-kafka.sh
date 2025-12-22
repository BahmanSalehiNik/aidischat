#!/bin/bash

# Start Kafka (Redpanda) via Docker Compose
# This script starts Redpanda and initializes all required topics

set -e

echo "🚀 Starting Kafka (Redpanda)..."

# Start Redpanda and topic initialization
docker-compose -f docker-compose.kafka.yml up -d

echo "⏳ Waiting for Redpanda to be ready..."
sleep 5

# Check if Redpanda is healthy
if docker exec redpanda rpk cluster health --brokers localhost:9092 &>/dev/null; then
    echo "✅ Redpanda is ready!"
    echo ""
    echo "📋 Kafka broker: localhost:9092 (internal) or localhost:19092 (external)"
    echo "📋 For k8s pods: redpanda-srv:9092"
    echo ""
    echo "To view logs: docker-compose -f docker-compose.kafka.yml logs -f"
    echo "To stop: docker-compose -f docker-compose.kafka.yml down"
else
    echo "⚠️  Redpanda is starting up... This may take a moment."
    echo "Check status with: docker-compose -f docker-compose.kafka.yml ps"
fi





