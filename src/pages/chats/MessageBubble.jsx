import "./chats.css";

export default function MessageBubble({ me, body, time }) {
  return (
    <div className="bubble">
      <div>{body}</div>
      <span className="time">
        {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
