import "./chats.css";
import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow({ messages = [], onSend, typing, onTyping }) {
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = (inputRef.current?.value || "").trim();
    if (!val) return;
    onSend?.(val);
    inputRef.current.value = "";
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };

  return (
    <div className="chatwin">
      <div className="msgs" ref={listRef}>
        {messages.map((m, i) => (
          <div key={m.id || i} className={`msg-row ${m.me ? "me" : "other"}`}>
            <MessageBubble
              me={m.me}
              body={m.body ?? m.text ?? ""}
              time={m.time ?? m.created_at ?? Date.now()}
            />
          </div>
        ))}
        {typing && <div className="typing">Someone is typing…</div>}
      </div>

      <form className="inputbar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="chat-input"
          placeholder="Type a message…"
          onChange={onTyping}
          onFocus={() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }
          }}
        />
        <button type="submit" className="send">Send</button>
      </form>
    </div>
  );
}
