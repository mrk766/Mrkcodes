document.addEventListener('DOMContentLoaded', () => {
  // State Management
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

  // DOM Elements
  const views = {
    chatroom: document.getElementById('chatroom-view'),
    coderoom: document.getElementById('coderoom-view'),
    singlePost: document.getElementById('single-post-view'),
  };

  const navLinks = {
    chatroom: document.getElementById('nav-chatroom'),
    coderoom: document.getElementById('nav-coderoom'),
  };

  // Utility Functions
  const saveData = () => {
    localStorage.setItem('devhub_posts', JSON.stringify(state.posts));
    localStorage.setItem('devhub_messages', JSON.stringify(state.messages));
    localStorage.setItem('devhub_comments', JSON.stringify(state.comments));
    localStorage.setItem('devhub_favorites', JSON.stringify(state.favorites));
  };

  const escapeHtml = (unsafe) =>
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
      setTimeout(() => notify.classList.remove('show'), 2000);
    });
  };

  const getSubjects = () => [...new Set(state.posts.map(p => p.subject)), 'Favorites'];

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
    }
  };

  const navigate = (view, postId = null, subject = null) => {
    state.currentView = view;
    state.activePostId = postId;
    state.selectedSubject = subject;
    render();
  };

  // View Switching
  const switchView = () => {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(navLinks).forEach(l => l.classList.remove('active'));
    views[state.currentView].classList.add('active');
    if (state.currentView === 'chatroom') navLinks.chatroom.classList.add('active');
    if (state.currentView === 'coderoom') navLinks.coderoom.classList.add('active');
  };

  // Rendering Functions
  const render = () => {
    switchView();
    if (state.currentView === 'chatroom') renderChatroom();
    if (state.currentView === 'coderoom') renderCoderoom();
    if (state.currentView === 'singlePost') renderSinglePost();
  };

  const getAvatar = (user) => {
    const color = '#' + ((Math.abs(user.charCodeAt(0) * user.length) % 0xffffff) | 0).toString(16).padStart(6, '0');
    return `<span class="avatar" style="background-color: ${color};">${user[0].toUpperCase()}</span>`;
  };

  const renderChatroom = () => {
    const feed = document.getElementById('chat-feed');
    const search = document.getElementById('chat-search')?.value.toLowerCase() || '';
    const filteredMessages = state.messages
      .filter(msg => (msg.user + ' ' + msg.text).toLowerCase().includes(search))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    feed.innerHTML = filteredMessages.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      const avatar = getAvatar(msg.user);
      return `
        <div class="chat-message me" data-msg-id="${msg.id}">
          ${avatar}
          <div class="message-content">
            <span class="user">${escapeHtml(msg.user)}</span>
            <div class="text">${marked.parse(msg.text)}</div>
            <span class="timestamp">${timestamp}</span>
          </div>
          <button class="delete-btn delete-msg" data-id="${msg.id}">🗑️</button>
        </div>`;
    }).join('');

    feed.scrollTop = feed.scrollHeight;
  };

  const renderCoderoom = () => {
    const subjectList = document.getElementById('subject-list');
    const postGrid = document.getElementById('coderoom-posts-container');
    const postSort = document.getElementById('post-sort');
    const postSearch = document.getElementById('post-search');

    const subjects = getSubjects();
    subjectList.innerHTML = subjects.map(s =>
      `<li class="${s === state.selectedSubject ? 'active' : ''}" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</li>`).join('');

    let filteredPosts = state.posts;
    if (state.selectedSubject && state.selectedSubject !== 'Favorites') {
      filteredPosts = filteredPosts.filter(p => p.subject === state.selectedSubject);
    } else if (state.selectedSubject === 'Favorites') {
      filteredPosts = filteredPosts.filter(p => state.favorites.includes(p.id));
    }

    const sorted = [...filteredPosts].sort((a, b) => {
      if (postSort.value === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp);
      if (postSort.value === 'az') return a.title.localeCompare(b.title);
      return new Date(b.timestamp) - new Date(a.timestamp); // latest
    }).filter(p => p.title.toLowerCase().includes(postSearch.value.toLowerCase()));

    postGrid.innerHTML = sorted.map(post => `
      <div class="post-card" data-post-id="${post.id}">
        ${getAvatar(post.user)}
        <div class="post-card-content">
          <h4>${escapeHtml(post.title)}</h4>
          <p class="post-meta">${escapeHtml(post.subject)} • ${new Date(post.timestamp).toLocaleDateString()} • by ${escapeHtml(post.user)}</p>
          <div class="post-description-preview">${marked.parse(post.description.slice(0, 100) + (post.description.length > 100 ? '...' : ''))}</div>
          ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image-thumbnail">` : ''}
        </div>
        ${state.favorites.includes(post.id) ? '<span class="favorite-star">⭐</span>' : ''}
      </div>`).join('');
  };

  const renderSinglePost = () => {
    const post = state.posts.find(p => p.id === state.activePostId);
    const content = document.getElementById('post-detail-content');
    const commentFeed = document.getElementById('post-comments-feed');
    const favoriteBtn = document.getElementById('favorite-post-btn');
    if (!post) return content.innerHTML = `<h2>Post not found</h2>`;

    const isFavorite = state.favorites.includes(post.id);
    favoriteBtn.textContent = isFavorite ? '🌟 Unfavorite' : '⭐ Favorite';
    const imageHtml = post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : '';

    content.innerHTML = `
      <div class="single-post-header">
        ${getAvatar(post.user)}
        <span class="user">${escapeHtml(post.user)}</span>
        <span class="timestamp">${new Date(post.timestamp).toLocaleString()}</span>
      </div>
      <h2>${escapeHtml(post.title)}</h2>
      <p><strong>Subject:</strong> ${escapeHtml(post.subject)}</p>
      <p><strong>Language:</strong> ${escapeHtml(post.language)}</p>
      <div class="post-description">${marked.parse(post.description)}</div>
      ${imageHtml}
      <div class="code-section">
        <button class="copy-btn" data-code="${escapeHtml(post.code)}">Copy Code</button>
        <pre class="language-${escapeHtml(post.language || 'text')}"><code>${escapeHtml(post.code)}</code></pre>
      </div>`;

    const comments = state.comments.filter(c => c.postId === post.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    commentFeed.innerHTML = comments.map(c => `
      <div class="comment" data-comment-id="${c.id}">
        ${getAvatar(c.user)}
        <div class="message-content">
          <span class="user">${escapeHtml(c.user)}</span>
          <div class="text">${marked.parse(c.text)}</div>
          <span class="timestamp">${new Date(c.timestamp).toLocaleString()}</span>
        </div>
        <button class="delete-btn delete-comment" data-id="${c.id}">🗑️</button>
      </div>`).join('');

    Prism.highlightAll();
  };

  // Event Listeners Setup
  const setupEventListeners = () => {
    navLinks.chatroom.addEventListener('click', (e) => {
      e.preventDefault(); navigate('chatroom');
    });

    navLinks.coderoom.addEventListener('click', (e) => {
      e.preventDefault(); navigate('coderoom');
    });

    document.getElementById('create-post-btn').addEventListener('click', () => {
      ensureUsername();
      state.isEditingPost = false;
      document.getElementById('post-modal-title').textContent = 'Create a New Post';
      document.getElementById('post-form').reset();
      const datalist = document.getElementById('subject-options');
      datalist.innerHTML = getSubjects().filter(s => s !== 'Favorites').map(s => `<option value="${escapeHtml(s)}"></option>`).join('');
      document.getElementById('post-modal').classList.add('visible');
    });

    document.querySelector('.modal-close').addEventListener('click', () => {
      document.getElementById('post-modal').classList.remove('visible');
    });

    document.getElementById('post-modal').addEventListener('click', (e) => {
      if (e.target.id === 'post-modal') {
        e.target.classList.remove('visible');
      }
    });

    document.getElementById('chat-input-form').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureUsername();
      const input = document.getElementById('chat-message-input');
      const text = input.value.trim();
      if (!text) return;
      state.messages.push({
        id: `msg_${Date.now()}`,
        user: state.username,
        text,
        timestamp: new Date().toISOString()
      });
      input.value = '';
      saveData();
      render();
    });

    document.getElementById('post-form').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureUsername();
      const title = document.getElementById('post-title').value.trim();
      const subject = document.getElementById('post-subject').value.trim();
      const language = document.getElementById('post-language').value.trim();
      const description = document.getElementById('post-description').value;
      const code = document.getElementById('post-code').value;
      const imageInput = document.getElementById('post-image');
      const handleImage = (callback) => {
        if (imageInput.files && imageInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => callback(ev.target.result);
          reader.readAsDataURL(imageInput.files[0]);
        } else {
          callback(null);
        }
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
          saveData();
          document.getElementById('post-modal').classList.remove('visible');
          e.target.reset();
          render();
        } else {
          const newPost = {
            id: `post_${Date.now()}`,
            user: state.username,
            title,
            subject,
            language,
            description,
            code,
            image,
            timestamp: new Date().toISOString()
          };
          state.posts.push(newPost);
          saveData();
          document.getElementById('post-modal').classList.remove('visible');
          e.target.reset();
          navigate('coderoom');
        }
      });
    });

    document.getElementById('comment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureUsername();
      const text = document.getElementById('comment-input').value.trim();
      if (!text) return;
      state.comments.push({
        id: `c_${Date.now()}`,
        postId: state.activePostId,
        user: state.username,
        text,
        timestamp: new Date().toISOString()
      });
      saveData();
      document.getElementById('comment-input').value = '';
      render();
    });

    document.getElementById('edit-post-btn')?.addEventListener('click', () => {
      const post = state.posts.find(p => p.id === state.activePostId);
      if (post) {
        state.isEditingPost = true;
        document.getElementById('post-modal-title').textContent = 'Edit Post';
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-subject').value = post.subject;
        document.getElementById('post-language').value = post.language;
        document.getElementById('post-description').value = post.description;
        document.getElementById('post-code').value = post.code;
        const datalist = document.getElementById('subject-options');
        datalist.innerHTML = getSubjects().filter(s => s !== 'Favorites').map(s => `<option value="${escapeHtml(s)}"></option>`).join('');
        document.getElementById('post-modal').classList.add('visible');
      }
    });

    document.getElementById('delete-post-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this post?')) {
        state.posts = state.posts.filter(p => p.id !== state.activePostId);
        state.comments = state.comments.filter(c => c.postId !== state.activePostId);
        state.favorites = state.favorites.filter(id => id !== state.activePostId);
        saveData();
        navigate('coderoom');
      }
    });

    document.getElementById('favorite-post-btn')?.addEventListener('click', () => {
      const index = state.favorites.indexOf(state.activePostId);
      if (index === -1) {
        state.favorites.push(state.activePostId);
      } else {
        state.favorites.splice(index, 1);
      }
      saveData();
      render();
    });

    document.body.addEventListener('click', (e) => {
      const target = e.target;
      const postId = target.dataset.postId || target.closest('[data-post-id]')?.dataset.postId;
      const id = target.dataset.id;

      if (target.matches('.view-post-btn') || target.closest('.post-card')) {
        if (postId) navigate('singlePost', postId);
      }
      if (target.matches('.copy-code-btn') || target.matches('.copy-btn')) {
        const code = target.dataset.code || state.posts.find(p => p.id === postId)?.code;
        if (code) copyToClipboard(code);
      }
      if (target.closest('#subject-list li')) {
        const subject = target.dataset.subject;
        navigate('coderoom', null, subject);
      }
      if (target.matches('.delete-msg')) {
        state.messages = state.messages.filter(m => m.id !== id);
        saveData();
        render();
      }
      if (target.matches('.delete-comment')) {
        state.comments = state.comments.filter(c => c.id !== id);
        saveData();
        render();
      }
    });

    document.getElementById('post-sort')?.addEventListener('change', render);
    document.getElementById('post-search')?.addEventListener('input', render);
    document.getElementById('chat-search')?.addEventListener('input', render);
    document.getElementById('subject-search')?.addEventListener('input', (e) => {
      const filter = e.target.value.toLowerCase();
      const allSubs = document.querySelectorAll('#subject-list li');
      allSubs.forEach(li => {
        li.style.display = li.dataset.subject.toLowerCase().includes(filter) ? 'block' : 'none';
      });
    });

    document.getElementById('set-username-btn').addEventListener('click', setUsername);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem('devhub_theme', isDark ? 'dark' : 'light');
    });

    document.getElementById('back-to-coderoom-btn')?.addEventListener('click', () => {
      navigate('coderoom');
    });

    document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
      document.querySelector('.coderoom-sidebar').classList.toggle('active');
    });
  };

  // Theme Loading
  const loadTheme = () => {
    const stored = localStorage.getItem('devhub_theme');
    if (stored === 'dark') {
      document.body.classList.add('dark-mode');
      document.getElementById('theme-toggle').textContent = '☀️';
    }
  };

  // Initialization
  const init = () => {
    loadTheme();
    setupEventListeners();
    render();
    if (!state.username) {
      ensureUsername();
    }
  };

  init();
});
