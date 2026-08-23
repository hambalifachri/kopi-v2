const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const KOPKEN_API_BASE = "https://apps.kopikenangan.com/kk-api-kopikenangan";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function kopkenHeaders(env, path) {
  const isMenuRequest = path.includes("/api/product/");
  return {
    accept: "application/json",
    "accept-language": "zh-cn",
    appid: "kopikenangan",
    appsflyer_id: isMenuRequest ? (env.KOPKEN_MENU_APPSFLYER_ID || "1787326183919-867520075700241440") : env.KOPKEN_APPSFLYER_ID,
    authorization: isMenuRequest ? (env.KOPKEN_MENU_AUTHORIZATION || env.KOPKEN_AUTHORIZATION) : env.KOPKEN_AUTHORIZATION,
    clsignature: isMenuRequest ? (env.KOPKEN_MENU_CLSIGNATURE || env.KOPKEN_CLSIGNATURE) : env.KOPKEN_CLSIGNATURE,
    "content-type": "application/json",
    deviceid: isMenuRequest ? (env.KOPKEN_MENU_DEVICE_ID || "1a657fc3c050a5be") : env.KOPKEN_DEVICE_ID,
    devicetype: "Android",
    gopay_v2: "true",
    gopay_v3: "true",
    islogin: "true",
    language: "id",
    sign_version: env.KOPKEN_SIGN_VERSION || "256",
    supportsharebuy: "true",
    timezone: "25200",
    "user-agent": isMenuRequest ? "Dart/3.10 (dart:io)" : (env.KOPKEN_USER_AGENT || "Dart/3.12 (dart:io)"),
    version: isMenuRequest ? "126.06.11" : (env.KOPKEN_VERSION || "126.08.13"),
    versioncode: isMenuRequest ? "369" : (env.KOPKEN_VERSION_CODE || "378"),
    wtoken: isMenuRequest ? (env.KOPKEN_MENU_WTOKEN || env.KOPKEN_WTOKEN) : env.KOPKEN_WTOKEN,
  };
}

async function fetchKopken(path, body, env) {
  const requiredConfig = [
    "KOPKEN_WTOKEN",
    "KOPKEN_CLSIGNATURE",
    "KOPKEN_AUTHORIZATION",
    "KOPKEN_APPSFLYER_ID",
    "KOPKEN_DEVICE_ID",
  ];
  const missingConfig = requiredConfig.filter((name) => !env[name]);
  if (missingConfig.length) {
    throw new Error(`Konfigurasi API belum lengkap: ${missingConfig.join(", ")}`);
  }

  const response = await fetch(`${KOPKEN_API_BASE}${path}`, {
    method: "POST",
    headers: kopkenHeaders(env, path),
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!response.ok || !contentType.includes("application/json")) {
    const preview = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`API Kopi Kenangan gagal (${response.status}, ${contentType || "tanpa content-type"}): ${preview}`);
  }

  return JSON.parse(text);
}

async function searchOutlets(url, env) {
  const keyword = (url.searchParams.get("keyword") || "").trim();
  if (keyword.length < 3) return jsonResponse({ outlets: [], total: 0, page: 1, hasMore: false });

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const raw = await fetchKopken("/api/store/query_pageable_store", {
    fuzzy_name: keyword,
    lat: Number(url.searchParams.get("lat")) || -6.2074218,
    lng: Number(url.searchParams.get("lng")) || 106.7342224,
    deliverable: 0,
    order_type: [],
    page: { page_index: page, page_size: 10 },
    brand_codes: [],
    disable_delivery_distance_limit: true,
  }, env);

  const stores = Array.isArray(raw?.data?.store) ? raw.data.store : [];
  const outlets = stores
    .filter((store) => store?.code && store?.name && store.brand_and_image?.some((brand) => brand.brand_code === 1))
    .map((store) => ({
      code: store.code,
      name: `Kopi Kenangan - ${store.name}`,
      address: store.address || "",
      city: store.area || "",
      category: store.category || "",
      lat: Number(store.latitude) || null,
      lng: Number(store.longitude) || null,
      isOpen: store.is_open === true && store.available === 1 && store.status === "Active",
      openStatus: store.open_status || (store.is_open ? "Buka" : "Outlet sedang tutup"),
      openTime: store.open || "",
      closeTime: store.real_close_time || store.close || "",
      phone: store.phone || "",
    }));

  const total = Number(raw?.data?.total) || outlets.length;
  const pages = Number(raw?.data?.pages) || 1;
  return jsonResponse({ outlets, total, page, hasMore: page < pages });
}

async function loadMenu(url, env) {
  const outletCode = url.searchParams.get("outletCode") || "JKT.RKMRYSN";
  const raw = await fetchKopken("/api/product/query_product_menu", {
    store_code: outletCode,
    voucher_code: null,
    product_without_promo: true,
    display_combo_v2: true,
    for_shipping: false,
    display_merchandise_product: true,
    display_mix_match_optional: true,
    support_discount_percentage: true,
  }, env);
  return jsonResponse(raw);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== "GET") return jsonResponse({ error: "Method tidak didukung" }, 405);

    try {
      const url = new URL(request.url);
      return url.pathname === "/outlets" ? await searchOutlets(url, env) : await loadMenu(url, env);
    } catch (error) {
      return jsonResponse({ error: error.message || "API sedang tidak tersedia" }, 502);
    }
  },
};
