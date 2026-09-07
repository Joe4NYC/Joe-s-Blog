import { renderMarkdown } from './markdown.js';

/* ------------------------------------------------------------------ *
 * API
 * ------------------------------------------------------------------ */

const BASE = '/api/admin';

async function request(path, options = {}) {
	const response = await fetch(BASE + path, {
		credentials: 'same-origin',
		...options,
		headers: {
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers ?? {}),
		},
	});

	let payload = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (response.status === 401) {
		state.user = null;
		showLogin('登入已過期，請重新登入。');
		throw new Error('unauthenticated');
	}

	if (!response.ok || payload?.ok === false) {
		throw new Error(payload?.error || `請求失敗（${response.status}）`);
	}

	return payload ?? {};
}

const api = {
	session: () => request('/session'),
	login: (password) => request('/login', { method: 'POST', body: JSON.stringify({ password }) }),
	logout: () => request('/logout', { method: 'POST' }),
	overview: () => request('/overview'),
	listPosts: () => request('/posts'),
	readPost: (filename) => request(`/posts/${encodeURIComponent(filename)}`),
	createPost: (data) => request('/posts', { method: 'POST', body: JSON.stringify(data) }),
	updatePost: (filename, data) =>
		request(`/posts/${encodeURIComponent(filename)}`, { method: 'PUT', body: JSON.stringify(data) }),
	deletePost: (filename) => request(`/posts/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
	listMedia: () => request('/media'),
	uploadMedia: (data) => request('/media', { method: 'POST', body: JSON.stringify(data) }),
	deleteMedia: (path) => request(`/media?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
	readSettings: () => request('/settings'),
	writeSettings: (settings, sha) => request('/settings', { method: 'PUT', body: JSON.stringify({ settings, sha }) }),
	deployStatus: () => request('/deploy'),
	deploy: () => request('/deploy', { method: 'POST' }),
};

/* ------------------------------------------------------------------ *
 * 共用工具
 * ------------------------------------------------------------------ */

const state = {
	user: null,
	posts: null,
	media: null,
	settings: null,
	settingsSha: null,
	overview: null,
	postFilter: 'all',
	postSearch: '',
	editor: null,
	dirty: false,
};

const view = () => document.getElementById('view');

function esc(value) {
	return String(value ?? '').replace(
		/[&<>"']/g,
		(character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
	);
}

function toast(message, kind = '') {
	const node = document.createElement('div');
	node.className = `toast ${kind}`;
	node.textContent = message;
	document.getElementById('toasts').append(node);
	setTimeout(() => node.remove(), kind === 'error' ? 7000 : 3800);
}

function formatDate(value) {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) return value;
	// 文章日期一律以 UTC+8 儲存，顯示時也固定用香港時間，人在國外時才不會看到位移過的時間。
	return new Intl.DateTimeFormat('zh-TW', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'Asia/Hong_Kong',
	}).format(date);
}

function formatSize(bytes) {
	if (!bytes) return '—';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** frontmatter 的 +08:00 字串 ↔ datetime-local 的值。 */
function toLocalInput(value) {
	if (!value) return '';
	const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
	return match ? `${match[1]}T${match[2]}` : '';
}

function fromLocalInput(value) {
	return value ? `${value}:00+08:00` : '';
}

function nowLocalInput() {
	const now = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60_000);
	const pad = (input) => String(input).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

async function confirmDialog(title, message, confirmLabel = '確定') {
	return new Promise((resolve) => {
		const root = document.getElementById('modal-root');
		root.innerHTML = `
			<div class="modal-backdrop">
				<div class="modal" style="width:min(420px,100%)">
					<header><h2>${esc(title)}</h2></header>
					<div class="modal-body">${esc(message)}</div>
					<footer>
						<button data-act="cancel">取消</button>
						<button class="danger" data-act="ok">${esc(confirmLabel)}</button>
					</footer>
				</div>
			</div>`;

		const close = (result) => {
			root.innerHTML = '';
			resolve(result);
		};

		root.querySelector('[data-act="cancel"]').onclick = () => close(false);
		root.querySelector('[data-act="ok"]').onclick = () => close(true);
		root.querySelector('.modal-backdrop').onclick = (event) => {
			if (event.target === event.currentTarget) close(false);
		};
	});
}

function loading(message = '載入中…') {
	view().innerHTML = `<div class="card"><div class="empty"><span class="spinner"></span> ${esc(message)}</div></div>`;
}

function errorPanel(error) {
	view().innerHTML = `<div class="notice error">${esc(error.message || String(error))}</div>`;
}

/* ------------------------------------------------------------------ *
 * 登入
 * ------------------------------------------------------------------ */

function showLogin(message) {
	document.getElementById('app-view').hidden = true;
	const loginView = document.getElementById('login-view');
	loginView.hidden = false;

	const errorBox = document.getElementById('login-error');
	errorBox.hidden = !message;
	if (message) errorBox.textContent = message;
	document.getElementById('login-password').focus();
}

function showApp() {
	document.getElementById('login-view').hidden = true;
	document.getElementById('app-view').hidden = false;
}

document.getElementById('login-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const button = document.getElementById('login-submit');
	const password = document.getElementById('login-password').value;

	button.disabled = true;
	button.innerHTML = '<span class="spinner"></span> 登入中…';

	try {
		const result = await api.login(password);
		state.user = result.user;
		document.getElementById('login-password').value = '';
		document.getElementById('login-error').hidden = true;
		showApp();
		navigate(location.hash || '#/dashboard');
	} catch (error) {
		document.getElementById('login-error').hidden = false;
		document.getElementById('login-error').textContent = error.message;
	} finally {
		button.disabled = false;
		button.textContent = '登入';
	}
});

/* ------------------------------------------------------------------ *
 * 儀表板
 * ------------------------------------------------------------------ */

function deployBadge(run) {
	if (!run) return '<span class="badge">尚無紀錄</span>';
	if (run.status !== 'completed') return '<span class="badge draft">進行中</span>';
	if (run.conclusion === 'success') return '<span class="badge published">成功</span>';
	return `<span class="badge error">${esc(run.conclusion || '失敗')}</span>`;
}

async function renderDashboard() {
	loading();

	try {
		state.overview = await api.overview();
	} catch (error) {
		errorPanel(error);
		return;
	}

	const { counts, recent, broken, latestDeploy, repo } = state.overview;
	document.getElementById('brand-repo').textContent = `${repo.owner}/${repo.name} · ${repo.branch}`;

	view().innerHTML = `
		<div class="stats">
			<div class="stat"><div class="value">${counts.published}</div><div class="label">已發佈文章</div></div>
			<div class="stat"><div class="value">${counts.drafts}</div><div class="label">草稿</div></div>
			<div class="stat"><div class="value">${counts.categories}</div><div class="label">分類</div></div>
			<div class="stat"><div class="value">${counts.tags}</div><div class="label">標籤</div></div>
		</div>

		${
			counts.broken > 0
				? `<div class="notice warn">有 ${counts.broken} 篇文章的 frontmatter 無法解析：${broken
						.map((post) => esc(post.filename))
						.join('、')}。這些文章可能會讓建置失敗，建議盡快修正。</div>`
				: ''
		}

		<div class="card">
			<div class="card-head">
				<h2>最近的文章</h2>
				<a class="btn small right" href="#/posts">全部文章</a>
				<a class="btn small primary" href="#/posts/new">新增文章</a>
			</div>
			${
				recent.length === 0
					? '<div class="empty">還沒有文章，先寫第一篇吧。</div>'
					: `<table>
							<thead><tr><th>標題</th><th style="width:90px">狀態</th><th style="width:150px">發佈時間</th></tr></thead>
							<tbody>
								${recent
									.map(
										(post) => `
											<tr>
												<td>
													<a class="row-title" href="#/posts/edit/${encodeURIComponent(post.filename)}">${esc(post.title)}</a>
													<div class="row-sub">${esc(post.excerpt || post.filename)}</div>
												</td>
												<td>${post.error ? '<span class="badge error">解析失敗</span>' : post.draft ? '<span class="badge draft">草稿</span>' : '<span class="badge published">已發佈</span>'}</td>
												<td class="muted">${esc(formatDate(post.date))}</td>
											</tr>`,
									)
									.join('')}
							</tbody>
						</table>`
			}
		</div>

		<div class="card">
			<div class="card-head"><h2>最近一次部署</h2><a class="btn small right" href="#/deploy">部署紀錄</a></div>
			<div class="card-body">
				${
					latestDeploy
						? `<p>${deployBadge(latestDeploy)} <strong>${esc(latestDeploy.name)}</strong>
							<span class="muted">· ${esc(formatDate(latestDeploy.updatedAt))}</span>
							<a href="${esc(latestDeploy.url)}" target="_blank" rel="noopener">在 GitHub 查看 ↗</a></p>`
						: '<p class="muted">還沒有部署紀錄。把 deploy.yml 推上 GitHub 並設定好 Cloudflare 金鑰後，這裡就會顯示狀態。</p>'
				}
			</div>
		</div>`;
}

/* ------------------------------------------------------------------ *
 * 文章列表
 * ------------------------------------------------------------------ */

async function loadPosts(force = false) {
	if (!state.posts || force) state.posts = (await api.listPosts()).posts;
	return state.posts;
}

async function renderPosts() {
	loading();

	try {
		await loadPosts(true);
	} catch (error) {
		errorPanel(error);
		return;
	}

	view().innerHTML = `
		<div class="toolbar">
			<div class="tabs" id="post-tabs">
				<button data-filter="all">全部</button>
				<button data-filter="published">已發佈</button>
				<button data-filter="draft">草稿</button>
			</div>
			<div class="grow"><input type="search" id="post-search" placeholder="搜尋標題、標籤或分類…" /></div>
			<a class="btn primary" href="#/posts/new">新增文章</a>
		</div>
		<div class="card" id="post-table"></div>`;

	const searchInput = document.getElementById('post-search');
	searchInput.value = state.postSearch;
	searchInput.addEventListener('input', () => {
		state.postSearch = searchInput.value;
		paintPostTable();
	});

	document.getElementById('post-tabs').addEventListener('click', (event) => {
		const button = event.target.closest('button[data-filter]');
		if (!button) return;
		state.postFilter = button.dataset.filter;
		paintPostTable();
	});

	paintPostTable();
}

function filteredPosts() {
	const keyword = state.postSearch.trim().toLowerCase();

	return (state.posts ?? []).filter((post) => {
		if (state.postFilter === 'published' && (post.draft || post.error)) return false;
		if (state.postFilter === 'draft' && !post.draft) return false;
		if (!keyword) return true;

		return [post.title, post.filename, ...(post.tags ?? []), ...(post.categories ?? [])]
			.join(' ')
			.toLowerCase()
			.includes(keyword);
	});
}

function paintPostTable() {
	for (const button of document.querySelectorAll('#post-tabs button')) {
		button.classList.toggle('active', button.dataset.filter === state.postFilter);
	}

	const posts = filteredPosts();
	const container = document.getElementById('post-table');

	if (posts.length === 0) {
		container.innerHTML = '<div class="empty">沒有符合條件的文章。</div>';
		return;
	}

	container.innerHTML = `
		<table>
			<thead>
				<tr>
					<th>標題</th>
					<th style="width:90px">狀態</th>
					<th style="width:130px">分類</th>
					<th style="width:200px">標籤</th>
					<th style="width:150px">發佈時間</th>
				</tr>
			</thead>
			<tbody>
				${posts
					.map(
						(post) => `
							<tr>
								<td>
									<a class="row-title" href="#/posts/edit/${encodeURIComponent(post.filename)}">${esc(post.title)}</a>
									<div class="row-sub mono">${esc(post.filename)}</div>
									${post.error ? `<div class="row-sub" style="color:var(--danger)">${esc(post.error)}</div>` : ''}
									<div class="row-actions">
										<a class="btn small" href="#/posts/edit/${encodeURIComponent(post.filename)}">編輯</a>
										${post.draft ? '' : `<a class="btn small" href="${esc(post.url)}" target="_blank" rel="noopener">檢視</a>`}
										<button class="small danger" data-delete="${esc(post.filename)}">刪除</button>
									</div>
								</td>
								<td>${post.error ? '<span class="badge error">解析失敗</span>' : post.draft ? '<span class="badge draft">草稿</span>' : '<span class="badge published">已發佈</span>'}</td>
								<td>${(post.categories ?? []).map((item) => `<span class="badge tag">${esc(item)}</span>`).join('') || '<span class="muted">—</span>'}</td>
								<td>${(post.tags ?? []).map((item) => `<span class="badge tag">${esc(item)}</span>`).join('') || '<span class="muted">—</span>'}</td>
								<td class="muted">${esc(formatDate(post.date))}</td>
							</tr>`,
					)
					.join('')}
			</tbody>
		</table>`;

	// 用 onclick 覆寫而非 addEventListener，避免每次重繪都疊加一個處理器。
	container.onclick = async (event) => {
		const button = event.target.closest('button[data-delete]');
		if (!button) return;

		const filename = button.dataset.delete;
		if (!(await confirmDialog('刪除文章', `確定要刪除 ${filename} 嗎？這會直接從 GitHub 移除檔案。`, '刪除'))) return;

		button.disabled = true;
		try {
			await api.deletePost(filename);
			toast('文章已刪除', 'success');
			await loadPosts(true);
			paintPostTable();
		} catch (error) {
			toast(error.message, 'error');
			button.disabled = false;
		}
	};
}

/* ------------------------------------------------------------------ *
 * 編輯器
 * ------------------------------------------------------------------ */

function collectKnownTerms() {
	const tags = new Set();
	const categories = new Set();

	for (const post of state.posts ?? []) {
		for (const tag of post.tags ?? []) tags.add(tag);
		for (const category of post.categories ?? []) categories.add(category);
	}

	return { tags: [...tags].sort(), categories: [...categories].sort() };
}

async function renderEditor(filename) {
	loading(filename ? '載入文章…' : '準備編輯器…');

	let post;
	try {
		await loadPosts();
		post = filename
			? (await api.readPost(filename)).post
			: {
					filename: '',
					sha: null,
					title: '',
					date: fromLocalInput(nowLocalInput()),
					description: '',
					draft: true,
					categories: [],
					tags: [],
					body: '',
					url: '',
				};
	} catch (error) {
		errorPanel(error);
		return;
	}

	state.editor = {
		original: post,
		filename: post.filename,
		sha: post.sha,
		tags: [...(post.tags ?? [])],
		categories: [...(post.categories ?? [])],
		isNew: !filename,
	};
	state.dirty = false;

	const known = collectKnownTerms();

	view().innerHTML = `
		<div class="editor">
			<div>
				<div class="field editor-title">
					<input type="text" id="post-title" placeholder="文章標題" value="${esc(post.title)}" />
				</div>

				<div class="md-toolbar" id="md-toolbar">
					<button type="button" data-md="h2" title="標題">H2</button>
					<button type="button" data-md="h3" title="小標題">H3</button>
					<span class="sep"></span>
					<button type="button" data-md="bold" title="粗體"><strong>B</strong></button>
					<button type="button" data-md="italic" title="斜體"><em>I</em></button>
					<button type="button" data-md="strike" title="刪除線"><del>S</del></button>
					<span class="sep"></span>
					<button type="button" data-md="link">連結</button>
					<button type="button" data-md="image">圖片</button>
					<button type="button" data-md="code">程式碼</button>
					<button type="button" data-md="quote">引用</button>
					<button type="button" data-md="ul">清單</button>
					<button type="button" data-md="ol">編號</button>
					<button type="button" data-md="table">表格</button>
					<button type="button" data-md="hr">分隔線</button>
					<button type="button" data-md="more" title="列表頁摘要分界">摘要線</button>
					<span class="right"></span>
					<button type="button" id="toggle-preview">預覽開關</button>
				</div>

				<div class="md-panes" id="md-panes">
					<textarea id="post-body" spellcheck="false" placeholder="用 Markdown 開始寫…">${esc(post.body)}</textarea>
					<div class="md-preview" id="md-preview"></div>
				</div>
				<p class="hint muted" style="font-size:12px">Ctrl / ⌘ + S 儲存。圖片可直接貼上或拖進編輯區自動上傳。</p>
			</div>

			<aside>
				<div class="side-box">
					<h3>發佈</h3>
					<div class="side-body">
						<div class="field">
							<label class="switch"><input type="checkbox" id="post-draft" ${post.draft ? 'checked' : ''} /> 儲存為草稿</label>
							<div class="hint">草稿不會出現在正式網站上。</div>
						</div>
						<div class="field">
							<label for="post-date">發佈時間</label>
							<input type="datetime-local" id="post-date" value="${esc(toLocalInput(post.date))}" />
						</div>
						<div class="side-actions">
							<button class="primary" id="btn-save">${state.editor.isNew ? '建立文章' : '儲存'}</button>
							${state.editor.isNew ? '' : '<button id="btn-delete" class="danger">刪除</button>'}
						</div>
						${
							state.editor.isNew
								? ''
								: `<p class="hint mono" style="margin-top:10px">${esc(post.filename)}</p>
									<p class="hint"><a href="${esc(post.url)}" target="_blank" rel="noopener">在網站上檢視 ↗</a>（需部署後生效）</p>`
						}
					</div>
				</div>

				<div class="side-box">
					<h3>分類</h3>
					<div class="side-body">
						<input type="text" id="category-input" list="known-categories" placeholder="輸入後按 Enter" />
						<datalist id="known-categories">${known.categories.map((item) => `<option value="${esc(item)}"></option>`).join('')}</datalist>
						<div class="hint">每篇文章只能有一個分類。</div>
						<div class="chips" id="category-chips"></div>
					</div>
				</div>

				<div class="side-box">
					<h3>標籤</h3>
					<div class="side-body">
						<input type="text" id="tag-input" list="known-tags" placeholder="輸入後按 Enter" />
						<datalist id="known-tags">${known.tags.map((item) => `<option value="${esc(item)}"></option>`).join('')}</datalist>
						<div class="hint">英文標籤會自動轉小寫、空白轉成連字號。</div>
						<div class="chips" id="tag-chips"></div>
					</div>
				</div>

				<div class="side-box">
					<h3>摘要描述</h3>
					<div class="side-body">
						<textarea id="post-description" rows="4" placeholder="用於 SEO 與列表頁，留空會自動從內文擷取。">${esc(post.description ?? '')}</textarea>
					</div>
				</div>
			</aside>
		</div>`;

	setupEditor();
}

function setupEditor() {
	const body = document.getElementById('post-body');
	const preview = document.getElementById('md-preview');
	const markDirty = () => {
		state.dirty = true;
	};

	const paintPreview = () => {
		preview.innerHTML = renderMarkdown(body.value);
	};

	paintPreview();
	body.addEventListener('input', () => {
		markDirty();
		paintPreview();
	});

	for (const id of ['post-title', 'post-date', 'post-description', 'post-draft']) {
		document.getElementById(id)?.addEventListener('input', markDirty);
		document.getElementById(id)?.addEventListener('change', markDirty);
	}

	document.getElementById('toggle-preview').addEventListener('click', () => {
		document.getElementById('md-panes').classList.toggle('single');
	});

	document.getElementById('md-toolbar').addEventListener('click', (event) => {
		const button = event.target.closest('button[data-md]');
		if (!button) return;
		applyMarkdownAction(button.dataset.md, body);
		markDirty();
		paintPreview();
	});

	body.addEventListener('keydown', (event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			document.getElementById('btn-save').click();
		}
	});

	body.addEventListener('paste', (event) => {
		const file = [...(event.clipboardData?.files ?? [])][0];
		if (file && file.type.startsWith('image/')) {
			event.preventDefault();
			void uploadAndInsert(file, body, paintPreview);
		}
	});

	body.addEventListener('dragover', (event) => event.preventDefault());
	body.addEventListener('drop', (event) => {
		const file = [...(event.dataTransfer?.files ?? [])][0];
		if (file && file.type.startsWith('image/')) {
			event.preventDefault();
			void uploadAndInsert(file, body, paintPreview);
		}
	});

	setupChips('category-input', 'category-chips', 'categories', 1);
	setupChips('tag-input', 'tag-chips', 'tags', 30);

	document.getElementById('btn-save').addEventListener('click', savePost);
	document.getElementById('btn-delete')?.addEventListener('click', async () => {
		const filename = state.editor.filename;
		if (!(await confirmDialog('刪除文章', `確定要刪除 ${filename} 嗎？`, '刪除'))) return;

		try {
			await api.deletePost(filename);
			state.dirty = false;
			toast('文章已刪除', 'success');
			await loadPosts(true);
			navigate('#/posts');
		} catch (error) {
			toast(error.message, 'error');
		}
	});
}

function setupChips(inputId, chipsId, key, limit) {
	const input = document.getElementById(inputId);
	const chips = document.getElementById(chipsId);

	const paint = () => {
		chips.innerHTML = state.editor[key]
			.map(
				(value, index) =>
					`<span class="chip">${esc(value)}<button type="button" data-index="${index}" aria-label="移除">×</button></span>`,
			)
			.join('');
	};

	chips.addEventListener('click', (event) => {
		const button = event.target.closest('button[data-index]');
		if (!button) return;
		state.editor[key].splice(Number(button.dataset.index), 1);
		state.dirty = true;
		paint();
	});

	input.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ',') return;
		event.preventDefault();

		const value = input.value.trim();
		if (!value) return;

		if (state.editor[key].length >= limit) {
			toast(limit === 1 ? '每篇文章只能有一個分類，請先移除現有分類。' : `最多 ${limit} 個`, 'error');
			return;
		}
		if (state.editor[key].includes(value)) {
			input.value = '';
			return;
		}

		state.editor[key].push(value);
		input.value = '';
		state.dirty = true;
		paint();
	});

	paint();
}

function applyMarkdownAction(action, textarea) {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = textarea.value.slice(start, end);

	const wrap = (prefix, suffix = prefix, placeholder = '文字') => {
		const inner = selected || placeholder;
		return { text: `${prefix}${inner}${suffix}`, offset: prefix.length, length: inner.length };
	};

	const line = (prefix, placeholder = '') => ({
		text: `${prefix}${selected || placeholder}`,
		offset: prefix.length,
		length: (selected || placeholder).length,
	});

	const actions = {
		h2: () => line('## ', '小節標題'),
		h3: () => line('### ', '小標題'),
		bold: () => wrap('**'),
		italic: () => wrap('*'),
		strike: () => wrap('~~'),
		link: () => ({ text: `[${selected || '連結文字'}](https://)`, offset: 1, length: (selected || '連結文字').length }),
		image: () => ({ text: `![${selected || '圖片說明'}](/image/)`, offset: 2, length: (selected || '圖片說明').length }),
		code: () => ({ text: '```\n' + (selected || 'code') + '\n```', offset: 4, length: (selected || 'code').length }),
		quote: () => line('> ', '引用內容'),
		ul: () => line('- ', '項目'),
		ol: () => line('1. ', '項目'),
		table: () => ({ text: '| 欄位 A | 欄位 B |\n| --- | --- |\n| 內容 | 內容 |\n', offset: 2, length: 4 }),
		hr: () => ({ text: '---\n', offset: 4, length: 0 }),
		more: () => ({ text: '<!-- more -->\n', offset: 14, length: 0 }),
	};

	if (action === 'image') {
		openMediaPicker((markdownPath, alt) => {
			insertAt(textarea, start, end, `![${alt}](${markdownPath})`, 2, alt.length);
			textarea.dispatchEvent(new Event('input'));
		});
		return;
	}

	const result = actions[action]?.();
	if (!result) return;

	// 區塊語法必須自成一行，否則貼在句尾會被當成同一段文字。
	const prefix = BLOCK_ACTIONS.has(action) ? lineBreakBefore(textarea.value.slice(0, start)) : '';

	insertAt(textarea, start, end, prefix + result.text, prefix.length + result.offset, result.length);
}

const BLOCK_ACTIONS = new Set(['h2', 'h3', 'quote', 'ul', 'ol', 'table', 'hr', 'more', 'code']);

function lineBreakBefore(before) {
	if (before === '' || before.endsWith('\n\n')) return '';
	return before.endsWith('\n') ? '\n' : '\n\n';
}

function insertAt(textarea, start, end, text, offset, length) {
	textarea.setRangeText(text, start, end, 'end');
	textarea.focus();
	textarea.setSelectionRange(start + offset, start + offset + length);
}

async function uploadAndInsert(file, textarea, repaint) {
	toast(`上傳 ${file.name}…`);

	try {
		const dataBase64 = await fileToBase64(file);
		const folder = (state.editor?.filename || 'shared').replace(/\.(md|mdx)$/i, '').slice(0, 40);
		const result = await api.uploadMedia({ name: file.name, folder, dataBase64 });
		const { selectionStart, selectionEnd } = textarea;

		insertAt(textarea, selectionStart, selectionEnd, `![${result.name}](${result.markdownPath})`, 2, result.name.length);
		state.media = null;
		state.dirty = true;
		repaint?.();
		toast('圖片已上傳', 'success');
	} catch (error) {
		toast(error.message, 'error');
	}
}

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.onerror = () => reject(new Error('讀取檔案失敗'));
		reader.readAsDataURL(file);
	});
}

async function savePost() {
	const button = document.getElementById('btn-save');
	const editor = state.editor;

	const payload = {
		title: document.getElementById('post-title').value.trim(),
		date: fromLocalInput(document.getElementById('post-date').value) || undefined,
		description: document.getElementById('post-description').value.trim(),
		draft: document.getElementById('post-draft').checked,
		categories: editor.categories,
		tags: editor.tags,
		body: document.getElementById('post-body').value,
	};

	if (!payload.title) {
		toast('請先填寫標題', 'error');
		return;
	}

	button.disabled = true;
	button.innerHTML = '<span class="spinner"></span> 儲存中…';

	try {
		if (editor.isNew) {
			const result = await api.createPost(payload);
			state.dirty = false;
			state.posts = null;
			toast('文章已建立', 'success');
			navigate(`#/posts/edit/${encodeURIComponent(result.filename)}`);
		} else {
			const result = await api.updatePost(editor.filename, { ...payload, sha: editor.sha });
			editor.sha = result.sha;
			state.dirty = false;
			state.posts = null;
			toast(payload.draft ? '草稿已儲存' : '已儲存並排入部署', 'success');
		}
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		button.disabled = false;
		button.textContent = editor.isNew ? '建立文章' : '儲存';
	}
}

/* ------------------------------------------------------------------ *
 * 媒體
 * ------------------------------------------------------------------ */

async function loadMedia(force = false) {
	if (!state.media || force) state.media = await api.listMedia();
	return state.media;
}

async function renderMedia() {
	loading();

	try {
		await loadMedia(true);
	} catch (error) {
		errorPanel(error);
		return;
	}

	view().innerHTML = `
		<div class="card">
			<div class="card-head"><h2>上傳圖片</h2></div>
			<div class="card-body">
				<div class="field">
					<label for="media-folder">資料夾（選填）</label>
					<input type="text" id="media-folder" placeholder="例如 exchange-2026" list="media-folders" />
					<datalist id="media-folders">${state.media.folders.map((item) => `<option value="${esc(item)}"></option>`).join('')}</datalist>
					<div class="hint">會存到 public/image/&lt;資料夾&gt;/，文章內用 /image/&lt;資料夾&gt;/&lt;檔名&gt; 引用。</div>
				</div>
				<div class="dropzone" id="media-drop">把圖片拖到這裡，或點擊選擇檔案（單檔上限 5MB）</div>
				<input type="file" id="media-file" accept="image/*" multiple hidden />
			</div>
		</div>

		<div class="card">
			<div class="card-head"><h2>媒體庫</h2><span class="muted right">${state.media.items.length} 個檔案</span></div>
			<div class="card-body" id="media-grid"></div>
		</div>`;

	const fileInput = document.getElementById('media-file');
	const dropzone = document.getElementById('media-drop');

	dropzone.addEventListener('click', () => fileInput.click());
	dropzone.addEventListener('dragover', (event) => {
		event.preventDefault();
		dropzone.classList.add('over');
	});
	dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
	dropzone.addEventListener('drop', (event) => {
		event.preventDefault();
		dropzone.classList.remove('over');
		void uploadFiles([...event.dataTransfer.files]);
	});
	fileInput.addEventListener('change', () => void uploadFiles([...fileInput.files]));

	paintMediaGrid();
}

async function uploadFiles(files) {
	const folder = document.getElementById('media-folder')?.value.trim() ?? '';
	const images = files.filter((file) => file.type.startsWith('image/'));

	if (images.length === 0) {
		toast('請選擇圖片檔', 'error');
		return;
	}

	for (const file of images) {
		try {
			const dataBase64 = await fileToBase64(file);
			await api.uploadMedia({ name: file.name, folder, dataBase64 });
			toast(`${file.name} 已上傳`, 'success');
		} catch (error) {
			toast(`${file.name}：${error.message}`, 'error');
		}
	}

	await loadMedia(true);
	paintMediaGrid();
}

function mediaThumb(item) {
	return `/api/admin/media/raw?path=${encodeURIComponent(item.path)}`;
}

function paintMediaGrid() {
	const grid = document.getElementById('media-grid');
	if (!grid) return;

	if (state.media.items.length === 0) {
		grid.innerHTML = '<div class="empty">媒體庫還是空的。</div>';
		return;
	}

	grid.innerHTML = `<div class="media-grid">${state.media.items
		.map(
			(item) => `
				<div class="media-item">
					<div class="thumb"><img src="${esc(mediaThumb(item))}" alt="${esc(item.name)}" loading="lazy" /></div>
					<div class="meta">
						<div class="name">${esc(item.name)}</div>
						<div class="path mono">${esc(item.markdownPath)}</div>
						<div class="muted">${esc(formatSize(item.size))}</div>
						<div class="actions">
							<button class="small" data-copy="${esc(item.markdownPath)}">複製路徑</button>
							<button class="small danger" data-remove="${esc(item.path)}">刪除</button>
						</div>
					</div>
				</div>`,
		)
		.join('')}</div>`;

	grid.onclick = async (event) => {
		const copyButton = event.target.closest('button[data-copy]');
		if (copyButton) {
			await navigator.clipboard.writeText(`![](${copyButton.dataset.copy})`);
			toast('已複製 Markdown 圖片語法', 'success');
			return;
		}

		const removeButton = event.target.closest('button[data-remove]');
		if (!removeButton) return;

		const path = removeButton.dataset.remove;
		if (!(await confirmDialog('刪除圖片', `確定要刪除 ${path} 嗎？引用它的文章會出現破圖。`, '刪除'))) return;

		try {
			await api.deleteMedia(path);
			toast('圖片已刪除', 'success');
			await loadMedia(true);
			paintMediaGrid();
		} catch (error) {
			toast(error.message, 'error');
		}
	};
}

async function openMediaPicker(onPick) {
	const root = document.getElementById('modal-root');
	root.innerHTML = `
		<div class="modal-backdrop">
			<div class="modal">
				<header><h2>選擇圖片</h2><button class="right" data-act="close">關閉</button></header>
				<div class="modal-body"><div class="empty"><span class="spinner"></span> 載入媒體庫…</div></div>
			</div>
		</div>`;

	const close = () => {
		root.innerHTML = '';
	};

	root.querySelector('[data-act="close"]').onclick = close;
	root.querySelector('.modal-backdrop').onclick = (event) => {
		if (event.target === event.currentTarget) close();
	};

	try {
		const media = await loadMedia();
		const bodyNode = root.querySelector('.modal-body');

		bodyNode.innerHTML =
			media.items.length === 0
				? '<div class="empty">媒體庫還是空的，先到「媒體」頁面上傳圖片。</div>'
				: `<div class="media-grid">${media.items
						.map(
							(item) => `
								<div class="media-item" style="cursor:pointer" data-pick="${esc(item.markdownPath)}" data-name="${esc(item.name)}">
									<div class="thumb"><img src="${esc(mediaThumb(item))}" alt="${esc(item.name)}" loading="lazy" /></div>
									<div class="meta"><div class="name">${esc(item.name)}</div></div>
								</div>`,
						)
						.join('')}</div>`;

		bodyNode.onclick = (event) => {
			const card = event.target.closest('[data-pick]');
			if (!card) return;
			onPick(card.dataset.pick, card.dataset.name.replace(/\.[^.]+$/, ''));
			close();
		};
	} catch (error) {
		root.querySelector('.modal-body').innerHTML = `<div class="notice error">${esc(error.message)}</div>`;
	}
}

/* ------------------------------------------------------------------ *
 * 網站設定
 * ------------------------------------------------------------------ */

const SOCIAL_KEYS = [
	['github', 'GitHub'],
	['linkedin', 'LinkedIn'],
	['x', 'X / Twitter'],
	['email', 'Email'],
	['website', '個人網站'],
];

function textField(id, label, value, hint = '', type = 'text') {
	return `
		<div class="field">
			<label for="${id}">${esc(label)}</label>
			<input type="${type}" id="${id}" value="${esc(value ?? '')}" />
			${hint ? `<div class="hint">${esc(hint)}</div>` : ''}
		</div>`;
}

async function renderSettings() {
	loading();

	try {
		const result = await api.readSettings();
		state.settings = result.settings;
		state.settingsSha = result.sha;
	} catch (error) {
		errorPanel(error);
		return;
	}

	const { site, profile, hero } = state.settings;

	view().innerHTML = `
		<div class="notice">改動會寫回 <span class="mono">src/config/settings.json</span> 並觸發重新部署，約 1–3 分鐘後在網站上生效。</div>

		<div class="card">
			<div class="card-head"><h2>網站</h2></div>
			<div class="card-body">
				<div class="grid-2">
					${textField('set-siteTitle', '網站標題', site.siteTitle)}
					${textField('set-siteTitleSuffix', '標題後綴', site.siteTitleSuffix, '顯示在瀏覽器分頁標題後面')}
					${textField('set-siteUrl', '網站網址', site.siteUrl, '改錯會影響 RSS 與 sitemap', 'url')}
					${textField('set-locale', '語言代碼', site.locale, '例如 zh-TW')}
					${textField('set-headerGithubRepoUrl', '頁首 GitHub 連結', site.headerGithubRepoUrl, '', 'url')}
					${textField('set-faviconIco', 'Favicon 路徑', site.faviconIco)}
				</div>
				<div class="field">
					<label for="set-siteDescription">網站描述</label>
					<textarea id="set-siteDescription" rows="3">${esc(site.siteDescription)}</textarea>
					<div class="hint">用於首頁 SEO 與 RSS。</div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-head"><h2>個人資料（關於我）</h2></div>
			<div class="card-body">
				<div class="grid-2">
					${textField('set-name', '姓名', profile.name)}
					${textField('set-title', '頭銜', profile.title)}
					${textField('set-location', '所在地', profile.location)}
					${textField('set-email', 'Email', profile.email, '', 'email')}
					${textField('set-githubProfileUrl', 'GitHub 個人頁', profile.githubProfileUrl, '', 'url')}
				</div>
				<div class="field">
					<label for="set-bio">自我介紹</label>
					<textarea id="set-bio" rows="4">${esc(profile.bio)}</textarea>
				</div>
				<div class="field">
					<label>社群連結</label>
					<div id="socials"></div>
					<button type="button" class="small" id="add-social" style="margin-top:8px">新增一列</button>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-head"><h2>各頁標題文案</h2></div>
			<div class="card-body">
				${['home', 'blog', 'tags', 'about']
					.map(
						(key) => `
							<div class="grid-2">
								${textField(`hero-${key}-text`, `${{ home: '首頁', blog: '文章列表', tags: '標籤頁', about: '關於我' }[key]} 主標題`, hero[key].text)}
								${textField(`hero-${key}-subtitle`, '副標題', hero[key].subtitle)}
							</div>`,
					)
					.join('')}
			</div>
		</div>

		<div class="toolbar" style="margin-top:18px">
			<button class="primary" id="save-settings">儲存設定</button>
			<span class="muted">儲存後會自動重新部署。</span>
		</div>`;

	paintSocials(profile.socials);
	document.getElementById('add-social').addEventListener('click', () => {
		const rows = readSocials();
		rows.push({ key: 'website', label: '', url: '' });
		paintSocials(rows);
	});

	document.getElementById('save-settings').addEventListener('click', saveSettings);
}

function paintSocials(rows) {
	const container = document.getElementById('socials');

	container.innerHTML = rows
		.map(
			(row, index) => `
				<div class="toolbar" data-social style="margin-bottom:8px">
					<select data-field="key" style="width:130px">
						${SOCIAL_KEYS.map(([key, label]) => `<option value="${key}" ${row.key === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}
					</select>
					<input type="text" data-field="label" placeholder="顯示名稱" value="${esc(row.label)}" style="width:140px" />
					<input type="text" data-field="url" class="grow" placeholder="網址或 Email" value="${esc(row.url)}" />
					<button type="button" class="small danger" data-remove-social="${index}">移除</button>
				</div>`,
		)
		.join('');

	container.onclick = (event) => {
		const button = event.target.closest('button[data-remove-social]');
		if (!button) return;
		const remaining = readSocials();
		remaining.splice(Number(button.dataset.removeSocial), 1);
		paintSocials(remaining);
	};
}

function readSocials() {
	return [...document.querySelectorAll('[data-social]')].map((row) => ({
		key: row.querySelector('[data-field="key"]').value,
		label: row.querySelector('[data-field="label"]').value.trim(),
		url: row.querySelector('[data-field="url"]').value.trim(),
	}));
}

async function saveSettings() {
	const button = document.getElementById('save-settings');
	const value = (id) => document.getElementById(id).value.trim();

	const settings = {
		site: {
			siteUrl: value('set-siteUrl'),
			siteTitle: value('set-siteTitle'),
			siteTitleSuffix: value('set-siteTitleSuffix'),
			siteDescription: value('set-siteDescription'),
			locale: value('set-locale'),
			headerGithubRepoUrl: value('set-headerGithubRepoUrl'),
			faviconIco: value('set-faviconIco'),
		},
		profile: {
			name: value('set-name'),
			title: value('set-title'),
			bio: value('set-bio'),
			location: value('set-location'),
			email: value('set-email'),
			githubProfileUrl: value('set-githubProfileUrl'),
			socials: readSocials().filter((row) => row.url),
		},
		hero: Object.fromEntries(
			['home', 'blog', 'tags', 'about'].map((key) => [
				key,
				{ text: value(`hero-${key}-text`), subtitle: value(`hero-${key}-subtitle`) },
			]),
		),
	};

	button.disabled = true;
	button.innerHTML = '<span class="spinner"></span> 儲存中…';

	try {
		const result = await api.writeSettings(settings, state.settingsSha);
		state.settings = result.settings;
		state.settingsSha = result.sha;
		toast('設定已儲存，部署後生效', 'success');
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		button.disabled = false;
		button.textContent = '儲存設定';
	}
}

/* ------------------------------------------------------------------ *
 * 部署
 * ------------------------------------------------------------------ */

async function renderDeploy() {
	loading();

	let runs = [];
	try {
		runs = (await api.deployStatus()).runs;
	} catch (error) {
		errorPanel(error);
		return;
	}

	view().innerHTML = `
		<div class="notice">後台每次儲存都會 commit 到 GitHub，並自動觸發一次建置與部署。如果覺得網站沒更新，可以在這裡手動重跑。</div>

		<div class="toolbar">
			<button class="primary" id="btn-redeploy">手動重新部署</button>
			<button id="btn-refresh-runs">重新整理</button>
		</div>

		<div class="card">
			<div class="card-head"><h2>最近的建置紀錄</h2></div>
			${
				runs.length === 0
					? '<div class="empty">還沒有紀錄。</div>'
					: `<table>
							<thead><tr><th>工作流程</th><th style="width:110px">狀態</th><th style="width:110px">觸發方式</th><th style="width:170px">時間</th><th style="width:90px"></th></tr></thead>
							<tbody>
								${runs
									.map(
										(run) => `
											<tr>
												<td class="row-title">${esc(run.name)}</td>
												<td>${deployBadge(run)}</td>
												<td class="muted">${esc(run.event)}</td>
												<td class="muted">${esc(formatDate(run.updatedAt))}</td>
												<td><a class="btn small" href="${esc(run.url)}" target="_blank" rel="noopener">紀錄 ↗</a></td>
											</tr>`,
									)
									.join('')}
							</tbody>
						</table>`
			}
		</div>`;

	document.getElementById('btn-refresh-runs').addEventListener('click', renderDeploy);
	document.getElementById('btn-redeploy').addEventListener('click', triggerDeploy);
}

async function triggerDeploy(event) {
	const button = event?.currentTarget ?? document.getElementById('btn-deploy-top');

	button.disabled = true;
	const original = button.textContent;
	button.innerHTML = '<span class="spinner"></span> 送出中…';

	try {
		const result = await api.deploy();
		toast(result.message, 'success');
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		button.disabled = false;
		button.textContent = original;
	}
}

/* ------------------------------------------------------------------ *
 * 路由
 * ------------------------------------------------------------------ */

const ROUTES = [
	{ pattern: /^#\/dashboard$/, title: '儀表板', nav: 'dashboard', render: renderDashboard },
	{ pattern: /^#\/posts$/, title: '文章', nav: 'posts', render: renderPosts },
	{ pattern: /^#\/posts\/new$/, title: '新增文章', nav: 'new', render: () => renderEditor(null) },
	{
		pattern: /^#\/posts\/edit\/(.+)$/,
		title: '編輯文章',
		nav: 'posts',
		render: (match) => renderEditor(decodeURIComponent(match[1])),
	},
	{ pattern: /^#\/media$/, title: '媒體', nav: 'media', render: renderMedia },
	{ pattern: /^#\/settings$/, title: '網站設定', nav: 'settings', render: renderSettings },
	{ pattern: /^#\/deploy$/, title: '部署', nav: 'deploy', render: renderDeploy },
];

function navigate(hash) {
	if (location.hash === hash) void handleRoute();
	else location.hash = hash;
}

async function handleRoute() {
	if (!state.user) return;

	const hash = location.hash || '#/dashboard';
	const route = ROUTES.find((entry) => entry.pattern.test(hash));

	if (!route) {
		location.hash = '#/dashboard';
		return;
	}

	document.getElementById('page-title').textContent = route.title;
	for (const item of document.querySelectorAll('.nav-item[data-route]')) {
		item.classList.toggle('active', item.dataset.route === route.nav);
	}

	state.editor = null;
	state.dirty = false;

	try {
		await route.render(hash.match(route.pattern));
	} catch (error) {
		if (error.message !== 'unauthenticated') errorPanel(error);
	}
}

for (const item of document.querySelectorAll('.nav-item[data-route]')) {
	item.addEventListener('click', () => {
		const target = item.dataset.route;
		navigate(target === 'new' ? '#/posts/new' : `#/${target}`);
	});
}

document.getElementById('nav-logout').addEventListener('click', async () => {
	await api.logout().catch(() => {});
	state.user = null;
	state.posts = null;
	state.media = null;
	showLogin('已登出。');
});

document.getElementById('btn-deploy-top').addEventListener('click', triggerDeploy);

window.addEventListener('hashchange', () => void handleRoute());

window.addEventListener('beforeunload', (event) => {
	if (!state.dirty) return;
	event.preventDefault();
	event.returnValue = '';
});

/* ------------------------------------------------------------------ *
 * 啟動
 * ------------------------------------------------------------------ */

(async function start() {
	try {
		const session = await api.session();
		if (session.authenticated) {
			state.user = session.user;
			showApp();
			await handleRoute();
			return;
		}
	} catch (error) {
		if (error.message !== 'unauthenticated') {
			showLogin(error.message);
			return;
		}
	}

	showLogin();
})();
