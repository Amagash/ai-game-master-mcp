#!/bin/sh

# Start Express API (Node.js) in the background and keep it running
node dist/index.js &
NODE_PID=$!

# Start Streamlit UI in the foreground
streamlit run ./streamlit-ui/app.py --server.port=8501 --server.address=0.0.0.0 &
STREAMLIT_PID=$!

# Handle termination signals
trap "kill $NODE_PID $STREAMLIT_PID; exit" SIGINT SIGTERM

# Keep the container running
wait $STREAMLIT_PID
