const state = {
  user: null,
  posts: [],
  activePage: 'landing',
};

const topNavButtons = [...document.querySelectorAll('.nav-link')];
const sidebarLinks = [...document.querySelectorAll('.sidebar-link')];
const pageMap = {
  landing: document.getElementById('landing-view'),
  auth: document.getElementById('auth-view'),
  dashboard: document.getElementById('dashboard-page'),
  content: document.getElementById('content-page'),
  calendar: document.getElementById('calendar-page'),
  analytics: document.getElementById('analytics-page'),
  profile: document.getElementById('profile-page'),
};

function setActivePage(pageName) {
  state.activePage = pageName;

  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `${pageName}-view` || (pageName === 'dashboard' && view.id === 'app-view'));
  });

  const mainView = document.getElementById('app-view');
  const authView = document.getElementById('auth-view');
  const landingView = document.getElementById('landing-view');

  if (pageName === 'landing') {
    landingView.classList.remove('hidden');
    authView.classList.add('hidden');
    mainView.classList.add('hidden');
    clearAuthMessage();
  } else if (pageName === 'auth') {
    authView.classList.remove('hidden');
    landingView.classList.add('hidden');
    mainView.classList.add('hidden');
    clearAuthMessage();
  } else {
    authView.classList.add('hidden');
    landingView.classList.add('hidden');
    mainView.classList.remove('hidden');
    clearAuthMessage();
  }

  document.querySelectorAll('.page').forEach((page) => {
    page.classList.toggle('active', page.id === `${pageName}-page`);
    page.classList.toggle('hidden', page.id !== `${pageName}-page`);
  });

  topNavButtons.forEach((button) => {
    const isActive = button.dataset.page === pageName;
    button.classList.toggle('active', isActive);
  });

  sidebarLinks.forEach((button) => {
    const isActive = button.dataset.page === pageName;
    button.classList.toggle('active', isActive);
  });
}

function clearAuthMessage() {
  const messageBox = document.getElementById('auth-message');
  if (!messageBox) return;
  messageBox.textContent = '';
  messageBox.classList.add('hidden');
  messageBox.classList.remove('error');
}

function showMessage(text, isError = false) {
  const messageBox = document.getElementById('auth-message');
  messageBox.textContent = text;
  messageBox.classList.toggle('error', isError);
  messageBox.classList.remove('hidden');
}

function showAuthForm(formId) {
  document.querySelectorAll('.auth-form').forEach((form) => {
    const isActive = form.id === formId;
    form.classList.toggle('active', isActive);
    form.classList.toggle('hidden', !isActive);
  });

  document.querySelectorAll('.tab-btn').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === formId.replace('-form', ''));
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Something went wrong.');
  }

  return payload;
}

function getIndianDateKey(dateValue) {
  const date = new Date(dateValue);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(dateString) {
  if (!dateString) return 'Not scheduled';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch {
    return 'Not scheduled';
  }
}

async function loadProfile() {
  try {
    const { user } = await fetchJson('/api/me');
    state.user = user;
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('logout-btn').classList.remove('hidden');
  } catch (error) {
    state.user = null;
    document.getElementById('logout-btn').classList.add('hidden');
    return;
  }
}

async function renderDashboard() {
  try {
    const data = await fetchJson('/api/dashboard');
    document.getElementById('total-count').textContent = data.total;
    document.getElementById('draft-count').textContent = data.drafts;
    document.getElementById('scheduled-count').textContent = data.scheduled;
    document.getElementById('published-count').textContent = data.publishedDemo;

    const recentPosts = data.recentPosts || [];
    const recentContainer = document.getElementById('recent-posts');
    recentContainer.innerHTML = recentPosts.length
      ? recentPosts
          .map(
            (post) => `
              <div class="post-item">
                <div>
                  <strong>${post.title}</strong>
                  <div class="post-item-meta">
                    <span class="badge">${post.platform}</span>
                    <span>${post.status}</span>
                  </div>
                </div>
                <div class="action-row">
                  <span>${formatDate(post.scheduled_at)}</span>
                  <button class="small-btn edit-btn" data-edit-dashboard-id="${post.id}">Edit</button>
                </div>
              </div>
            `
          )
          .join('')
      : '<p>No content yet. Create your first draft.</p>';

    document.querySelectorAll('[data-edit-dashboard-id]').forEach((button) => {
      button.addEventListener('click', () => {
        populateForm(Number(button.dataset.editDashboardId));
        setActivePage('content');
      });
    });
  } catch (error) {
    console.error(error);
  }
}

async function renderContentList() {
  try {
    const payload = await fetchJson('/api/posts');
    const posts = payload.posts || [];
    state.posts = posts;

    const contentList = document.getElementById('content-list');
    contentList.innerHTML = posts.length
      ? posts
          .map(
            (post) => `
              <div class="post-item">
                <div>
                  <strong>${post.title}</strong>
                  <div class="post-item-meta">
                    <span class="badge">${post.platform}</span>
                    <span>${post.status}</span>
                    <span>${formatDate(post.scheduled_at)}</span>
                  </div>
                </div>
                <div class="action-row">
                  <button class="small-btn edit-btn" data-edit-id="${post.id}">Edit</button>
                  <button class="small-btn delete-btn" data-delete-id="${post.id}">Delete</button>
                </div>
              </div>
            `
          )
          .join('')
      : '<p>No content posts yet.</p>';

    document.querySelectorAll('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', () => populateForm(Number(button.dataset.editId)));
    });

    document.querySelectorAll('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', () => deletePost(Number(button.dataset.deleteId)));
    });
  } catch (error) {
    console.error(error);
  }
}

async function renderCalendar() {
  try {
    const payload = await fetchJson('/api/calendar');
    const posts = payload.posts || [];
    const calendarList = document.getElementById('calendar-list');

    const monthDate = new Date();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    const monthLabel = new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(monthDate);

    const postsByDate = new Map();
    posts.forEach((post) => {
      const dateKey = getIndianDateKey(post.scheduled_at);
      const existing = postsByDate.get(dateKey) || [];
      existing.push(post);
      postsByDate.set(dateKey, existing);
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const header = dayNames.map((day) => `<div class="calendar-head">${day}</div>`).join('');

    const cells = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - startOffset + 1;
      const cellDate = new Date(year, month, dayNumber);
      const key = getIndianDateKey(cellDate);
      const datePosts = postsByDate.get(key) || [];
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = key === getIndianDateKey(new Date());

      cells.push(`
        <div class="calendar-day ${isCurrentMonth ? 'current-month' : 'muted-day'} ${isToday ? 'today' : ''}">
          <div class="calendar-day-number">${cellDate.getDate()}</div>
          <div class="calendar-day-events">
            ${datePosts
              .slice(0, 2)
              .map(
                (post) => `<div class="calendar-event">${post.title}</div>`
              )
              .join('')}
            ${datePosts.length > 2 ? `<div class="calendar-more">+${datePosts.length - 2}</div>` : ''}
          </div>
        </div>
      `);
    }

    calendarList.innerHTML = `
      <div class="calendar-shell">
        <div class="calendar-month-label">${monthLabel}</div>
        <div class="calendar-grid-header">${header}</div>
        <div class="calendar-grid">${cells.join('')}</div>
      </div>
    `;
  } catch (error) {
    console.error(error);
  }
}

async function renderAnalytics() {
  try {
    const data = await fetchJson('/api/analytics');
    document.getElementById('analytics-total').textContent = data.summary.totalPosts;
    document.getElementById('analytics-scheduled').textContent = data.summary.scheduledCount;
    document.getElementById('analytics-published').textContent = data.summary.publishedDemoCount;

    const chartBars = document.getElementById('chart-bars');
    const maxValue = Math.max(...(data.chartData || []).map((item) => item.value), 1);
    chartBars.innerHTML = (data.chartData || [])
      .map(
        (item) => `
          <div class="chart-bar">
            <div class="chart-bar-fill" style="height:${Math.max((item.value / maxValue) * 150, 26)}px"></div>
            <div>${item.label}</div>
            <strong>${item.value}</strong>
          </div>
        `
      )
      .join('');
  } catch (error) {
    console.error(error);
  }
}

async function loadAppData() {
  await loadProfile();
  if (state.user) {
    renderDashboard();
    renderContentList();
    renderCalendar();
    renderAnalytics();
    setActivePage('dashboard');
    document.getElementById('landing-view').classList.add('hidden');
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
  } else {
    setActivePage('landing');
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('register-name').value,
    email: document.getElementById('register-email').value,
    password: document.getElementById('register-password').value,
  };

  try {
    const result = await fetchJson('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.user = result.user;
    document.getElementById('register-form').reset();
    await loadAppData();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const payload = {
    email: document.getElementById('login-email').value,
    password: document.getElementById('login-password').value,
  };

  try {
    const result = await fetchJson('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.user = result.user;
    document.getElementById('login-form').reset();
    await loadAppData();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function handleLogout() {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
    state.user = null;
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    setActivePage('landing');
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('landing-view').classList.remove('hidden');
  } catch (error) {
    console.error(error);
  }
}

function resetPostForm() {
  document.getElementById('post-form').reset();
  document.getElementById('post-id').value = '';
}

function populateForm(postId) {
  const post = state.posts.find((item) => item.id === postId);
  if (!post) return;

  document.getElementById('post-id').value = post.id;
  document.getElementById('post-title').value = post.title || '';
  document.getElementById('post-body').value = post.body || '';
  document.getElementById('post-platform').value = post.platform || 'YouTube';
  document.getElementById('post-status').value = post.status || 'Idea';
  document.getElementById('post-date').value = post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '';
  setActivePage('content');
}

async function savePost(event) {
  event.preventDefault();

  const id = document.getElementById('post-id').value;
  const payload = {
    title: document.getElementById('post-title').value,
    body: document.getElementById('post-body').value,
    platform: document.getElementById('post-platform').value,
    status: document.getElementById('post-status').value,
    scheduled_at: document.getElementById('post-date').value || null,
  };

  try {
    if (id) {
      await fetchJson(`/api/posts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await fetchJson('/api/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    resetPostForm();
    await renderDashboard();
    await renderContentList();
    await renderCalendar();
    await renderAnalytics();
    setActivePage('dashboard');
  } catch (error) {
    alert(error.message);
  }
}

async function deletePost(postId) {
  try {
    await fetchJson(`/api/posts/${postId}`, { method: 'DELETE' });
    await renderDashboard();
    await renderContentList();
    await renderCalendar();
    await renderAnalytics();
  } catch (error) {
    alert(error.message);
  }
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value;
  const email = document.getElementById('profile-email').value;

  try {
    const response = await fetchJson('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ name, email }),
    });

    state.user = response.user;
    document.getElementById('profile-name').value = response.user.name;
    document.getElementById('profile-email').value = response.user.email;
    alert(response.message);
  } catch (error) {
    alert(error.message);
  }
}

function wireEvents() {
  topNavButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      if (page === 'landing') {
        setActivePage('landing');
        return;
      }
      if (!state.user) {
        setActivePage('auth');
        return;
      }
      setActivePage(page);
    });
  });

  sidebarLinks.forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.user) {
        setActivePage('auth');
        return;
      }
      setActivePage(button.dataset.page);
    });
  });

  document.getElementById('show-login').addEventListener('click', () => {
    setActivePage('auth');
    document.querySelector('[data-tab="login"]').click();
  });

  document.getElementById('show-register').addEventListener('click', () => {
    setActivePage('auth');
    document.querySelector('[data-tab="register"]').click();
  });

  document.getElementById('hero-login').addEventListener('click', () => {
    setActivePage('auth');
    document.querySelector('[data-tab="login"]').click();
  });

  document.getElementById('hero-signup').addEventListener('click', () => {
    setActivePage('auth');
    document.querySelector('[data-tab="register"]').click();
  });

  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      showAuthForm(`${target}-form`);
    });
  });

  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('post-form').addEventListener('submit', savePost);
  document.getElementById('cancel-post-btn').addEventListener('click', resetPostForm);
  document.getElementById('new-post-btn').addEventListener('click', () => {
    resetPostForm();
    setActivePage('content');
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
}

wireEvents();
loadAppData();
