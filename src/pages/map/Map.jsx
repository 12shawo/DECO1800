import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./map.css";

export default function MapPage() {
  const [showSafety, setShowSafety] = useState(true);
  const [showExplain, setShowExplain] = useState(false);
  const [explainTitle, setExplainTitle] = useState("");
  const [explainContent, setExplainContent] = useState("");
  const searchRef = useRef(null);
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  // 动态注入 Font Awesome
  useEffect(() => {
    const href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
    let link;
    if (
      ![...document.querySelectorAll('link[rel="stylesheet"]')].some((l) =>
        l.href.includes("font-awesome")
      )
    ) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
    return () => {
      if (link) document.head.removeChild(link);
    };
  }, []);

  // 指标说明
  const explanations = useMemo(
    () => ({
      swell: {
        title: "About Swell",
        content:
          "Swell refers to the smooth, rolling waves that travel long distances across the ocean. <strong>For beginners, smaller waves with a decent period are friendlier (0.3–1.0m, 8–12s).</strong>",
      },
      temp: {
        title: "About Temperature",
        content:
          "This is the air temperature. <strong>20–28°C</strong> is comfortable for most surfers without a wetsuit.",
      },
      wind: {
        title: "About Wind",
        content:
          "Wind is critical for wave quality. <strong>Offshore wind</strong> (from land to sea) smooths the face; strong onshore wind makes it choppy.",
      },
      rain: {
        title: "About Rain",
        content:
          "Light rain is fine; <strong>avoid thunderstorm</strong>. Heavy rain reduces visibility and comfort.",
      },
    }),
    []
  );
  function openExplain(key) {
    const d = explanations[key];
    if (!d) return;
    setExplainTitle(d.title);
    setExplainContent(d.content);
    setShowExplain(true);
  }

  // 冲浪点（含朝向）
  const surfSpots = useMemo(
    () => [
      { name: "Noosa Heads Main Beach", lat: -26.3884, lng: 153.0886, orientation: 45 },
      { name: "Mooloolaba Beach",       lat: -26.671,  lng: 153.1235, orientation: 90 },
      { name: "Burleigh Heads",         lat: -28.0872, lng: 153.4542, orientation: 110 },
      { name: "Surfers Paradise",       lat: -28.0013, lng: 153.4308, orientation: 90 },
      { name: "Coolangatta",            lat: -28.1667, lng: 153.5333, orientation: 110 },
      { name: "Stradbroke (Cylinder)",  lat: -27.426,  lng: 153.49,   orientation: 45 },
    ],
    []
  );

  /* ============ 优化后的评分算法（默认 Beginner 友好） ============ */
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
  const angleDiffDeg = (a, b) => Math.abs(((a - b + 540) % 360) - 180); // 0..180

  function beginnerHeightScore(h) {
    // 0–0.2m 几乎无浪 -> 0
    if (h <= 0.2) return 0;
    // 0.2–1.0m 快速升到高分（0.7 -> 1.0）
    if (h <= 1.0) return 0.7 + 0.3 * invLerp(0.2, 1.0, h);
    // 1.0–1.5m 缓慢降到 0.6
    if (h <= 1.5) return 1.0 - 0.4 * invLerp(1.0, 1.5, h);
    // >1.5m 迅速降到 0
    return Math.max(0, 0.6 - invLerp(1.5, 3.0, h) * 0.6);
  }

  function calculateSurfScore(marine, weather, spot) {
    const h = Number(marine.swell_wave_height); // m
    const p = Number(marine.swell_period);      // s
    const ws = Number(weather.wind_speed_10m);  // km/h
    const wd = Number(weather.wind_direction_10m);
    const rain = Number(weather.rain || 0);     // mm/h
    const t = Number(weather.temperature_2m);   // °C

    // 浪高（Beginner 偏好小浪）
    const heightScore = beginnerHeightScore(h);

    // 周期：6s -> 0, 15s -> 1
    const periodScore = invLerp(6, 15, p);

    // 风向：相对离岸风 (orientation+180) 的差角，<=30° 1 分，≥90° 0 分
    const offshore = (spot.orientation + 180) % 360;
    const dir = angleDiffDeg(wd, offshore);
    const dirScore =
      dir <= 30 ? 1 : dir >= 90 ? 0 : 1 - (dir - 30) / 60;

    // 风速：<=10 -> 1, >=40 -> 0
    const speedScore = 1 - invLerp(10, 40, ws);

    // 雨：0 -> 1, 5 -> 0
    const rainScore = 1 - invLerp(0, 5, rain);

    // 温度：20–28 最佳；[12,20)、(28,34] 线性下降；<=12 或 >=34 -> 0
    let tempScore;
    if (t >= 20 && t <= 28) tempScore = 1;
    else if (t < 20 && t >= 12) tempScore = invLerp(12, 20, t);
    else if (t > 28 && t <= 34) tempScore = 1 - invLerp(28, 34, t);
    else tempScore = 0;

    // 权重（偏向新手：浪高/风向/周期）
    const score01 =
      0.30 * heightScore +
      0.24 * periodScore +
      0.24 * dirScore +
      0.12 * speedScore +
      0.05 * rainScore +
      0.05 * tempScore;

    let score = clamp(score01 * 10, 0, 10);
    score = Math.round(score * 10) / 10;

    // 难度标签
    let diff, color;
    if (score >= 7) { diff = "Beginner"; color = "#22c55e"; }
    else if (score >= 4) { diff = "Intermediate"; color = "#f59e0b"; }
    else { diff = "Advanced"; color = "#ef4444"; }

    // 描述更贴 Beginner 直觉
    const desc = [];
    if (heightScore >= 0.75) desc.push("Friendly wave height.");
    else if (h <= 0.2) desc.push("Too flat.");
    if (periodScore >= 0.6) desc.push("Good swell period.");
    if (dirScore >= 0.7) desc.push("Offshore wind (clean faces).");
    if (speedScore <= 0.4) desc.push("Too windy.");
    if (rain > 2) desc.push("Heavy rain.");
    if (tempScore < 0.4) desc.push("Temperature may be uncomfortable.");

    return {
      score,
      difficulty: { label: diff, color },
      description: desc.length ? desc.join(" ") : "Decent conditions.",
    };
  }

  // 初始化地图（点击 Continue 后）
  useEffect(() => {
    if (showSafety || mapRef.current || !mapDivRef.current) return;

    const map = L.map(mapDivRef.current, { zoomControl: false }).setView([-27.4, 153.2], 9);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    // 返回主页按钮
    const BackHome = L.Control.extend({
      options: { position: "topleft" },
      onAdd: () => {
        const c = L.DomUtil.create("div", "leaflet-bar leaflet-control home-button");
        const a = L.DomUtil.create("a", "", c);
        a.href = "#"; a.innerHTML = "&larr;"; a.title = "Return to Home";
        L.DomEvent.on(a, "click", (e) => { e.preventDefault(); navigate("/home"); });
        L.DomEvent.disableClickPropagation(a);
        return c;
      },
    });
    new BackHome().addTo(map);

    // —— 修复“只能点一次”：每个 marker 只 bindPopup 一次，点击时更新内容 —— //
    surfSpots.forEach((spot) => {
      const marker = L.marker([spot.lat, spot.lng]).addTo(map);
      const popup = L.popup({ maxWidth: 360, autoPan: true });
      marker.bindPopup(popup);

      marker.on("click", async () => {
        popup.setContent("<b>Loading conditions...</b>");
        marker.openPopup();

        const marineApiUrl =
          `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=swell_wave_height,swell_wave_peak_period,swell_wave_period`;
        const forecastApiUrl =
          `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=temperature_2m,wind_direction_10m,wind_speed_10m,rain,weather_code`;

        try {
          const [marineResponse, forecastResponse] = await Promise.all([
            fetch(marineApiUrl).then((r) => r.json()),
            fetch(forecastApiUrl).then((r) => r.json()),
          ]);

          const hour = new Date().getUTCHours();

          const currentMarine = {
            swell_wave_height: marineResponse?.hourly?.swell_wave_height?.[hour],
            swell_period:
              marineResponse?.hourly?.swell_wave_peak_period?.[hour] ??
              marineResponse?.hourly?.swell_wave_period?.[hour],
          };

          const currentWeather = {
            temperature_2m:  forecastResponse?.hourly?.temperature_2m?.[hour],
            wind_direction_10m: forecastResponse?.hourly?.wind_direction_10m?.[hour],
            wind_speed_10m:   forecastResponse?.hourly?.wind_speed_10m?.[hour],
            rain:              forecastResponse?.hourly?.rain?.[hour] ?? 0,
            weather_code:      forecastResponse?.hourly?.weather_code?.[hour],
          };

          if (
            currentMarine.swell_wave_height == null ||
            currentMarine.swell_period == null ||
            currentWeather.wind_direction_10m == null
          ) {
            popup.setContent("<b>Data unavailable for this hour.</b>");
            return;
          }

          const surf = calculateSurfScore(currentMarine, currentWeather, spot);

          const html = `
            <div class="popup">
              <div class="popup-header">
                <i class="fa-solid fa-location-dot"></i>
                <span class="spot-name">${spot.name}</span>
              </div>
              <div class="surf-score-display" title="7–10=Beginner friendly · 4–6=Intermediate · 1–3=Advanced">
                <div class="surf-rating">
                  <span class="rating-label">Difficulty:</span>
                  <span class="difficulty-badge" style="background:${surf.difficulty.color};">${surf.difficulty.label}</span>
                  <span class="rating-score">(${surf.score} / 10)</span>
                  <div class="score-description">${surf.description}</div>
                </div>
              </div>
              <ul class="conditions-list">
                <li><i class="fa-solid fa-water"></i> <span class="data-label" data-key="swell">Swell:</span> ${Number(currentMarine.swell_wave_height).toFixed(1)}m @ ${Number(currentMarine.swell_period).toFixed(1)}s</li>
                <li><i class="fa-solid fa-wave-square"></i> <span class="data-label" data-key="temp">Temp:</span> ${Number(currentWeather.temperature_2m).toFixed(1)}°C</li>
                <li><i class="fa-solid fa-compass"></i> <span class="data-label" data-key="wind">Wind:</span> ${Number(currentWeather.wind_speed_10m).toFixed(0)} km/h · ${Number(currentWeather.wind_direction_10m).toFixed(0)}°</li>
                <li><i class="fa-solid fa-cloud-rain"></i> <span class="data-label" data-key="rain">Rain:</span> ${Number(currentWeather.rain).toFixed(1)} mm</li>
              </ul>
            </div>
          `;
          popup.setContent(html);
        } catch (e) {
          console.error("fetch error:", e);
          popup.setContent("<b>Could not load data.</b>");
        }
      });
    });

    // 指标说明点击（注册一次）
    const onPopupOpen = (e) => {
      const node = e.popup.getElement();
      node.addEventListener("click", (evt) => {
        const t = evt.target;
        if (t.classList.contains("data-label")) {
          const key = t.getAttribute("data-key");
          openExplain(key);
        }
      });
    };
    map.on("popupopen", onPopupOpen);

    // 容器从 display:none→block 后，强制刷新尺寸
    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.off("popupopen", onPopupOpen);
      map.remove();
      mapRef.current = null;
    };
  }, [showSafety, navigate, surfSpots]);

  // 搜索
  const onKeyPress = (e) => {
    if (e.key !== "Enter") return;
    const query = (searchRef.current?.value || "").trim();
    if (!query || !mapRef.current) return;

    const input = searchRef.current;
    input.placeholder = "Searching...";
    input.disabled = true;

    const fullQuery = `${query} Queensland, Australia`;
    const apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}`;

    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        input.placeholder = "Search here";
        input.disabled = false;
        input.value = "";
        if (data && data.length > 0) {
          mapRef.current.flyTo([data[0].lat, data[0].lon], 13);
        } else {
          alert("Location not found. Please try another search.");
        }
      })
      .catch((err) => {
        console.error("geocoding error:", err);
        input.placeholder = "Search here";
        input.disabled = false;
        alert("There was an error with the search service. Please try again later.");
      });
  };

  return (
    <div>
      {/* 安全提醒 */}
      {showSafety && (
        <div id="safety-modal" className="modal-overlay">
          <div className="modal-content">
            <h2>Reminder before use</h2>
            <div className="modal-image">
              <img src="/images/Surfing.jpg" alt="Surfing" />
            </div>
            <div className="safety-text">
              <p>HOW CAN YOU STAY SAFE WHILE AT UNPATROLLED BEACHES?</p>
              <p><strong>ALWAYS swim at beaches that have surf lifesaving patrols and only between the red and yellow flags.</strong></p>
              <p>If you find yourself at an unpatrolled beach, make sure you:</p>
              <ul>
                <li>Read and understand any safety signs.</li>
                <li>Observe the surf before entering the water.</li>
                <li>Stay in shallow water if unsure.</li>
                <li>Swim with a friend, supervise children.</li>
                <li>Avoid dawn/dusk surfing, and never drink and swim.</li>
              </ul>
            </div>
            <button id="continue-btn" onClick={() => setShowSafety(false)}>Continue to the map</button>
          </div>
        </div>
      )}

      {/* 地图 */}
      <div id="map-container" style={{ display: showSafety ? "none" : "block" }}>
        <div className="search-bar">
          <input
            id="search-input"
            ref={searchRef}
            type="text"
            placeholder="Search here"
            onKeyPress={onKeyPress}
          />
        </div>
        <div id="map" ref={mapDivRef} />
      </div>

      {/* 指标说明弹窗 */}
      {showExplain && (
        <div id="explanation-modal" className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-content">
            <h2 id="explanation-title">{explainTitle}</h2>
            <div
              id="explanation-content"
              className="safety-text"
              dangerouslySetInnerHTML={{ __html: explainContent }}
            />
            <button id="close-explanation-btn" onClick={() => setShowExplain(false)}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
