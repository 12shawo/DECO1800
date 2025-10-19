import { createClient } from "@supabase/supabase-js";

/**
 * API：Chats + Events（Posts）
 * - Chats: listRooms/createRoom/getMessages/addMessage/onMessage
 * - Posts: getPosts/addPost/likePost/replyPost
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const online = !!supabase;
const T = {
  rooms: "chats",
  messages: "messages",
  posts: "posts",
  likes: "post_likes",
  replies: "post_replies",
};

// —— LocalStorage 兜底 —— //
const LS = { rooms: "sf_rooms", messages: "sf_msgs", posts: "sf_posts", likes: "sf_likes", replies: "sf_replies" };
const read = (k, v) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : v; } catch { return v; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : "id_" + Math.random().toString(36).slice(2));

/* =========================
 * ======== CHATS ==========
 * =======================*/
async function listRooms() {
  if (!online) {
    let rooms = read(LS.rooms, []);
    if (!rooms.length) { rooms = [{ id: "global", name: "Global Surf" }]; write(LS.rooms, rooms); }
    return rooms;
  }
  const { data, error } = await supabase
    .from(T.rooms).select("id,name,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ id: String(r.id), name: r.name }));
}

async function createRoom({ name }) {
  const clean = String(name || "").trim();
  if (!clean) throw new Error("Room name required");
  if (!online) {
    const id = `${clean.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36).slice(-4)}`;
    const rooms = read(LS.rooms, []);
    const room = { id, name: clean };
    rooms.unshift(room); write(LS.rooms, rooms);
    return room;
  }
  const { data, error } = await supabase
    .from(T.rooms).insert({ name: clean }).select("id,name").single();
  if (error) throw error;
  return { id: String(data.id), name: data.name };
}

async function getMessages(chatId) {
  const rid = String(chatId);
  if (!online) {
    const all = read(LS.messages, []);
    return all
      .filter((m) => String(m.room_id) === rid)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({ ...m, chatId: String(m.room_id) }));
  }
  const { data, error } = await supabase
    .from(T.messages)
    .select("id,chat_id,room_id,body,sender_id,username,email,image_url,created_at")
    .or(`chat_id.eq.${rid},room_id.eq.${rid}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id,
    chatId: String(m.chat_id ?? m.room_id),
    room_id: m.room_id ?? m.chat_id,
    body: m.body,
    senderId: m.sender_id,
    username: m.username,
    email: m.email,
    image_url: m.image_url || null,
    createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
  }));
}

async function addMessage({ chatId, body, senderId, username, email, imageUrl }) {
  const rid = String(chatId);
  const text = String(body || "").trim();
  if (!text) throw new Error("Empty message");

  if (!online) {
    const all = read(LS.messages, []);
    const msg = {
      id: uid(),
      room_id: rid,
      chatId: rid,
      body: text,
      sender_id: senderId || "anon",
      username: username || null,
      email: email || null,
      image_url: imageUrl || null,
      createdAt: Date.now(),
    };
    all.push(msg); write(LS.messages, all); emitLocal("msg:new", msg); return msg;
  }

  const row = { chat_id: rid, body: text, sender_id: senderId || null, username: username || null, email: email || null, image_url: imageUrl || null };
  const { data, error } = await supabase
    .from(T.messages)
    .insert(row)
    .select("id,chat_id,room_id,body,sender_id,username,email,image_url,created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    chatId: String(data.chat_id ?? data.room_id),
    room_id: data.room_id ?? data.chat_id,
    body: data.body,
    senderId: data.sender_id,
    username: data.username,
    email: data.email,
    image_url: data.image_url || null,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  };
}

function onMessage(cb) {
  if (!online) return onLocal("msg:new", cb);
  const channel = supabase
    .channel("messages-insert")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: T.messages },
      (payload) => {
        const r = payload.new;
        cb({
          id: r.id,
          chatId: String(r.chat_id ?? r.room_id),
          room_id: r.room_id ?? r.chat_id,
          body: r.body,
          senderId: r.sender_id,
          username: r.username,
          email: r.email,
          image_url: r.image_url || null,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        });
      }
    ).subscribe();
  return () => supabase.removeChannel(channel);
}

/* =========================
 * ========= POSTS =========
 * =======================*/
async function getPosts(sort = "latest") {
  if (!online) {
    const posts = read(LS.posts, []);
    const likesArr = read(LS.likes, []);
    const repliesArr = read(LS.replies, []);
    const likeCount = countBy(likesArr, "post_id");
    const replyCount = countBy(repliesArr, "post_id");
    let list = posts.map(p => ({
      ...p,
      likes: likeCount[p.id] || 0,
      replies: replyCount[p.id] || 0,
    }));
    list = sort === "hot"
      ? list.sort((a,b)=>(b.likes+b.replies)-(a.likes+a.replies))
      : list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    return list;
  }

  const { data: posts, error } = await supabase
    .from(T.posts)
    .select("id,title,body,author,author_id,author_name,author_email,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: likesRows } = await supabase.from(T.likes).select("post_id");
  const { data: replyRows } = await supabase.from(T.replies).select("post_id");

  const likeCount = countBy(likesRows || [], "post_id");
  const replyCount = countBy(replyRows || [], "post_id");

  let list = (posts || []).map(p => ({
    id: String(p.id),
    title: p.title,
    body: p.body,
    author: p.author || p.author_name,
    author_id: p.author_id,
    author_name: p.author_name,
    author_email: p.author_email,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    likes: likeCount[p.id] || 0,
    replies: replyCount[p.id] || 0,
  }));

  list = sort === "hot"
    ? list.sort((a,b)=>(b.likes+b.replies)-(a.likes+a.replies))
    : list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  return list;
}

async function addPost({ title, body, author_id, author_name, author_email }) {
  const row = {
    title, body,
    author: author_name || author_email || author_id || "anon",
    author_id: author_id || null,
    author_name: author_name || null,
    author_email: author_email || null,
  };

  if (!online) {
    const posts = read(LS.posts, []);
    const post = { id: uid(), ...row, createdAt: Date.now() };
    posts.push(post); write(LS.posts, posts); return post;
  }

  const { data, error } = await supabase
    .from(T.posts).insert(row)
    .select("id,title,body,author,author_id,author_name,author_email,created_at")
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    title: data.title, body: data.body,
    author: data.author, author_id: data.author_id,
    author_name: data.author_name, author_email: data.author_email,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
  };
}

async function likePost(postId, userId){
  if (!online) {
    const likes = read(LS.likes, []);
    const idx = likes.findIndex(x => x.post_id === postId && x.user_id === userId);
    if (idx >= 0) likes.splice(idx,1); else likes.push({ id: uid(), post_id: postId, user_id: userId });
    write(LS.likes, likes);
    return true;
  }
  const { data: existed, error: e1 } = await supabase
    .from(T.likes).select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle();
  if (e1) throw e1;
  if (existed) {
    const { error } = await supabase.from(T.likes).delete().eq("id", existed.id);
    if (error) throw error; return true;
  } else {
    const { error } = await supabase.from(T.likes).insert({ post_id: postId, user_id: userId });
    if (error) throw error; return true;
  }
}

async function replyPost(postId, text, userId, userName){
  if (!online) {
    const replies = read(LS.replies, []);
    replies.push({ id: uid(), post_id: postId, body: text, user_id: userId, user_name: userName, created_at: Date.now() });
    write(LS.replies, replies);
    return true;
  }
  const { error } = await supabase.from(T.replies).insert({
    post_id: postId, body: text, user_id: userId || null, user_name: userName || null
  });
  if (error) throw error;
  return true;
}

// 小工具
function countBy(rows, key){
  const map = {};
  (rows || []).forEach(r => { const k = String(r[key]); map[k] = (map[k]||0) + 1; });
  return map;
}

/* ======= Local tiny bus（仅聊天实时兜底用） ======= */
const listeners = {};
function onLocal(evt, cb) { (listeners[evt] || (listeners[evt] = new Set())).add(cb); return () => listeners[evt]?.delete(cb); }
function emitLocal(evt, data) { listeners[evt]?.forEach((fn) => fn(data)); }

export const api = {
  // chats
  listRooms, createRoom, getMessages, addMessage, onMessage,
  // posts
  getPosts, addPost, likePost, replyPost,
};
