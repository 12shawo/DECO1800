// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

// 布局（带头部/导航），仅登录后的页面使用
import Layout from "./components/Layout.jsx";

// 页面
import Login from "./pages/login/Login.jsx";
import Home from "./pages/home/Home.jsx";
import MapPage from "./pages/map/Map.jsx";
import Events from "./pages/events/Events.jsx";
import Chat from "./pages/chats/Chat.jsx";
import Profile from "./pages/profile/Profile.jsx";

const SESSION_KEY = "tds_user";

// 登录保护：未登录跳 /login
function RequireAuth({ children }) {
  const user = sessionStorage.getItem(SESSION_KEY);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* 默认去登录 */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 登录页：不使用 Layout，这样就不会有顶部导航 */}
      <Route path="/login" element={<Login />} />

      {/* 登录后的页面：统一包在 Layout 下 */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/events" element={<Events />} />
        <Route path="/chats" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* 兜底 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
