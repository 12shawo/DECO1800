import "./chats.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatList from "./ChatList.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { api } from "../../api.js";

export default function Chat() {
  const navigate = useNavigate();

  // ===== 我的身份（用于 me 判定） =====
  const myIdentity = useMemo(() => {
    const tokens = [
      sessionStorage.getItem("tds_uid"),
      sessionStorage.getItem("tds_user"),
      sessionStorage.getItem("tds_email"),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    if (!tokens.length) tokens.push("guest");
    return tokens;
  }, []);

  const isMine = (msg) => {
    if (msg?.me === true) return true;
    const cands = [
      msg?.senderId, msg?.sender_id, msg?.user_id, msg?.uid, msg?.from,
      msg?.sender, msg?.user, msg?.username, msg?.name, msg?.email,
    ].filter(Boolean).map((s) => String(s).toLowerCase());
    return cands.some((c) => myIdentity.includes(c));
  };

  // ===== 去重结构（防止乐观回显 + 实时重复） =====
  const seenIds = useRef(new Set());
  const pendingByHash = useRef(new Map());
  const normalize = (s) => String(s || "").trim().replace(/\s+/g, " ");
  const senderKey = (m) =>
    String(
      m?.senderId || m?.sender_id || m?.user_id || m?.uid || m?.sender || m?.username || m?.email || ""
    ).toLowerCase();
  const makeHash = (rid, sender, body) => `${String(rid)}|${String(sender)}|${normalize(body).slice(0,200)}`;

  // ===== 房间 & 消息 =====
  const [rooms, setRooms] = useState([]);
  const [room, setRoom] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState("");

  // —— 更新左侧房间预览 + 置顶排序 —— //
  const ellipsis = (t, n=30) => (t && t.length > n ? t.slice(0, n) + "…" : t || "");
  const updateRoomPreview = (roomId, msgLike) => {
    const text = ellipsis(msgLike?.body ?? msgLike?.text ?? "");
    const ts = msgLike?.time ?? msgLike?.createdAt ?? Date.now();
    setRooms((prev) => {
      const upd = prev.map((r) =>
        String(r.id) === String(roomId) ? { ...r, preview: text || "Say hi 👋", updatedAt: ts } : r
      );
      // 按 updatedAt 降序；没时间的放最后
      upd.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return upd;
    });
  };

  // 首次加载房间
  useEffect(() => {
    (async () => {
      try {
        let list = await api.listRooms();
        if (!list.length) {
          const def = await api.createRoom({ name: "Global Surf" });
          list = [def];
        }
        const mapped = list.map((r) => ({
          id: r.id,
          name: r.name,
          initials: r.name.split(/\s+/).slice(0,2).map(s=>s[0]).join("").toUpperCase(),
          preview: "Say hi 👋",
          updatedAt: 0,
        }));
        setRooms(mapped);
        setRoom((cur) => cur || mapped[0].id);
      } catch (e) {
        console.warn("listRooms fallback", e);
        const fallback = [{ id: "global", name: "Global Surf", preview: "Welcome to Surfing Chat", initials: "GS", updatedAt: 0 }];
        setRooms(fallback);
        setRoom("global");
      }
    })();
  }, []);

  // 进入房间：拉历史 & 重置去重状态 & 用最后一条更新预览
  useEffect(() => {
    if (!room) return;
    let abort = false;
    (async () => {
      try {
        const list = await api.getMessages(room);
        if (abort) return;

        seenIds.current = new Set();
        pendingByHash.current.clear();

        const mapped = list.map((m) => {
          const id = m.id || `h_${m.createdAt}_${Math.random()}`;
          seenIds.current.add(id);
          return {
            ...m,
            id,
            chatId: String(m.chatId ?? m.room_id ?? room),
            body: m.body ?? m.text ?? "",
            time: m.createdAt ?? m.time ?? Date.now(),
            me: isMine(m),
          };
        });
        setMessages(mapped);

        // 用最后一条历史更新左侧预览
        const last = mapped[mapped.length - 1];
        if (last) updateRoomPreview(room, last);
      } catch {
        setMessages([]);
      }
    })();
    return () => { abort = true; };
  }, [room]);

  // 实时：先更新左侧预览与排序；若属于当前房间，再做去重/追加
  useEffect(() => {
    const unsub = api.onMessage((msg) => {
      const rid = String(msg.chatId ?? msg.room_id ?? msg.roomId);

      // 任何房间的新消息都刷新预览（让 ChatList 显示最新并置顶）
      updateRoomPreview(rid, { body: msg.body ?? msg.text ?? "", time: msg.createdAt ?? msg.time ?? Date.now() });

      if (rid !== String(room)) return; // 非当前房间：只更新预览，不追加消息

      const realId = msg.id || `rt_${msg.createdAt}_${Math.random()}`;
      const hash = makeHash(rid, senderKey(msg), msg.body ?? msg.text ?? "");

      const tempId = pendingByHash.current.get(hash);
      if (tempId) {
        pendingByHash.current.delete(hash);
        seenIds.current.add(realId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, ...msg, id: realId, chatId: rid, body: msg.body ?? msg.text ?? m.body, time: msg.createdAt ?? msg.time ?? m.time, me: true }
              : m
          )
        );
        return;
      }

      if (seenIds.current.has(realId)) return;

      // 额外一次 hash 判重（极端情况下避免重复）
      const dup = messages.some((m) => makeHash(rid, senderKey(m), m.body) === hash);
      if (dup) { seenIds.current.add(realId); return; }

      seenIds.current.add(realId);
      setMessages((prev) => [
        ...prev,
        {
          ...msg,
          id: realId,
          chatId: rid,
          body: msg.body ?? msg.text ?? "",
          time: msg.createdAt ?? msg.time ?? Date.now(),
          me: isMine(msg),
        },
      ]);
    });
    return () => unsub && unsub();
  }, [room, messages]);

  // 发送：乐观回显 + 立即更新左侧预览（置顶）
  const handleSend = async (text) => {
    const senderId =
      sessionStorage.getItem("tds_uid") ||
      sessionStorage.getItem("tds_email") ||
      sessionStorage.getItem("tds_user") ||
      "guest";
    const username = sessionStorage.getItem("tds_user") || "guest";

    const body = String(text || "").trim();
    if (!body) return;

    const tempId = "local_" + Date.now();
    const hash = makeHash(room, senderId.toLowerCase(), body);
    pendingByHash.current.set(hash, tempId);

    // 乐观回显
    const optimistic = { id: tempId, chatId: room, body, time: Date.now(), me: true, senderId, username };
    seenIds.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);

    // 左侧预览与排序立即更新
    updateRoomPreview(room, optimistic);

    try {
      await api.addMessage({
        chatId: room,
        body,
        senderId,
        username,
        email: sessionStorage.getItem("tds_email") || null,
      });
    } catch (e) {
      console.warn("addMessage failed:", e);
    }
  };

  const handleTyping = () => {
    const nice = (myIdentity.find((t) => !/^[a-f0-9-_.@]{12,}$/i.test(t)) || myIdentity[0] || "me").replace(/@.*$/, "");
    setTypingUser(nice);
    setTimeout(() => setTypingUser(""), 900);
  };

  // 新建房间
  const handleCreateRoom = async (name) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    let created;
    try { created = await api.createRoom({ name: clean }); }
    catch (e) { console.warn("createRoom fallback", e); created = { id: clean.toLowerCase().replace(/\s+/g, "-"), name: clean }; }
    const r = {
      id: created.id,
      name: created.name,
      preview: "Say hi 👋",
      updatedAt: Date.now(),
      initials: clean.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase(),
    };
    setRooms((prev) => {
      const next = [r, ...prev];
      next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      return next;
    });
    setRoom(r.id);
  };

  return (
    <div className="chat-page">
      <ChatList rooms={rooms} currentId={room} onSelect={setRoom} onCreate={handleCreateRoom} />
      <div className="chat-container">
        <div className="chathead">
          <button className="backhome" aria-label="Back to Home" onClick={() => navigate("/home")}>←</button>
          <div className="chatname">Chats — {rooms.find((r) => r.id === room)?.name || room}</div>
        </div>
        <ChatWindow messages={messages} typing={typingUser} onSend={handleSend} onTyping={handleTyping} />
      </div>
    </div>
  );
}
