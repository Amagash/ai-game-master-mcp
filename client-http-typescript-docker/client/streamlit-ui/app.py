import streamlit as st
import requests
import time
import os

st.title("AI Game Master Chat (Streamlit UI)")

# MCP client API endpoint (local Express API in the same container)
MCP_SERVER_URL = "http://localhost:8080/converse"

# Store chat history in session state
if "messages" not in st.session_state:
    st.session_state.messages = []

# Function to check if API is available
def check_api_health():
    try:
        response = requests.post(MCP_SERVER_URL, json={"input": "ping"}, timeout=2)
        return response.status_code == 200
    except:
        return False

# User input
user_input = st.text_input("You:", key="user_input")
if st.button("Send") and user_input:
    payload = {"input": user_input}
    try:
        # Try to connect to the API
        response = requests.post(MCP_SERVER_URL, json=payload, timeout=10)
        resp_json = response.json()
        server_reply = resp_json.get("reply", "[No response]")
    except Exception as e:
        server_reply = f"[Error contacting client API: {e}]"
    st.session_state.messages.append(("You", user_input))
    st.session_state.messages.append(("GM", server_reply))
    st.rerun()

# Display chat history
for sender, msg in st.session_state.messages:
    st.markdown(f"**{sender}:** {msg}")

# Display API status
api_status = "🟢 Connected" if check_api_health() else "🔴 Disconnected"
st.sidebar.write(f"API Status: {api_status}")
