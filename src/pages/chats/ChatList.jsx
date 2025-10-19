import "./chats.css";
import { useRef } from "react";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ChatList({ rooms = [], currentId, onSelect, onCreate }) {
  const inputRef = useRef(null);

  const submitNew = (e) => {
    e?.preventDefault?.();
    const name = (inputRef.current?.value || "").trim();
    if (!name) return;
    onCreate?.(name);
    inputRef.current.value = "";
  };

  return (
    <div className="chatlist">
      <div className="search">
        <form onSubmit={submitNew} className="newchat">
          <input ref={inputRef} className="input" placeholder="Create a new room… Enter" />
          <button type="submit" className="newbtn" title="Create">+</button>
        </form>
      </div>

      <div className="chatitems">
        {rooms.map((it) => (
          <div
            key={it.id}
            className={`chatitem ${String(currentId) === String(it.id) ? "selected" : ""}`}
            aria-selected={String(currentId) === String(it.id)}
            onClick={() => onSelect?.(it.id)}
          >
            <div className="avatar">{(it.initials || "??").slice(0,2)}</div>

            <div className="meta">
              <div className="name-row">
                <div className="name" title={it.name}>{it.name}</div>
                {/* 只有有时间时才显示，避免空白占位看起来“怪” */}
                {it.updatedAt ? <div className="time">{formatTime(it.updatedAt)}</div> : null}
              </div>
              <div className="preview" title={it.preview || "Say hi 👋"}>
                {it.preview || "Say hi 👋"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
