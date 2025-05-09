import streamlit as st
import requests
import time
import json
import functools

# Create a session with increased timeout and retry settings
session = requests.Session()
adapter = requests.adapters.HTTPAdapter(max_retries=5)
session.mount('http://', adapter)
session.mount('https://', adapter)

# Set default timeout for all requests in this session
original_request = session.request
session.request = functools.partial(original_request, timeout=300)  # 5 minutes

st.title("AI Game Master Chat (Streamlit UI)")

# MCP client API endpoint (local Express API in the same container)
MCP_SERVER_URL = "http://localhost:8080/converse"
HEALTH_URL = "http://localhost:8080/health"

# Store chat history in session state
if "messages" not in st.session_state:
    st.session_state.messages = []

# Function to check if API is available
def check_api_health():
    try:
        # Use session with default timeout
        response = session.get(HEALTH_URL)
        if response.status_code == 200:
            data = response.json()
            return True, data.get('aws', 'disconnected')
        return False, 'disconnected'
    except Exception as e:
        st.sidebar.error(f"Health check error: {str(e)}")
        return False, 'disconnected'

# Display API status in sidebar
api_available, aws_status = check_api_health()
api_status = "🟢 Connected" if api_available else "🔴 Disconnected"
aws_status_display = "🟢 AWS Connected" if aws_status == 'connected' else "🟡 Using Mock Responses"

st.sidebar.write(f"API Status: {api_status}")
st.sidebar.write(f"AWS Status: {aws_status_display}")

# Add a button to test the dice roll tool
st.sidebar.markdown("## Test Tools")
dice_type = st.sidebar.selectbox("Dice Type", ["d4", "d6", "d8", "d10", "d12", "d20", "d100"])
dice_count = st.sidebar.number_input("Number of Dice", min_value=1, max_value=10, value=1)

if st.sidebar.button("Roll Dice"):
    dice_notation = f"{dice_count}{dice_type}"
    user_message = f"roll {dice_notation}"
    st.session_state.messages.append(("You", user_message))
    
    try:
        with st.spinner("Rolling dice..."):
            # Use session with default timeout
            response = session.post(MCP_SERVER_URL, json={"input": user_message})
            resp_json = response.json()
            server_reply = resp_json.get("reply", "[No response]")
    except Exception as e:
        server_reply = f"[Error contacting client API: {str(e)}]"
        st.sidebar.error(f"API Error: {str(e)}")
    
    st.session_state.messages.append(("GM", server_reply))
    st.rerun()

# Display chat history
for sender, msg in st.session_state.messages:
    if sender == "You":
        st.markdown(f"**👤 {sender}:** {msg}")
    else:
        st.markdown(f"**🧙‍♂️ {sender}:** {msg}")

# Add a clear chat button
if st.button("Clear Chat"):
    st.session_state.messages = []
    st.rerun()

# User input with chat_input (supports Enter key by default)
user_input = st.chat_input("Type your message and press Enter...")
if user_input:
    st.session_state.messages.append(("You", user_input))
    
    try:
        with st.spinner("The Game Master is thinking... (This may take up to 5 minutes for complex queries)"):
            # Use session with default timeout
            response = session.post(MCP_SERVER_URL, json={"input": user_input})
            resp_json = response.json()
            server_reply = resp_json.get("reply", "[No response]")
    except Exception as e:
        server_reply = f"[Error contacting client API: {str(e)}]"
        st.sidebar.error(f"API Error: {str(e)}")
    
    st.session_state.messages.append(("GM", server_reply))
    st.rerun()
