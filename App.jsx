import React, { useEffect, useMemo, useState } from "react";

const DEMO_USER = { name: "Kamal", username: "kamal" };
const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const today = () => new Date().toISOString().slice(0, 10);

function isOverdue(task) {
  return Boolean(task.deadline && task.status !== "Completed" && task.deadline < today());
}

function App() {
  const [page, setPage] = useState(() => localStorage.getItem("taskflowLoggedIn") === "true" ? "app" : "front");
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(() => readJSON("taskflowUser", null));
  const [users, setUsers] = useState(() => readJSON("taskflowUsers", []));
  const [tasks, setTasks] = useState(() => readJSON("taskflowTasks", []));
  const [section, setSection] = useState("dashboard");
  const [auth, setAuth] = useState({ name: "", username: localStorage.getItem("taskflowRememberUser") || "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [authError, setAuthError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState("");
  const [filters, setFilters] = useState({ search: "", priority: "all", category: "all" });
  const [form, setForm] = useState({ title: "", category: "College", priority: "Medium", deadline: "", status: "To-Do", description: "" });

  useEffect(() => localStorage.setItem("taskflowTasks", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("taskflowUsers", JSON.stringify(users)), [users]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 2300);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === "To-Do").length,
    working: tasks.filter(t => t.status === "Working").length,
    completed: tasks.filter(t => t.status === "Completed").length,
    overdue: tasks.filter(isOverdue).length
  }), [tasks]);
  const progress = stats.total ? Math.round(stats.completed / stats.total * 100) : 0;

  function notify(message) { setToast(message); }
  function goAuth(mode) {
    setAuthMode(mode); setAuthError(""); setPage("auth");
  }
  function loginSuccess(account) {
    setUser(account);
    localStorage.setItem("taskflowLoggedIn", "true");
    localStorage.setItem("taskflowUser", JSON.stringify(account));
    localStorage.setItem("taskflowLoginTime", new Date().toISOString());
    if (remember) localStorage.setItem("taskflowRememberUser", account.username);
    setPage("app"); setSection("dashboard");
    notify("Login successful. Welcome to TaskFlow!");
  }
  function submitAuth(e) {
    e.preventDefault();
    const username = auth.username.trim();
    const password = auth.password;
    if (authMode === "signup") {
      if (!auth.name.trim() || !username || !password) return setAuthError("Please fill all required fields.");
      if (password.length < 4) return setAuthError("Password must contain at least 4 characters.");
      if (password !== auth.confirm) return setAuthError("Passwords do not match.");
      if (users.some(x => x.username.toLowerCase() === username.toLowerCase())) return setAuthError("Username already exists.");
      const account = { name: auth.name.trim(), username, password };
      setUsers(prev => [...prev, account]);
      loginSuccess({ name: account.name, username });
    } else {
      const registered = users.find(x => x.username === username && x.password === password);
      if (username === "kamal" && password === "1234") loginSuccess(DEMO_USER);
      else if (registered) loginSuccess({ name: registered.name, username: registered.username });
      else setAuthError("Invalid username or password.");
    }
  }
  function logout() {
    localStorage.removeItem("taskflowLoggedIn");
    localStorage.removeItem("taskflowUser");
    localStorage.removeItem("taskflowLoginTime");
    setUser(null); setPage("auth"); setAuthMode("login");
    notify("You have been logged out.");
  }
  function openAddTask() {
    setEditingId(null);
    setForm({ title: "", category: "College", priority: "Medium", deadline: "", status: "To-Do", description: "" });
    setModalOpen(true);
  }
  function editTask(task) {
    setEditingId(task.id);
    setForm({ title: task.title, category: task.category, priority: task.priority, deadline: task.deadline || "", status: task.status, description: task.description || "" });
    setModalOpen(true);
  }
  function saveTask(e) {
    e.preventDefault();
    const item = { ...form, title: form.title.trim(), id: editingId || String(Date.now()), createdAt: editingId ? tasks.find(t => t.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString() };
    if (editingId) {
      setTasks(prev => prev.map(t => t.id === editingId ? item : t));
      notify("Task updated.");
    } else {
      setTasks(prev => [item, ...prev]);
      notify("Task added.");
    }
    setModalOpen(false);
  }
  function deleteTask(id) {
    if (!window.confirm("Delete this task?")) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    notify("Task deleted.");
  }
  function setStatus(id, status) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    notify("Task status updated.");
  }
  function changeSection(id) { setSection(id); }
  function resetFilters() { setFilters({ search: "", priority: "all", category: "all" }); }

  const visibleTasks = (status) => tasks.filter(t => t.status === status).filter(t => {
    if (status !== "To-Do") return true;
    const q = filters.search.toLowerCase();
    return (!q || `${t.title} ${t.description || ""}`.toLowerCase().includes(q))
      && (filters.priority === "all" || t.priority === filters.priority)
      && (filters.category === "all" || t.category === filters.category);
  });
  const recentDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activity = recentDays.map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return tasks.filter(t => new Date(t.createdAt).toDateString() === d.toDateString()).length;
  });
  const maxActivity = Math.max(...activity, 1);
  const analytics = [
    ["To-Do", stats.pending], ["Working", stats.working],
    ["Done", stats.completed], ["Overdue", stats.overdue]
  ];
  const maxAnalytics = Math.max(...analytics.map(x => x[1]), 1);
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  function TaskCard({ task }) {
    const overdue = isOverdue(task);
    return <article className={`task-card ${task.status === "Completed" ? "done" : ""} ${overdue ? "overdue" : ""}`}>
      <div>
        <div className="task-title">{task.title}</div>
        <div className="task-description">{task.description || "No description"}</div>
        <div className="task-meta">
          <span className="tag">{task.category}</span>
          <span className={`tag ${task.priority.toLowerCase()}`}>{task.priority}</span>
          <span className="tag">{task.deadline ? `📅 ${task.deadline}` : "No deadline"}</span>
          {overdue && <span className="tag high">OVERDUE</span>}
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-btn" title="Edit" onClick={() => editTask(task)}>✏️</button>
        {task.status !== "Completed" && <button className="icon-btn" title="Update status" onClick={() => setStatus(task.id, task.status === "To-Do" ? "Working" : "Completed")}>{task.status === "To-Do" ? "▶" : "✓"}</button>}
        <button className="icon-btn" title="Delete" onClick={() => deleteTask(task.id)}>🗑️</button>
      </div>
    </article>;
  }

  function TaskList({ status }) {
    const list = visibleTasks(status);
    return list.length ? <div className="task-list">{list.map(task => <TaskCard key={task.id} task={task} />)}</div> : <div className="empty">No tasks found. Add a task to get started.</div>;
  }

  if (page === "front") return <section className="front-page page">
    <div className="grid-bg" />
    <nav className="navbar">
      <div className="brand"><div className="brand-mark">✓</div><span>TaskFlow</span></div>
      <div className="nav-actions"><button className="btn" onClick={() => goAuth("login")}>Login</button><button className="btn btn-primary" onClick={() => goAuth("signup")}>Get Started</button></div>
    </nav>
    <div className="hero">
      <div>
        <span className="badge">✦ Smart Daily Task Management System</span>
        <h1>Organize your work.<br /><span className="gradient-text">Complete your goals.</span></h1>
        <p>TaskFlow is a professional task management system for organizing daily work, tracking deadlines, managing priorities, monitoring progress and understanding productivity from one simple dashboard.</p>
        <div className="hero-buttons"><button className="btn btn-primary" onClick={() => goAuth("signup")}>Start Managing Tasks →</button><button className="btn" onClick={() => goAuth("login")}>I Already Have an Account</button></div>
      </div>
      <div className="hero-card glass">
        <div className="mock-head"><div><div className="mock-title">Today's Productivity</div><small className="muted">TaskFlow overview</small></div><div className="dot" /></div>
        <div className="mock-stats">{[["12","Total Tasks"],["7","Completed"],["3","Working"],["2","Pending"]].map(x => <div className="mini-stat" key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div>
        <div className="mock-progress"><div className="between"><span>Daily progress</span><b>74%</b></div><div className="progress-track"><div className="progress-fill" /></div></div>
      </div>
    </div>
    <div className="features">
      {[["📝","Create & Organize","Create tasks with categories, priorities, deadlines and descriptions."],["📊","Track Progress","Move tasks from To-Do to Working and Completed while monitoring progress."],["⏰","Manage Deadlines","Identify overdue work and keep important activities visible."]].map(f => <div className="feature glass" key={f[1]}><div className="feature-icon">{f[0]}</div><h3>{f[1]}</h3><p>{f[2]}</p></div>)}
    </div>
  </section>;

  if (page === "auth") return <section className="auth-page page">
    <div className="auth-wrap glass">
      <div className="auth-info">
        <div className="brand"><div className="brand-mark">✓</div><span>TaskFlow</span></div>
        <h2>{authMode === "signup" ? "Build your organized day." : "Welcome back."}</h2>
        <p>{authMode === "signup" ? "Create your account and manage college, work and personal tasks from one place." : "Sign in to continue managing your tasks, deadlines and daily productivity."}</p>
        <div className="auth-list">{["Daily task organization","Priority and deadline tracking","Productivity analytics","Browser Local Storage persistence"].map(x => <div key={x}><span className="check">✓</span>{x}</div>)}</div>
        <button className="btn back-btn" onClick={() => setPage("front")}>← Back to Front Page</button>
      </div>
      <div className="auth-form">
        <h2>{authMode === "signup" ? "Create your TaskFlow account" : "Login to TaskFlow"}</h2>
        <p className="sub">{authMode === "signup" ? "Create an account to start organizing your daily tasks." : "Use your TaskFlow account to open the dashboard."}</p>
        <form onSubmit={submitAuth}>
          {authMode === "signup" && <div className="form-group"><label>Full Name</label><input value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })} placeholder="Enter your name" required /></div>}
          <div className="form-group"><label>Username</label><input value={auth.username} onChange={e => setAuth({ ...auth, username: e.target.value })} placeholder="Enter username" autoComplete="username" required /></div>
          <div className="form-group"><label>Password</label><div className="password-box"><input type={showPassword ? "text" : "password"} value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} placeholder="Enter password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></div>
          {authMode === "signup" && <div className="form-group"><label>Confirm Password</label><input type="password" value={auth.confirm} onChange={e => setAuth({ ...auth, confirm: e.target.value })} placeholder="Confirm password" required /></div>}
          {authMode === "login" && <div className="auth-row"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember username</label><button type="button" className="link" onClick={() => setAuthError("Demo account: username kamal, password 1234.")}>Forgot password?</button></div>}
          <div className="error">{authError}</div>
          <button className="btn btn-primary full-btn" type="submit">{authMode === "signup" ? "Create Account" : "Sign In"}</button>
        </form>
        {authMode === "login" && <div className="demo"><b>College Demo Account</b><br />Username: <b>kamal</b> &nbsp; Password: <b>1234</b></div>}
        <div className="switch-auth">{authMode === "signup" ? "Already have an account?" : "New to TaskFlow?"} <button className="link" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}> {authMode === "signup" ? "Login" : "Create account"}</button></div>
      </div>
    </div>
  </section>;

  return <section className="app-page page">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark">✓</div><span>TaskFlow</span></div>
      <nav className="side-nav">
        {[["dashboard","🏠","Dashboard"],["todo","📋","To-Do"],["working","⚙️","Working"],["completed","✅","Completed"],["add","➕","Add Task"],["analytics","📊","Analytics"],["logout","🚪","Logout"]].map(n => <button key={n[0]} className={section === n[0] ? "active" : ""} onClick={() => n[0] === "add" ? openAddTask() : n[0] === "logout" ? logout() : changeSection(n[0])}><span className="nav-icon">{n[1]}</span><span>{n[2]}</span></button>)}
      </nav>
      <div className="profile"><div className="avatar">{(user?.name || user?.username || "U").charAt(0).toUpperCase()}</div><div className="profile-info"><div className="profile-name">{user?.name || user?.username || "User"}</div><div className="profile-role">TaskFlow User</div></div></div>
    </aside>
    <main className="main">
      <div className="topbar"><div className="page-title"><h1>{({ dashboard: "Dashboard", todo: "To-Do Tasks", working: "Working Tasks", completed: "Completed Tasks", analytics: "Analytics" })[section] || "Dashboard"}</h1><p>{dateLabel}</p></div><div className="top-actions"><button className="btn" onClick={openAddTask}>＋ Add Task</button><button className="btn btn-primary" onClick={() => changeSection("analytics")}>View Analytics</button></div></div>
      {section === "dashboard" && <>
        <div className="welcome glass"><h2>Welcome, {user?.name || user?.username || "User"} 👋</h2><p>Manage your daily life, academic work, projects, deadlines and personal goals from one organized workspace.</p></div>
        <div className="stats-grid">{[["Total Tasks",stats.total,"blue"],["Pending",stats.pending,"orange"],["Working",stats.working,"purple"],["Completed",stats.completed,"green"],["Overdue",stats.overdue,"red"]].map(s => <div className={`stat glass ${s[2]}`} key={s[0]}><small>{s[0]}</small><strong>{s[1]}</strong></div>)}</div>
        <div className="dashboard-grid">
          <div className="panel glass"><div className="panel-head"><h3>Weekly Task Activity</h3><span className="muted tiny">Live data</span></div><div className="chart">{activity.map((v,i) => <div className="bar-wrap" key={recentDays[i]}><div className="bar" style={{height:`${Math.max(8,v/maxActivity*85)}%`}} /><span>{recentDays[i]}</span></div>)}</div></div>
          <div className="panel glass"><div className="panel-head"><h3>Overall Progress</h3><span>{progress}%</span></div><div className="progress-big"><div style={{width:`${progress}%`}} /></div><p className="muted small">{stats.total ? `${stats.completed} of ${stats.total} tasks completed. Keep moving your work forward.` : "Add tasks to begin tracking productivity."}</p></div>
        </div>
        <div className="panel glass daily-panel"><div className="panel-head"><h3>Daily-Life Uses</h3></div><div className="use-grid">{[["🎓","College","Assignments, lab work, exams, projects and study plans."],["💼","Work","Meetings, reports, project activities and deadlines."],["🏠","Personal Life","Shopping, exercise, appointments and everyday responsibilities."]].map(x => <div className="use-card" key={x[1]}><div>{x[0]}</div><h4>{x[1]}</h4><p>{x[2]}</p></div>)}</div></div>
      </>}
      {section === "todo" && <div className="panel glass"><div className="panel-head"><h3>To-Do Tasks</h3><button className="btn btn-primary" onClick={openAddTask}>＋ Add Task</button></div><div className="task-toolbar"><input placeholder="Search tasks..." value={filters.search} onChange={e => setFilters({...filters,search:e.target.value})} /><select value={filters.priority} onChange={e => setFilters({...filters,priority:e.target.value})}><option value="all">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select><select value={filters.category} onChange={e => setFilters({...filters,category:e.target.value})}><option value="all">All categories</option>{["College","Work","Personal","Health","Other"].map(x => <option key={x}>{x}</option>)}</select><button className="btn" onClick={resetFilters}>Reset</button></div><TaskList status="To-Do" /></div>}
      {section === "working" && <div className="panel glass"><div className="panel-head"><h3>Working Tasks</h3><button className="btn btn-primary" onClick={openAddTask}>＋ Add Task</button></div><TaskList status="Working" /></div>}
      {section === "completed" && <div className="panel glass"><div className="panel-head"><h3>Completed Tasks</h3></div><TaskList status="Completed" /></div>}
      {section === "analytics" && <div className="dashboard-grid"><div className="panel glass"><div className="panel-head"><h3>Task Distribution</h3></div><div className="chart">{analytics.map(x => <div className="bar-wrap" key={x[0]}><div className="bar" style={{height:`${Math.max(8,x[1]/maxAnalytics*85)}%`}} /><span>{x[0]} ({x[1]})</span></div>)}</div></div><div className="panel glass"><div className="panel-head"><h3>Productivity Summary</h3></div><div className="summary-grid"><div className="mini-stat"><span>Total tasks</span><b>{stats.total}</b></div><div className="mini-stat"><span>Completion rate</span><b>{progress}%</b></div><div className="mini-stat"><span>High priority</span><b>{tasks.filter(t => t.priority === "High").length}</b></div><div className="mini-stat"><span>Overdue</span><b>{stats.overdue}</b></div></div></div></div>}
    </main>

    {modalOpen && <div className="modal open" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}><div className="modal-box glass"><div className="modal-head"><h3>{editingId ? "Edit Task" : "Add New Task"}</h3><button className="icon-btn" onClick={() => setModalOpen(false)}>✕</button></div><form onSubmit={saveTask}><div className="form-grid">
      <div className="wide"><label>Task Title</label><input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Example: Complete Java assignment" /></div>
      <div><label>Category</label><select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{["College","Work","Personal","Health","Other"].map(x => <option key={x}>{x}</option>)}</select></div>
      <div><label>Priority</label><select value={form.priority} onChange={e => setForm({...form,priority:e.target.value})}>{["High","Medium","Low"].map(x => <option key={x}>{x}</option>)}</select></div>
      <div><label>Deadline</label><input type="date" value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})} /></div>
      <div><label>Status</label><select value={form.status} onChange={e => setForm({...form,status:e.target.value})}>{["To-Do","Working","Completed"].map(x => <option key={x}>{x}</option>)}</select></div>
      <div className="wide"><label>Description</label><textarea rows="4" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Add task details..." /></div>
    </div><button className="btn btn-primary full-btn save-btn" type="submit">Save Task</button></form></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </section>;
}

export default App;