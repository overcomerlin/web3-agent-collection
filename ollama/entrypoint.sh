#!/bin/bash

# 1. backgound execution of service
echo "Starting Ollama server..."
ollama serve &
# PID of ollama serve &
PID=$!

# 2. Waiting for service launched
echo "Waiting for Ollama to start..."
sleep 10

# 3. Execute the instruction after ollam serve launched
echo "Pulling gemma4:e4b model..."
ollama pull gemma4:e4b

# Using wait for keeping execution
echo "Ollama is ready!"
wait $PID