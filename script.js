document.addEventListener('DOMContentLoaded', () => {
  // ---------- STATE ----------
  const state = {
    currentView: 'chatroom',
    activePostId: null,
    selectedSubject: null,
    isEditingPost: false,

    favorites: JSON.parse(localStorage.getItem('devhub_favorites')) || [],
    posts: JSON.parse(localStorage.getItem('devhub_posts')) || [],
    messages: JSON.parse(localStorage.getItem('devhub_messages')) || [],
    comments: JSON.parse(localStorage.getItem('devhub_comments')) || [],
    username: localStorage.getItem('devhub_username') || null,
  };

  // ---------- DOM ----------
  const views = {
    chatroom: document.getElementById('chatroom-view'),
    coderoom: document.getElementById('coderoom-view'),
    singlePost: document.getElementById('single-post-view'),
  };

  const navLinks = {
    chatroom: document.getElementById('nav-chatroom'),
    coderoom: document.getElementById('nav-coderoom'),
  };

  // ---------- UTILS ----------
  const saveData = () => {
    localStorage.setItem('devhub_posts', JSON.stringify(state.posts));
    localStorage.setItem('devhub_messages', JSON.stringify(state.messages));
    localStorage.setItem('devhub_comments', JSON.stringify(state.comments));
    localStorage.setItem('devhub_favorites', JSON.stringify(state.favorites));
  };

  const escapeHtml = (unsafe = '') =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const copyToClipboard = (text, message = 'Code copied!') => {
    navigator.clipboard.writeText(text).then(() => {
      const notify = document.getElementById('copy-notification');
      notify.textContent = message;
      notify.classList.add('show');
      setTimeout(() => notify.classList.remove('show'), 1800);
    });
  };

  const formatTS = (ts) => new Date(ts).toLocaleString();

  const getSubjects = () => [...new Set(state.posts.map(p => p.subject).filter(Boolean)), 'Favorites'];

  const ensureUsername = () => {
    if (!state.username) {
      document.getElementById('login-modal').classList.add('visible');
    }
  };

  const setUsername = () => {
    const name = document.getElementById('username-input').value.trim();
    if (name) {
      state.username = name;
      localStorage.setItem('devhub_username', name);
      document.getElementById('login-modal').classList.remove('visible');
      render();
    }
  };

  const navigate = (view, postId = null, subject = null) => {
    state.currentView = view;
    state.activePostId = postId;
    state.selectedSubject = subject;
    render();
  };

  const switchView = () => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(navLinks).forEach(l => l.classList.remove('active'));
    views[state.currentView].classList.add('active');
    if (state.currentView === 'chatroom') navLinks.chatroom.classList.add('active');
    if (state.currentView === 'coderoom') navLinks.coderoom.classList.add('active');
  };

  const getAvatar = (user = '?') => {
    const color = '#' + ((Math.abs(user.charCodeAt(0) * user.length) % 0xffffff) | 0).toString(16).padStart(6, '0');
    return `<span class="avatar" style="background:${color}">${escapeHtml(user[0]?.toUpperCase() || '?')}</span>`;
  };

  const getItemText = (item) => {
    if (item.type === 'message') return `${item.user} ${item.text}`;
    if (item.type === 'post') return `${item.user} ${item.title} ${item.subject} ${item.description}`;
    if (item.type === 'comment') return `${item.user} ${item.text}`;
    return '';
  };

  // ---------- RENDERERS ----------
  const render = () => {
    switchView();
    if (state.currentView === 'chatroom') renderChatroom();
    if (state.currentView === 'coderoom') renderCoderoom();
    if (state.currentView === 'singlePost') renderSinglePost();
  };

  const renderChatroom = () => {
    const feed = document.getElementById('chat-feed');
    const search = (document.getElementById('chat-search')?.value || '').toLowerCase();

    const combined = [
      ...state.messages.map(m => ({...m, type: 'message'})),
      ...state.posts.map(p => ({...p, type: 'post'})),
      ...state.comments.map(c => ({...c, type: 'comment'})),
    ]
      .filter(item => getItemText(item).toLowerCase().includes(search))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const html = combined.map(item => {
      const ts = formatTS(item.timestamp);
      const mine = item.user === state.username;
      const side = mine ? 'right' : 'left';

      if (item.type === 'message') {
        return `
          <div class="chat-row ${side}" data-msg-id="${escapeHtml(item.id)}">
            <div class="chat-bubble">
              ${getAvatar(item.user)}
              <div class="bubble ${mine ? 'mine' : ''}">
                <span class="user">${escapeHtml(item.user)}</span>
                <div class="text">${marked.parse(item.text || '')}</div>
                <span class="timestamp">${ts}</span>
              </div>
              <button class="delete-btn delete-msg" data-id="${escapeHtml(item.id)}" title="Delete">🗑️</button>
            </div>
          </div>
        `;
      }

      if (item.type === 'post') {
        const imageHtml = item.image ? `<img src="${item.image}" alt="Post image" class="post-image-thumbnail">` : '';
        return `
          <div class="chat-row left activity-post" data-post-id="${escapeHtml(item.id)}">
            <div class="chat-bubble">
              ${getAvatar(item.user)}
              <div class="bubble">
                <span class="user">${escapeHtml(item.user)}</span>
                <div class="post-embed">
                  <strong>${escapeHtml(item.title)}</strong>
                  <div class="post-meta">${escapeHtml(item.subject || 'General')} • ${ts}</div>
                  <div class="post-description-preview">${marked.parse((item.description || '').slice(0, 200) + ((item.description || '').length > 200 ? '...' : ''))}</div>
                  ${imageHtml}
                </div>
                <div class="post-actions">
                  <button class="view-post-btn" data-post-id="${escapeHtml(item.id)}">View Post</button>
                  <button class="copy-code-btn" data-post-id="${escapeHtml(item.id)}">Copy Code</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      if (item.type === 'comment') {
        const parent = state.posts.find(p => p.id === item.postId);
        return `
          <div class="chat-row left activity-comment" data-comment-id="${escapeHtml(item.id)}">
            <div class="chat-bubble">
              ${getAvatar(item.user)}
              <div class="bubble">
                <span class="user">${escapeHtml(item.user)}</span>
                <div class="reply-quote"><em>Reply to “${escapeHtml(parent?.title || 'a post')}”</em></div>
                <div class="text">${marked.parse(item.text || '')}</div>
                <span class="timestamp">${ts}</span>
              </div>
              <button class="delete-btn delete-comment" data-id="${escapeHtml(item.id)}" title="Delete">🗑️</button>
            </div>
          </div>
        `;
      }

      return '';
    }).join('');

    feed.innerHTML = html;
    feed.scrollTop = feed.scrollHeight;
  };

  const renderCoderoom = () => {
    const subjectList = document.getElementById('subject-list');
    const postGrid = document.getElementById('coderoom-posts-container');
    const postSort = document.getElementById('post-sort');
    const postSearch = document.getElementById('post-search');

    const subjects = getSubjects();
    subjectList.innerHTML = subjects.map(s => `
      <li class="${s === state.selectedSubject ? 'active' : ''}" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</li>
    `).join('');

    let filteredPosts = [...state.posts];
    if (state.selectedSubject && state.selectedSubject !== 'Favorites') {
      filteredPosts = filteredPosts.filter(p => p.subject === state.selectedSubject);
    } else if (state.selectedSubject === 'Favorites') {
      filteredPosts = filteredPosts.filter(p => state.favorites.includes(p.id));
    }

    const sorted = filteredPosts
      .filter(p => p.title.toLowerCase().includes((postSearch?.value || '').toLowerCase()))
      .sort((a, b) => {
        if (postSort?.value === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
        if (postSort?.value === 'az') return a.title.localeCompare(b.title);
        return new Date(b.timestamp) - new Date(a.timestamp); // latest
      });

    postGrid.innerHTML = sorted.map(post => `
      <div class="post-card" data-post-id="${escapeHtml(post.id)}">
        ${getAvatar(post.user)}
        <div class="post-card-content">
          <h4>${escapeHtml(post.title)}</h4>
          <p class="post-meta">${escapeHtml(post.subject || 'General')} • ${new Date(post.timestamp).toLocaleDateString()} • by ${escapeHtml(post.user)}</p>
          <div class="post-description-preview">${marked.parse((post.description || '').slice(0, 120) + ((post.description || '').length > 120 ? '...' : ''))}</div>
        </div>
        ${state.favorites.includes(post.id) ? '<span class="favorite-star">⭐</span>' : ''}
      </div>
    `).join('');
  };

  const renderSinglePost = () => {
    const post = state.posts.find(p => p.id === state.activePostId);
    const content = document.getElementById('post-detail-content');
    const commentFeed = document.getElementById('post-comments-feed');
    const favoriteBtn = document.getElementById('favorite-post-btn');

    if (!post) {
      content.innerHTML = `<h2>Post not found</h2>`;
      commentFeed.innerHTML = '';
      return;
    }

    const isFavorite = state.favorites.includes(post.id);
    favoriteBtn.textContent = isFavorite ? '🌟 Unfavorite' : '⭐ Favorite';
    const imageHtml = post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : '';

    content.innerHTML = `
      <div class="single-post-header" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        ${getAvatar(post.user)}
        <div>
          <div class="user">${escapeHtml(post.user)}</div>
          <div class="timestamp">${formatTS(post.timestamp)}</div>
        </div>
      </div>
      <h2 style="margin: 6px 0 8px 0;">${escapeHtml(post.title)}</h2>
      <p><strong>Subject:</strong> ${escapeHtml(post.subject || 'General')}</p>
      <p><strong>Language:</strong> ${escapeHtml(post.language || 'text')}</p>
      <div class="post-description">${marked.parse(post.description || '')}</div>
      ${imageHtml}
      <div class="code-section">
        <button class="copy-btn" data-code="${escapeHtml(post.code || '')}">Copy Code</button>
        <pre class="language-${escapeHtml(post.language || 'text')}"><code>${escapeHtml(post.code || '')}</code></pre>
      </div>
    `;

    const comments = state.comments
      .filter(c => c.postId === post.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    commentFeed.innerHTML = comments.map(c => `
      <div class="comment" data-comment-id="${escapeHtml(c.id)}" style="display:flex;gap:10px;align-items:flex-start;position:relative;background:var(--bg-tertiary);padding:10px;border-radius:10px;margin-bottom:10px;">
        ${getAvatar(c.user)}
        <div class="message-content">
          <span class="user">${escapeHtml(c.user)}</span>
          <div class="text">${marked.parse(c.text || '')}</div>
          <span class="timestamp">${formatTS(c.timestamp)}</span>
        </div>
        <button class="delete-btn delete-comment" data-id="${escapeHtml(c.id)}" title="Delete" style="position:absolute;top:6px;right:6px;background:none;border:none;color:var(--text-light);">🗑️</button>
      </div>
    `).join('');

    Prism.highlightAll();
  };

  // ---------- EVENTS ----------
  const setupEventListeners = () => {
    // Nav
    navLinks.chatroom.addEventListener('click', (e) => { e.preventDefault(); navigate('chatroom'); });
    navLinks.coderoom.addEventListener('click', (e) => { e.preventDefault(); navigate('coderoom'); });

    // Create Post
    document.getElementById('create-post-btn').addEventListener('click', () => {
      ensureUsername();
      state.isEditingPost = false;
      document.getElementById('post-modal-title').textContent = 'Create a New Post';
      document.getElementById('post-form').reset();
      const datalist = document.getElementById('subject-options');
      datalist.innerHTML = getSubjects().filter(s => s !== 'Favorites').map(s => `<option value="${escapeHtml(s)}"></option>`).join('');
      document.getElementById('post-modal').classList.add('visible');
    });

    // Close modal
    document.querySelector('#post-modal .modal-close').addEventListener('click', () => {
      document.getElementById('post-modal').classList.remove('visible');
    });
    document.getElementById('post-modal').addEventListener('click', (e) => {
      if (e.target.id === 'post-modal') e.target.classList.remove('visible');
    });

    // Login
    document.getElementById('set-username-btn').addEventListener('click', setUsername);

    // Chat submit
    document.getElementById('chat-input-form').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureUsername();
      if (!state.username) return;
      const input = document.getElementById('chat-message-input');
      const text = input.value.trim();
      if (!text) return;
      state.messages.push({
        id: 'msg_' + Date.now(),
        user: state.username,
        text,
        timestamp: new Date().toISOString()
      });
      input.value = '';
      saveData();
      render();
    });

    // Post form submit
    document.getElementById('post-form').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureUsername();
      if (!state.username) return;

      const title = document.getElementById('post-title').value.trim();
      const subject = document.getElementById('post-subject').value.trim() || 'General';
      const language = document.getElementById('post-language').value.trim() || 'text';
      const description = document.getElementById('post-description').value;
      const code = document.getElementById('post-code').value;
      const imageInput = document.getElementById('post-image');

      const handleImage = (callback) => {
        if (imageInput.files && imageInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => callback(ev.target.result);
          reader.readAsDataURL(imageInput.files[0]);
        } else callback(null);
      };

      handleImage((image) => {
        if (state.isEditingPost) {
          const post = state.posts.find(p => p.id === state.activePostId);
          if (post) {
            post.title = title;
            post.subject = subject;
            post.language = language;
            post.description = description;
            post.code = code;
            post.image = image || post.image;
            post.timestamp = new Date().toISOString();
          }
        } else {
          state.posts.push({
            id: 'post_' + Date.now