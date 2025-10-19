import "./events.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api.js";

export default function Events() {
  const navigate = useNavigate();

  const [posts, setPosts]   = useState([]);
  const [sort, setSort]     = useState("latest"); // latest | hot
  const [q, setQ]           = useState("");
  const [title, setTitle]   = useState("");
  const [body, setBody]     = useState("");
  const [loading, setLoading] = useState(false);
  const [openIds, setOpen]  = useState(new Set()); // 展开状态集合

  const currentUser = {
    id:    sessionStorage.getItem("tds_uid")   || sessionStorage.getItem("tds_email") || sessionStorage.getItem("tds_user") || "guest",
    name:  sessionStorage.getItem("tds_user")  || "guest",
    email: sessionStorage.getItem("tds_email") || null,
  };

  const load = async (s = sort) => {
    setLoading(true);
    try {
      const list = await api.getPosts(s);
      setPosts(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load("latest"); }, []);

  const filtered = posts.filter(p =>
    (p.title || "").toLowerCase().includes(q.toLowerCase().trim())
  );

  const submit = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t) return;
    setLoading(true);
    try {
      await api.addPost({
        title: t,
        body: b,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_email: currentUser.email
      });
      setTitle(""); setBody("");
      setSort("latest");
      await load("latest");
    } catch (e) {
      console.warn(e);
      alert("Post failed, please retry.");
    } finally {
      setLoading(false);
    }
  };

  const like = async (id) => {
    try {
      await api.likePost(id, currentUser.id);
      await load(sort);
    } catch (e) {
      console.warn(e);
      alert("Like failed.");
    }
  };

  const reply = async (id) => {
    const txt = prompt("Write a short reply:");
    if (txt && txt.trim()) {
      try {
        await api.replyPost(id, txt.trim(), currentUser.id, currentUser.name);
        await load(sort);
      } catch (e) {
        console.warn(e);
        alert("Reply failed.");
      }
    }
  };

  const toggle = (id) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="events-page">
      {/* 顶部工具栏：返回主页 + 标题 + 胶囊切换 */}
      <div className="ev-toolbar">
        <button
          className="backhome"
          onClick={() => navigate("/home")}
          title="Back to Home"
          aria-label="Back"
        >←</button>
        <strong className="ev-title">Events</strong>
        <div className="ev-spacer" />
        <div className="ev-toggle" role="tablist" aria-label="Sort posts">
          <button
            type="button"
            role="tab"
            aria-selected={sort === "latest"}
            className={`ev-chip ${sort === "latest" ? "is-active" : ""}`}
            disabled={loading}
            onClick={() => { setSort("latest"); load("latest"); }}
          >Latest</button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "hot"}
            className={`ev-chip ${sort === "hot" ? "is-active" : ""}`}
            disabled={loading}
            onClick={() => { setSort("hot"); load("hot"); }}
          >Favourite</button>
        </div>
      </div>

      {/* 发帖编辑框 */}
      <div className="ev-editor">
        <input
          placeholder="Title (e.g. Noosa Wave Condition)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Body (optional)"
          rows={3}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button className="ev-post" onClick={submit} disabled={loading || !title.trim()}>
          {loading ? "Posting..." : "Posting"}
        </button>
      </div>

      {/* 搜索框 */}
      <div className="ev-searchbar">
        <input
          placeholder="Search for title…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* 帖子列表 */}
      <div className="ev-threadlist">
        {filtered.map(p => {
          const open = openIds.has(p.id);
          return (
            <div key={p.id} className={`ev-thread ${open ? "open" : ""}`}>
              <div className="ev-post-header" onClick={() => toggle(p.id)}>
                <div className="ev-post-left">
                  <span className={`ev-caret ${open ? "down" : ""}`} aria-hidden>▸</span>
                  <div className="ev-title-text" title={p.title || "(Untitled)"}>{p.title || "(Untitled)"}</div>
                </div>
                <div className="ev-post-right">
                  <span className="ev-counter">Reply {p.replies || 0}</span>
                  <button
                    className="ev-like"
                    onClick={(e) => { e.stopPropagation(); like(p.id); }}
                    title="Like / Unlike"
                  >❤️ {p.likes || 0}</button>
                  <button
                    className="ev-btn"
                    onClick={(e) => { e.stopPropagation(); reply(p.id); }}
                  >Reply</button>
                </div>
              </div>

              <div className="ev-meta">
                {(p.author_name || p.author || "anon")} · {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
              </div>

              <div className="ev-post-body" role="region" aria-expanded={open}>
                <div className="ev-post-inner">
                  {(p.body && p.body.trim())
                    ? <p className="ev-body-text">{p.body}</p>
                    : <p className="ev-body-empty">No body.</p>}
                </div>
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <div className="ev-empty">No posts yet.</div>
        )}
      </div>
    </div>
  );
}
