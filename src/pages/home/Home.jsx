import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./home.css";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const user = useMemo(() => sessionStorage.getItem("tds_user") || "Guest User", []);

  // 去掉 body 默认白边（进入时设为0，离开恢复）
  useEffect(() => {
    const prev = { margin: document.body.style.margin, backgroundColor: document.body.style.backgroundColor };
    document.body.style.margin = "0";
    document.body.style.backgroundColor = "transparent";
    return () => Object.assign(document.body.style, prev);
  }, []);

  // 推荐事件（示例数据；接后端时替换即可）
  const recEvents = [
    { id: "e1", title: "Sunrise Session", when: "Sun · 6:00 AM", where: "Bondi Beach" },
    { id: "e2", title: "Weekend Swell",   when: "Sat · 3:30 PM", where: "Burleigh Heads" },
    { id: "e3", title: "Beginner Meetup",  when: "Fri · 4:00 PM", where: "Manly" },
  ];

  const handleOpenEvent = (id) => {
    sessionStorage.setItem("open_event_id", id);
    navigate("/events");
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem("tds_user"); } catch {}
    navigate("/login", { replace: true });
  };

  return (
    <div className="home-page">
      {/* 背景轻遮罩 */}
      <div className="bg-overlay" aria-hidden="true" />

      {/* 右上角浮动菜单按钮 */}
      <button
        className="btn-menu"
        aria-label="menu"
        onClick={() => setMenuOpen(v => !v)}
      >
        ☰
      </button>

      {/* 侧边栏（只保留 Logout / Contact us） */}
      {menuOpen && (
        <aside className="side-sheet">
          <div className="side-title">Menu</div>

          <button type="button" className="menu-item btn" onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>

          <a href="mailto:contact@surffinder.app" className="menu-item link">
            <span>✉️</span> Contact us
          </a>
        </aside>
      )}

      {/* 内容容器 */}
      <div className="container">
        {/* 欢迎横幅 */}
        <section className="hero">
          <div className="brand">SurfFinder</div>
          <div className="welcome">Hello! {user}</div>
        </section>

        {/* 2×2 主功能卡片 */}
        <section className="navigation-grid">
          <MainCard to="/map"     icon="🧭" label="Map" />
          <MainCard to="/chats"   icon="💬" label="Chats" />
          <MainCard to="/events"  icon="📅" label="Events" />
          <MainCard to="/profile" icon="👤" label="Profile" />
        </section>

        {/* 推荐事件 */}
        <section className="recs">
          <h3>Recommended Events</h3>
          <div className="rec-grid">
            {recEvents.map(ev => (
              <article key={ev.id} className="event-card" onClick={() => handleOpenEvent(ev.id)}>
                <div className="event-cover" aria-hidden="true">🌊</div>
                <div className="event-body">
                  <div className="event-title">{ev.title}</div>
                  <div className="event-meta">{ev.when} · {ev.where}</div>
                  <button className="event-btn">View post</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MainCard({ to, icon, label }) {
  return (
    <Link to={to} className="main-card">
      <div className="main-icon">{icon}</div>
      <div className="main-label">{label}</div>
    </Link>
  );
}
