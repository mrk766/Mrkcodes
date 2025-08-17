document.addEventListener("DOMContentLoaded", () => {
  const state = {
    username: localStorage.getItem("devhub_username") || null,
    messages: JSON.parse(localStorage.getItem("devhub_messages")) || [],
  };

  const feed = document.getElementById("chat-feed");

  const save = () =>
    localStorage.setItem("devhub_messages", JSON.stringify(state.messages));

  const getAvatar = (user) => {
    const color =
      "#" +
      ((Math.abs(user.charCodeAt(0) * user.length) % 0xffffff) | 0)
        .toString(16)
        .padStart(6, "0");
    return `<span class="avatar" style="background:${color};">${user[0].toUpperCase()}</span>`;
  };

  const renderChat = () => {
    const search = document.getElementById("chat-search").value.toLowerCase();
    const msgs = state.messages
      .filter((m) => m.text.toLowerCase().includes(search))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    feed.innerHTML = msgs
      .map((m) => {
        const mine = m.user === state.username ? "mine" : "theirs";
        return `
          <div class="chat-message ${mine}">
            ${getAvatar(m.user)}
            <div class="message-content">
              <span class="user">${m.user}</span>
              <div class="text">${marked.parse(m.text)}</div>
              <span class="timestamp">${new Date(
                m.timestamp
              ).toLocaleTimeString()}</span>
            </div>
          </div>`;
      })
      .join("");
    feed.scrollTop = feed.scrollHeight;
  };

  document
    .getElementById("chat-input-form")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state.username) {
        const name = prompt("Enter your username:");
        if (!name) return;
        state.username = name;
        localStorage.setItem("devhub_username", name);
      }
      const input = document.getElementById("chat-message-input");
      if (!input.value.trim()) return;
      state.messages.push({
        id: "msg_" + Date.now(),
        user: state.username,
        text: input.value,
        timestamp: new Date().toISOString(),
      });
      input.value = "";
      save();
      renderChat();
    });

  document
    .getElementById("chat-search")
    .addEventListener("input", renderChat);

  renderChat();
});