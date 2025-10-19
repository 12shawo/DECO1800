// src/pages/login/Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const USER_DB_KEY = "users";           // 新键：数组
const LEGACY_KEYS = ["tds_users_v1"];  // 兼容旧键：对象映射
const SESSION_KEY = "tds_user";        // 已登录用户名

// —— 旧格式 → 统一为数组 ——
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return toArray(JSON.parse(val)); } catch { return []; }
  }
  if (typeof val === "object") return Object.values(val);
  return [];
}
function readUsers() {
  try {
    const raw = localStorage.getItem(USER_DB_KEY);
    let arr = toArray(raw ? JSON.parse(raw) : []);
    if (arr.length > 0) return arr;
    for (const k of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(k);
      if (!legacyRaw) continue;
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        arr = toArray(legacyParsed);
        if (arr.length > 0) {
          localStorage.setItem(USER_DB_KEY, JSON.stringify(arr));
          return arr;
        }
      } catch {}
    }
    return [];
  } catch { return []; }
}
function writeUsers(arr) {
  localStorage.setItem(USER_DB_KEY, JSON.stringify(toArray(arr)));
}

export default function Login({ redirectTo = "/home" }) {
  const nav = useNavigate();

  // 背景：surfBackground.jpg
  useEffect(() => {
    const prev = {
      backgroundImage: document.body.style.backgroundImage,
      backgroundSize: document.body.style.backgroundSize,
      backgroundPosition: document.body.style.backgroundPosition,
      backgroundRepeat: document.body.style.backgroundRepeat,
      margin: document.body.style.margin,
      minHeight: document.body.style.minHeight,
    };
    document.body.style.backgroundImage = 'url("/images/surfBackground.jpg")';
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    return () => { Object.assign(document.body.style, prev); };
  }, []);

  // 已登录直接跳
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) goAfterAuth(redirectTo);
  }, []); // eslint-disable-line

  // 注入 demo 用户（带 mobile），并顺手把旧格式写回为数组
  useEffect(() => {
    let list = readUsers();
    if (!list.find(u => u.username === "john")) {
      list.push({
        fullName: "John Doe",
        email: "john@example.com",
        username: "john",
        mobile: "+61 400 000 000",
        password: "password123",
      });
    }
    writeUsers(list);
  }, []);

  const [mode, setMode] = useState("login"); // login | signup
  const [loginMsg, setLoginMsg] = useState("");
  const [signupMsg, setSignupMsg] = useState("");

  // 登录
  const onLogin = (e) => {
    e.preventDefault();
    setLoginMsg("");
    const fd = new FormData(e.currentTarget);
    const id = (fd.get("identifier") || "").toString().trim(); // 用户名或邮箱
    const pw = (fd.get("password") || "").toString();
    const users = readUsers();
    const u = users.find(x => (x.username === id || x.email === id) && x.password === pw);
    if (!u) { setLoginMsg("Wrong credentials"); return; }
    sessionStorage.setItem(SESSION_KEY, u.username);
    goAfterAuth(redirectTo);
  };

  // 注册（新增 mobile 必填）
  const onSignup = (e) => {
    e.preventDefault();
    setSignupMsg("");
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()); // fullName,email,username,password,mobile
    const { fullName, email, username, password, mobile } = data;
    if (!fullName || !email || !username || !password || !mobile) {
      setSignupMsg("Please complete all fields"); return;
    }
    // 简单手机号校验（可按需放宽/改规则）
    const okPhone = /^[0-9+\-\s()]{6,}$/.test(mobile);
    if (!okPhone) { setSignupMsg("Invalid phone number"); return; }

    const users = readUsers();
    if (users.some(u => u.username === username || u.email === email)) {
      setSignupMsg("Username or email already exists"); return;
    }
    users.push({ fullName, email, username, password, mobile });
    writeUsers(users);
    sessionStorage.setItem(SESSION_KEY, username);
    goAfterAuth(redirectTo);
  };

  const goAfterAuth = (to) => {
    const url = to || "/home";
    if (url.endsWith(".html")) window.location.href = url;
    else nav(url, { replace: true });
  };

  // 极简卡片 UI（内联样式）
  const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
  const card = { width: "100%", maxWidth: 420, background: "rgba(255,255,255,.92)", borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.15)", padding: 24, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial" };
  const title = { margin: "8px 0 4px", fontSize: 28, fontWeight: 700, textAlign: "center" };
  const sub = { margin: "0 0 16px", fontSize: 12, color: "#6b7280", textAlign: "center" };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", outline: "none", marginTop: 6, marginBottom: 12, fontSize: 14 };
  const btn = (primary=false) => ({ width: "100%", padding: "10px 14px", borderRadius: 10, border: "none", background: primary ? "#3b82f6" : "#e5e7eb", color: primary ? "#fff" : "#111", fontWeight: 600, cursor: "pointer", marginTop: 4, marginBottom: 8 });
  const link = { display: "block", textAlign: "center", color: "#3b82f6", fontSize: 13, marginTop: 4, cursor: "pointer", background: "transparent", border: "none" };
  const err = { color: "#dc2626", fontSize: 13, marginTop: 4, textAlign: "center" };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{textAlign:"center", fontSize:40}}>🏄</div>
        <h1 style={title}>SurfFinder</h1>
        <p style={sub}>Social app for surfers</p>

        {mode === "login" ? (
          <>
            <form onSubmit={onLogin}>
              <label>
                <div>Email or Username</div>
                <input name="identifier" type="text" style={input} required />
              </label>
              <label>
                <div>Password</div>
                <input name="password" type="password" style={input} required minLength={6} />
              </label>
              <button type="submit" style={btn(true)}>Log In</button>
            </form>
            <button style={btn(false)} onClick={() => setMode("signup")}>Create Account</button>
            <button style={link} onClick={() => { sessionStorage.setItem(SESSION_KEY, "Guest User"); goAfterAuth(redirectTo); }}>
              Skip for now
            </button>
            {loginMsg && <div style={err}>{loginMsg}</div>}
          </>
        ) : (
          <>
            <form onSubmit={onSignup}>
              <label>
                <div>Full Name</div>
                <input name="fullName" type="text" style={input} required />
              </label>
              <label>
                <div>E-mail</div>
                <input name="email" type="email" style={input} required />
              </label>
              <label>
                <div>Mobile</div>
                <input
                  name="mobile"
                  type="tel"
                  style={input}
                  required
                  pattern="[0-9+\-\s()]{6,}"
                  title="Use digits and (+ - ( ) space); at least 6 characters"
                />
              </label>
              <label>
                <div>Username</div>
                <input name="username" type="text" style={input} required />
              </label>
              <label>
                <div>Password</div>
                <input name="password" type="password" style={input} required minLength={6} />
              </label>
              <button type="submit" style={btn(false)}>Create Account</button>
            </form>
            <button style={link} onClick={() => setMode("login")}>Back to login</button>
            {signupMsg && <div style={err}>{signupMsg}</div>}
          </>
        )}
      </div>
    </div>
  );
}
