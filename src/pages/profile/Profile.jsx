import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./profile.css";

/**
 * 保持原有类名/结构兼容：
 * .cst-bg .title .back-btn .title-text .profile-photo #username #user-email #profile-form .labelformat .save-btn
 * 数据：localStorage["tds_users_v1"] / sessionStorage["tds_user"]
 */

const USERS_KEY = "tds_users_v1";
const SESSION_KEY = "tds_user";

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}
function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

export default function Profile() {
  const nav = useNavigate();

  // 当前用户名（登录时由 Login 写入）
  const username = useMemo(() => {
    try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch { return ""; }
  }, []);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    username: "",
    avatarUrl: "",
    bio: ""
  });
  const [msg, setMsg] = useState("");

  // 初次加载：按 username 找到用户并预填
  useEffect(() => {
    const all = loadUsers();
    const u = all.find(x => x.username === username) || null;
    if (u) {
      setForm({
        fullName: u.fullName || "",
        email: u.email || "",
        mobile: u.mobile || "",
        username: u.username || "",
        avatarUrl: u.avatarUrl || "",
        bio: u.bio || ""
      });
    }
  }, [username]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(s => ({ ...s, [name]: value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const all = loadUsers();
    const idx = all.findIndex(x => x.username === username);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...form };
      saveUsers(all);
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 1500);
    } else {
      setMsg("User not found.");
      setTimeout(() => setMsg(""), 1500);
    }
  };

  const avatar = form.avatarUrl?.trim()
    ? form.avatarUrl.trim()
    : "https://i.pravatar.cc/160?img=12";

  return (
    <div className="cst-bg">
      {/* 顶部标题与返回按钮 */}
      <div className="title">
        <a className="back-btn" onClick={() => nav(-1)} href="#!" aria-label="Back">‹</a>
        <h2 className="title-text">Profile</h2>
      </div>

      {/* 资料卡片 */}
      <section className="profile-section">
        <div className="profile-card">
          <img className="profile-photo" src={avatar} alt="avatar" />
          <h3 id="username">{form.fullName || form.username || "Guest"}</h3>
          <p id="user-email">{form.email || "no-email@example.com"}</p>

          <form id="profile-form" onSubmit={onSubmit}>
            <label className="labelformat">Display name
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={onChange}
                placeholder="Your name"
              />
            </label>

            <label className="labelformat">Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@example.com"
              />
            </label>

            <label className="labelformat">Mobile
              <input
                type="tel"
                name="mobile"
                value={form.mobile}
                onChange={onChange}
                placeholder="04xx xxx xxx"
              />
            </label>

            <label className="labelformat">Username
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={onChange}
                placeholder="username"
              />
            </label>

            <label className="labelformat">Avatar URL
              <input
                type="url"
                name="avatarUrl"
                value={form.avatarUrl}
                onChange={onChange}
                placeholder="https://…"
              />
            </label>

            <label className="labelformat">Bio
              <textarea
                name="bio"
                value={form.bio}
                onChange={onChange}
                placeholder="Say something…"
              />
            </label>

            <button className="save-btn" type="submit">Save</button>
            {msg && <div className="save-tip">{msg}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}
