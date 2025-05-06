from lambda_mcp.lambda_mcp import LambdaMCPServer
from datetime import datetime, UTC
import random
import boto3
import os
import streamlit as st
import requests
import uuid

# Get session table name from environment variable
session_table = os.environ.get('MCP_SESSION_TABLE', 'mcp_sessions')

# Create the MCP server instance
mcp_server = LambdaMCPServer(name="mcp-lambda-server", version="1.0.0", session_table=session_table)

@mcp_server.tool()
def get_time() -> str:
    """Get the current UTC date and time."""
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")

@mcp_server.tool()
def get_weather(city: str) -> str:
    """Get the current weather for a city.
    
    Args:
        city: Name of the city to get weather for
        
    Returns:
        A string describing the weather
    """
    temp = random.randint(15, 35)
    return f"The temperature in {city} is {temp}°C"

@mcp_server.tool()
def count_s3_buckets() -> int:
    """Count the number of S3 buckets."""
    s3 = boto3.client('s3')
    response = s3.list_buckets()
    return len(response['Buckets'])

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    return mcp_server.handle_request(event, context)

# Streamlit UI for AI Game Master chat
st.set_page_config(page_title="AI Game Master Chat", page_icon="🎲")
st.title("AI Game Master Chat 🎲")

# Session state for chat history and session id
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = []
if "session_id" not in st.session_state:
    st.session_state["session_id"] = None

# Backend URL (adjust as needed)
BACKEND_URL = "http://localhost:3000"  # Change if your backend runs elsewhere

# Initialize session if needed
def initialize_session():
    resp = requests.post(
        f"{BACKEND_URL}/prod/",  # Adjust path if needed
        headers={"Content-Type": "application/json"},
        json={
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "initialize",
            "params": {}
        },
    )
    if resp.status_code == 200:
        session_id = resp.headers.get("MCP-Session-Id")
        st.session_state["session_id"] = session_id
        return session_id
    st.error("Failed to initialize session.")
    return None

if st.session_state["session_id"] is None:
    initialize_session()

# Chat input
user_input = st.text_input("You:", "", key="user_input")

if st.button("Send") and user_input.strip():
    # Add user message to chat history
    st.session_state["chat_history"].append(("user", user_input))

    # Send message to backend (replace with your actual method/tool)
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "tools/call",
        "params": {
            "name": "chat",  # Replace with your actual chat tool name if different
            "arguments": {"message": user_input}
        }
    }
    headers = {
        "Content-Type": "application/json",
        "MCP-Session-Id": st.session_state["session_id"] or ""
    }
    try:
        resp = requests.post(f"{BACKEND_URL}/prod/", json=payload, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            # Extract AI response (adjust path as needed)
            ai_msg = data.get("result", {}).get("content", [{}])[0].get("text", "(No response)")
            st.session_state["chat_history"].append(("ai", ai_msg))
        else:
            st.session_state["chat_history"].append(("ai", f"[Error {resp.status_code}]: {resp.text}"))
    except Exception as e:
        st.session_state["chat_history"].append(("ai", f"[Exception]: {e}"))
    st.session_state["user_input"] = ""

# Display chat history
for sender, msg in st.session_state["chat_history"]:
    if sender == "user":
        st.markdown(f"**You:** {msg}")
    else:
        st.markdown(f"**AI Game Master:** {msg}") 