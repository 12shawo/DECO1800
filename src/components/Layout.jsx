// src/components/Layout.jsx
import React from "react";
import { Outlet } from "react-router-dom";

// 纯容器布局：不再渲染任何头部/导航，页面内容自行控制
export default function Layout() {
  return <Outlet />;
}
