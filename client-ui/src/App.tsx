import React, { useState } from 'react';

const API_URL = 'https://1088og8dpc.execute-api.us-east-1.amazonaws.com/Prod/mcp'; // Change this to your backend endpoint

function App() {
  const [messages, setMessages] = useState<{ sender: string, text: string }[]>([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: 'You', text: input }]);
    setInput('');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE'
        },
        body: JSON.stringify({ message: input })
      });
      const data = await response.json();
      setMessages(msgs => [...msgs, { sender: 'AI', text: data.reply }]);
    } catch (err) {
      setMessages(msgs => [...msgs, { sender: 'System', text: 'Error contacting server.' }]);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>AI Game Master Chat</h2>
      <div style={{ border: '1px solid #ccc', padding: 16, minHeight: 200, marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div key={i}><b>{msg.sender}:</b> {msg.text}</div>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
        style={{ width: '80%', marginRight: 8 }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;