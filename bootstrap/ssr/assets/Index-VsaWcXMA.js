import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { t as _sfc_main } from "./AuthenticatedLayout-Eh2FghNL.js";
import { t as useGeolocation } from "./useGeolocation-C4grL3cw.js";
import { t as useTheme } from "./useTheme-bkO1S2cW.js";
import { Fragment, Transition, computed, createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, isRef, nextTick, onMounted, onUnmounted, openBlock, ref, renderList, toDisplayString, unref, useSSRContext, vModelCheckbox, vModelText, watch, withCtx, withDirectives, withModifiers } from "vue";
import { Head, usePage } from "@inertiajs/vue3";
import { defineStore } from "pinia";
import { ssrIncludeBooleanAttr, ssrInterpolate, ssrLooseContain, ssrRenderAttr, ssrRenderClass, ssrRenderComponent, ssrRenderList } from "vue/server-renderer";
import axios from "axios";
import * as maplibregl from "maplibre-gl";
//#region resources/js/stores/pins.ts
var usePinsStore = defineStore("pins", () => {
	const pins = ref([]);
	const loading = ref(false);
	let inflight = null;
	let lastFetch = 0;
	async function fetchNearby(lat, lng) {
		const now = Date.now();
		if (inflight) return inflight;
		if (now - lastFetch < 900) return Promise.resolve(pins.value);
		loading.value = true;
		lastFetch = now;
		inflight = axios.get("/api/pins", { params: {
			lat,
			lng
		} }).then(({ data }) => {
			pins.value = data;
			return data;
		}).catch(() => pins.value).finally(() => {
			loading.value = false;
			inflight = null;
		});
		return inflight;
	}
	async function createPin(payload) {
		const { data } = await axios.post("/api/pins", payload);
		pins.value.unshift(data);
		return data;
	}
	async function deletePin(id) {
		await axios.delete(`/api/pins/${id}`);
		pins.value = pins.value.filter((p) => p.id !== id);
		return true;
	}
	async function updatePin(id, payload) {
		const { data } = await axios.patch(`/api/pins/${id}`, payload);
		const idx = pins.value.findIndex((p) => p.id === id);
		if (idx !== -1) pins.value[idx] = {
			...pins.value[idx],
			...data
		};
		return data;
	}
	async function fetchMine() {
		const { data } = await axios.get("/api/pins/mine");
		return Array.isArray(data) ? data : data.data || [];
	}
	function addRealtime(pin) {
		if (!pins.value.find((p) => p.id === pin.id)) pins.value.unshift(pin);
	}
	function removeRealtime(id) {
		pins.value = pins.value.filter((p) => p.id !== id);
	}
	return {
		pins,
		loading,
		fetchNearby,
		createPin,
		deletePin,
		updatePin,
		fetchMine,
		addRealtime,
		removeRealtime
	};
});
//#endregion
//#region resources/js/composables/usePins.ts
var selectedCategory = ref("all");
function usePins() {
	const store = usePinsStore();
	const categories = [
		{
			v: "question",
			l: "Вопрос",
			i: "💬"
		},
		{
			v: "announcement",
			l: "Объявление",
			i: "📍"
		},
		{
			v: "warning",
			l: "Предупреждение",
			i: "⚠️"
		},
		{
			v: "event",
			l: "Событие",
			i: "🎉"
		},
		{
			v: "offer",
			l: "Отдам",
			i: "📦"
		},
		{
			v: "help",
			l: "Помощь",
			i: "🤝"
		}
	];
	const filteredPins = computed(() => selectedCategory.value === "all" ? store.pins : store.pins.filter((p) => p.category === selectedCategory.value));
	async function fetchNearby(lat, lng) {
		await store.fetchNearby(lat, lng);
	}
	async function createPin(payload) {
		return await store.createPin(payload);
	}
	function addRealtime(pin) {
		store.addRealtime(pin);
	}
	function removeRealtime(id) {
		store.removeRealtime(id);
	}
	return {
		store,
		categories,
		selectedCategory,
		filteredPins,
		fetchNearby,
		createPin,
		addRealtime,
		removeRealtime
	};
}
//#endregion
//#region resources/js/composables/useMap.ts
var OSM_RASTER_STYLE = {
	version: 8,
	sources: { osm: {
		type: "raster",
		tiles: [
			"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
			"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
		],
		tileSize: 256,
		attribution: "© OpenStreetMap contributors",
		maxzoom: 19
	} },
	layers: [{
		id: "osm",
		type: "raster",
		source: "osm",
		minzoom: 0,
		maxzoom: 19
	}]
};
function useMap(onPinClick, onPinEdit) {
	const mapContainer = ref(null);
	let map;
	let markers = [];
	let polling = null;
	const { store, selectedCategory } = usePins();
	const loaded = ref(false);
	const errorMsg = ref("");
	const LIGHT_STYLES = [
		OSM_RASTER_STYLE,
		"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
		"https://demotiles.maplibre.org/style.json"
	];
	function getStyles() {
		return LIGHT_STYLES;
	}
	async function initMap(center = [27.5615, 53.9022], onMapClick) {
		await nextTick();
		if (!mapContainer.value) return;
		const tryStyles = getStyles();
		let styleIndex = 0;
		let loadTimer = null;
		const create = (style) => {
			if (map) try {
				map.remove();
			} catch {}
			loaded.value = false;
			errorMsg.value = "";
			clearTimeout(loadTimer);
			map = new maplibregl.Map({
				container: mapContainer.value,
				style,
				center,
				zoom: 13,
				attributionControl: false
			});
			map.addControl(new maplibregl.NavigationControl({
				showCompass: true,
				showZoom: true,
				visualizePitch: true
			}), "bottom-right");
			map.addControl(new maplibregl.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true,
					timeout: 8e3
				},
				trackUserLocation: true,
				showAccuracyCircle: true,
				showUserLocation: true,
				fitBoundsOptions: { maxZoom: 15 }
			}), "bottom-right");
			map.addControl(new maplibregl.ScaleControl({
				maxWidth: 120,
				unit: "metric"
			}), "bottom-left");
			map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
			const onReady = () => {
				if (loaded.value) return;
				loaded.value = true;
				clearTimeout(loadTimer);
				map.resize();
				renderPins();
			};
			map.once("load", onReady);
			map.once("idle", onReady);
			loadTimer = setTimeout(onReady, 2500);
			map.on("styleimagemissing", () => {});
			map.on("error", (e) => {
				const msg = e?.error?.message || e?.error || "";
				const isStyleError = String(msg).includes("Failed to fetch") || String(msg).includes("style") || e?.status === 404 || String(msg).includes("Load failed");
				if (isStyleError && styleIndex < tryStyles.length - 1) {
					clearTimeout(loadTimer);
					styleIndex++;
					errorMsg.value = "Переключаем стиль карты…";
					setTimeout(() => create(tryStyles[styleIndex]), 300);
				} else if (isStyleError) {
					errorMsg.value = String(msg);
					onReady();
				}
				console.error("Map error", e);
			});
			if (onMapClick) map.on("click", onMapClick);
			map.on("click", hideCtxMenu);
			map.on("dragstart", hideCtxMenu);
			let moveTimer = null;
			let lastCenter = {
				lat: center[1],
				lng: center[0]
			};
			map.on("moveend", () => {
				if (!map) return;
				const c = map.getCenter();
				if (Math.hypot(c.lat - lastCenter.lat, c.lng - lastCenter.lng) < 5e-4) return;
				clearTimeout(moveTimer);
				moveTimer = setTimeout(() => {
					lastCenter = {
						lat: c.lat,
						lng: c.lng
					};
					store.fetchNearby(c.lat, c.lng).then(renderPins).catch(() => {});
				}, 550);
			});
		};
		create(tryStyles[0]);
		watch(selectedCategory, renderPins);
	}
	function getCurrentUserId() {
		try {
			const pg = usePage();
			if (pg?.props?.auth?.user?.id) return pg.props.auth.user.id;
		} catch {}
		try {
			const p = window.__inertia?.page?.props || document.__inertiaPage || null;
			if (p?.auth?.user?.id) return p.auth.user.id;
		} catch {}
		try {
			const el = document.getElementById("app");
			if (el?.dataset?.page) return JSON.parse(el.dataset.page).props?.auth?.user?.id || null;
		} catch {}
		return null;
	}
	let pinTooltip = null;
	function ensureTooltip() {
		if (pinTooltip) return pinTooltip;
		pinTooltip = document.createElement("div");
		pinTooltip.className = "hidden fixed z-[40] pointer-events-none max-w-[300px] bg-white border border-stone-200 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.18)] overflow-hidden";
		pinTooltip.style.transform = "translate(-50%, calc(-100% - 14px))";
		document.body.appendChild(pinTooltip);
		return pinTooltip;
	}
	function showPinTip(p, x, y) {
		const tip = ensureTooltip();
		const catIcon = {
			question: "💬",
			announcement: "📍",
			warning: "⚠️",
			event: "🎉",
			offer: "📦",
			help: "🤝"
		};
		const catLabel = {
			question: "Вопрос",
			announcement: "Объявление",
			warning: "Предупреждение",
			event: "Событие",
			offer: "Отдам",
			help: "Помощь"
		};
		const body = p.body ? p.body.length > 110 ? p.body.slice(0, 110) + "…" : p.body : "";
		const author = p.is_anonymous ? "аноним" : p.user?.name || "пользователь";
		const level = p.user?.level ? ` · ${p.user.level}` : "";
		const exp = p.expires_at ? new Date(p.expires_at).toLocaleTimeString().slice(0, 5) : "";
		tip.innerHTML = `<div class="p-3.5"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-xs bg-stone-900 text-white rounded-full px-2 py-0.5 font-semibold">${catIcon[p.category] || "📍"} ${catLabel[p.category] || p.category}</span>${p.is_boosted ? "<span class=\"text-[11px] bg-amber-400 text-stone-900 rounded-full px-2 py-0.5 font-bold\">★ ТОП</span>" : ""}${p.priority === "sponsored" ? "<span class=\"text-[11px] bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold\">AD</span>" : ""}</div><div class="font-bold text-[13px] leading-tight mt-2 text-stone-900">${p.title}</div>${body ? `<div class="text-xs text-stone-600 mt-1.5 leading-relaxed">${body}</div>` : ""}<div class="flex items-center gap-2 mt-2.5 text-[11px] text-stone-500 flex-wrap"><span class="bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">${author}${level}</span>${exp ? `<span class="bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">до ${exp}</span>` : ""}<span class="bg-white border border-stone-200 rounded-full px-2 py-0.5">❤️ ${p.reactions_count || 0} · 💬 ${p.comments_count || 0}</span></div></div><div class="h-1 w-full ${p.is_boosted ? "bg-amber-400" : p.category === "warning" ? "bg-[#EA580C]" : p.category === "event" ? "bg-[#7C3AED]" : p.category === "help" ? "bg-[#DB2777]" : p.category === "question" ? "bg-[#2563EB]" : p.category === "offer" ? "bg-[#0891B2]" : "bg-[#DC2626]"}"></div>`;
		tip.style.left = x + "px";
		tip.style.top = y + "px";
		tip.classList.remove("hidden");
	}
	function hidePinTip() {
		if (pinTooltip) pinTooltip.classList.add("hidden");
	}
	let ctxMenu = null;
	let ctxPin = null;
	function ensureCtxMenu() {
		if (ctxMenu) return ctxMenu;
		ctxMenu = document.createElement("div");
		ctxMenu.className = "hidden fixed z-[50] bg-white border border-stone-200 rounded-xl shadow-[0_10px_28px_rgba(15,23,42,0.18)] p-1.5 min-w-[160px]";
		ctxMenu.innerHTML = `<button data-act="edit" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-stone-50 flex items-center gap-2">✎ Редактировать</button><button data-act="del" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 hover:text-red-600 flex items-center gap-2">🗑 Удалить пин</button><button data-act="cancel" class="w-full text-left px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-50">Отмена</button>`;
		ctxMenu.addEventListener("click", async (e) => {
			const act = e.target.closest("[data-act]")?.dataset.act;
			if (act === "cancel") {
				hideCtxMenu();
				return;
			}
			if (act === "edit" && ctxPin) {
				const pin = ctxPin;
				hideCtxMenu();
				hidePinTip();
				if (onPinEdit) onPinEdit(pin);
				else onPinClick(pin);
				return;
			}
			if (act === "del" && ctxPin) {
				const pin = ctxPin;
				hideCtxMenu();
				if (!confirm(`Удалить пин "${pin.title}"?`)) return;
				try {
					await store.deletePin(pin.id);
					hidePinTip();
					renderPins();
				} catch (err) {
					alert(err?.response?.data?.message || "Не удалось удалить");
				}
			}
		});
		document.body.appendChild(ctxMenu);
		document.addEventListener("click", (e) => {
			if (ctxMenu && !ctxMenu.contains(e.target) && !e.target.closest(".maplibregl-marker")) hideCtxMenu();
		});
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") hideCtxMenu();
		});
		return ctxMenu;
	}
	function showCtxMenu(p, x, y) {
		const m = ensureCtxMenu();
		ctxPin = p;
		m.style.left = x + "px";
		m.style.top = y + "px";
		m.classList.remove("hidden");
		const r = m.getBoundingClientRect();
		if (r.right > window.innerWidth) m.style.left = window.innerWidth - r.width - 8 + "px";
		if (r.bottom > window.innerHeight) m.style.top = y - r.height - 8 + "px";
	}
	function hideCtxMenu() {
		if (ctxMenu) {
			ctxMenu.classList.add("hidden");
			ctxPin = null;
		}
	}
	function renderPins() {
		if (!map || !map.loaded?.() && !loaded.value) return;
		markers.forEach((m) => m.remove());
		markers = [];
		let pins = store.pins;
		if (selectedCategory.value === "mine") pins = pins.filter((p) => p.is_owner);
		else if (selectedCategory.value !== "all") pins = pins.filter((p) => p.category === selectedCategory.value);
		const colorMap = {
			question: "#2563EB",
			announcement: "#DC2626",
			warning: "#EA580C",
			event: "#7C3AED",
			offer: "#0891B2",
			help: "#DB2777"
		};
		if (!document.getElementById("pin-soft-pulse-style")) {
			const s = document.createElement("style");
			s.id = "pin-soft-pulse-style";
			s.textContent = `@keyframes softPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.75);opacity:0}} @keyframes gentleBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}`;
			document.head.appendChild(s);
		}
		pins.forEach((p, idx) => {
			const wrap = document.createElement("div");
			wrap.className = "relative grid place-items-center cursor-pointer";
			wrap.style.width = "26px";
			wrap.style.height = "26px";
			const baseColor = p.is_boosted ? "#F59E0B" : p.is_sponsored || p.priority === "sponsored" ? "#7C3AED" : colorMap[p.category] || "#DC2626";
			const halo = document.createElement("div");
			halo.className = "absolute rounded-full";
			halo.style.width = "22px";
			halo.style.height = "22px";
			halo.style.background = baseColor;
			halo.style.opacity = "0.28";
			halo.style.animation = `softPulse 2.4s ease-in-out infinite`;
			halo.style.animationDelay = `${idx % 5 * .35}s`;
			const core = document.createElement("div");
			core.className = "relative rounded-full border-2 border-white shadow-[0_2px_10px_rgba(15,23,42,0.32),0_0_0_1px_rgba(15,23,42,0.08)] grid place-items-center";
			core.style.width = "18px";
			core.style.height = "18px";
			core.style.background = baseColor;
			core.style.animation = `gentleBreath 2.8s ease-in-out infinite`;
			core.style.animationDelay = `${idx % 7 * .2}s`;
			if (p.is_boosted) {
				core.style.boxShadow = "0 0 0 3px rgba(251,191,36,0.45), 0 2px 10px rgba(15,23,42,0.32)";
				core.style.borderColor = "white";
			}
			const inner = document.createElement("div");
			inner.className = "w-1.5 h-1.5 rounded-full bg-white/95 shadow-sm";
			core.appendChild(inner);
			wrap.appendChild(halo);
			wrap.appendChild(core);
			wrap.addEventListener("mouseenter", (e) => showPinTip(p, e.clientX, e.clientY));
			wrap.addEventListener("mousemove", (e) => {
				if (pinTooltip && !pinTooltip.classList.contains("hidden")) {
					pinTooltip.style.left = e.clientX + "px";
					pinTooltip.style.top = e.clientY + "px";
				}
			});
			wrap.addEventListener("mouseleave", hidePinTip);
			wrap.addEventListener("click", (ev) => {
				hidePinTip();
				hideCtxMenu();
				ev.stopPropagation();
				onPinClick(p);
			});
			wrap.addEventListener("contextmenu", (e) => {
				e.preventDefault();
				e.stopPropagation();
				hidePinTip();
				const uid = getCurrentUserId();
				if (!(p.is_owner || !!p.user?.id && p.user.id === uid)) return;
				showCtxMenu(p, e.clientX, e.clientY);
			});
			const m = new maplibregl.Marker({
				element: wrap,
				anchor: "center"
			}).setLngLat([p.longitude, p.latitude]).addTo(map);
			markers.push(m);
		});
	}
	let tempMarker = null;
	function addTempMarker(lngLat) {
		if (!map) return;
		if (tempMarker) tempMarker.remove();
		const el = document.createElement("div");
		el.className = "w-7 h-7 rounded-full bg-ink-900 border-[3px] border-white shadow-xl grid place-items-center animate-[ping_2s_ease_out_infinite]";
		el.innerHTML = "<span class=\"w-2.5 h-2.5 bg-white rounded-full block\"></span>";
		tempMarker = new maplibregl.Marker({
			element: el,
			anchor: "center"
		}).setLngLat(lngLat).addTo(map);
	}
	function removeTempMarker() {
		if (tempMarker) {
			tempMarker.remove();
			tempMarker = null;
		}
	}
	let userDot = null;
	function showUserLocation(lat, lng) {
		if (!map) return;
		if (userDot) userDot.remove();
		const wrap = document.createElement("div");
		wrap.className = "relative grid place-items-center";
		wrap.style.width = "20px";
		wrap.style.height = "20px";
		const pulse = document.createElement("div");
		pulse.className = "absolute w-10 h-10 rounded-full bg-blue-500/20 animate-ping";
		const dot = document.createElement("div");
		dot.className = "relative w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white shadow-[0_0_0_6px_rgba(59,130,246,0.25)]";
		wrap.appendChild(pulse);
		wrap.appendChild(dot);
		userDot = new maplibregl.Marker({
			element: wrap,
			anchor: "center"
		}).setLngLat([lng, lat]).addTo(map);
	}
	function triggerGeolocate() {
		try {
			const ctrl = map?._controls?.find((c) => c.trigger && c._geolocateButton) || null;
			if (ctrl?.trigger) ctrl.trigger();
		} catch {}
	}
	function startPolling(intervalMs = 3e4) {
		polling = setInterval(async () => {
			if (!map) return;
			const c = map.getCenter();
			await store.fetchNearby(c.lat, c.lng);
			renderPins();
		}, intervalMs);
	}
	function stopPolling() {
		if (polling) clearInterval(polling);
	}
	function getCenter() {
		return map?.getCenter();
	}
	function flyToMyLocation(lat, lng) {
		if (!map) return;
		map.flyTo({
			center: [lng, lat],
			zoom: 14.5,
			essential: true,
			duration: 1200
		});
	}
	function bindRealtime() {
		window.Echo?.channel("map").listen("PinCreated", (e) => {
			store.addRealtime(e.pin);
			renderPins();
		}).listen("PinDeleted", (e) => {
			store.removeRealtime(e.pinId);
			renderPins();
		});
	}
	function setThemeStyle(isDark) {}
	return {
		mapContainer,
		initMap,
		renderPins,
		addTempMarker,
		removeTempMarker,
		showUserLocation,
		triggerGeolocate,
		startPolling,
		stopPolling,
		getCenter,
		flyToMyLocation,
		bindRealtime,
		setThemeStyle,
		loaded,
		errorMsg,
		get map() {
			return map;
		}
	};
}
//#endregion
//#region resources/js/composables/usePinForm.ts
function usePinForm(onCreated) {
	const { createPin } = usePins();
	const newPin = ref({
		title: "",
		body: "",
		category: "announcement",
		latitude: 53.9022,
		longitude: 27.5615,
		location_precision: "blur_200",
		is_anonymous: false,
		radius_meters: 1e3
	});
	function setCoords(lat, lng) {
		newPin.value.latitude = Number(lat.toFixed(7));
		newPin.value.longitude = Number(lng.toFixed(7));
	}
	async function submit(isAuth) {
		if (!isAuth) {
			const { router } = await import("@inertiajs/vue3");
			router.visit(route("login"));
			return;
		}
		await createPin(newPin.value);
		newPin.value.title = "";
		newPin.value.body = "";
		onCreated?.();
	}
	return {
		newPin,
		setCoords,
		submit
	};
}
//#endregion
//#region resources/js/composables/usePinDetails.ts
function usePinDetails() {
	const selectedPin = ref(null);
	const comments = ref([]);
	const commentText = ref("");
	const reactionLoading = ref(false);
	const editingCommentId = ref(null);
	const editingContent = ref("");
	function openPin(pin) {
		selectedPin.value = pin;
		loadComments(pin.id);
	}
	function closePin() {
		selectedPin.value = null;
	}
	async function loadComments(id) {
		const { data } = await axios.get(`/api/pins/${id}/comments`);
		comments.value = data.data || data;
	}
	async function react(pin, type = "like") {
		if (reactionLoading.value) return;
		reactionLoading.value = true;
		try {
			const { data } = await axios.post("/api/reactions/toggle", {
				reactable_type: "pin",
				reactable_id: pin.id,
				type
			});
			if (typeof data.reactions_count === "number") pin.reactions_count = data.reactions_count;
			else if (data.reacted === false) pin.reactions_count = Math.max(0, (pin.reactions_count || 1) - 1);
			else if (data.switched) {} else if (data.reacted) pin.reactions_count = (pin.reactions_count || 0) + 1;
			if (typeof data.likes_count === "number") pin.likes_count = data.likes_count;
			if ("type" in data) pin.my_reaction = data.type;
			else if (data.reacted === false) pin.my_reaction = null;
		} finally {
			reactionLoading.value = false;
		}
	}
	async function sendComment() {
		if (!commentText.value.trim() || !selectedPin.value) return;
		await axios.post(`/api/pins/${selectedPin.value.id}/comments`, { content: commentText.value });
		commentText.value = "";
		await loadComments(selectedPin.value.id);
		selectedPin.value.comments_count = (selectedPin.value.comments_count || 0) + 1;
	}
	async function reportPin(pin) {
		await axios.post("/api/reports", {
			target_type: "pin",
			target_id: pin.id,
			reason: "spam"
		});
		alert("Жалоба отправлена");
	}
	async function boost(pin, type) {
		await axios.post(`/api/pins/${pin.id}/boost`, { type });
		alert("Буст активирован: " + type);
	}
	function startEditComment(c) {
		editingCommentId.value = c.id;
		editingContent.value = c.content;
	}
	function cancelEditComment() {
		editingCommentId.value = null;
		editingContent.value = "";
	}
	async function saveEditComment() {
		if (!editingCommentId.value) return;
		if (!editingContent.value.trim()) return alert("Пустой комментарий");
		try {
			const { data } = await axios.patch(`/api/comments/${editingCommentId.value}`, { content: editingContent.value.trim() });
			const idx = comments.value.findIndex((x) => x.id === editingCommentId.value);
			if (idx !== -1) comments.value[idx] = {
				...comments.value[idx],
				...data
			};
			editingCommentId.value = null;
			editingContent.value = "";
		} catch (e) {
			alert(e?.response?.data?.message || "Ошибка редактирования (лимит 3/день)");
		}
	}
	return {
		selectedPin,
		comments,
		commentText,
		reactionLoading,
		editingCommentId,
		editingContent,
		openPin,
		closePin,
		loadComments,
		react,
		sendComment,
		reportPin,
		boost,
		startEditComment,
		cancelEditComment,
		saveEditComment
	};
}
//#endregion
//#region resources/js/Pages/Map/Index.vue?vue&type=script&setup=true&lang.ts
var Index_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Index",
	__ssrInlineRender: true,
	setup(__props) {
		const { store, categories, selectedCategory, fetchNearby } = usePins();
		const { selectedPin, comments, commentText, openPin, closePin, react, sendComment, reportPin, boost, editingCommentId, editingContent, startEditComment, cancelEditComment, saveEditComment } = usePinDetails();
		const { newPin, setCoords, submit: submitPin } = usePinForm(() => mapApi.renderPins());
		const { requestGeolocation } = useGeolocation();
		const showCreate = ref(false);
		const creating = ref(false);
		const myStreet = ref("");
		const loadingStreet = ref(false);
		const showCoords = ref(false);
		const pinAddress = ref("");
		const loadingPinAddress = ref(false);
		const editing = ref(false);
		const editForm = ref({
			title: "",
			body: "",
			category: "announcement"
		});
		function startEdit() {
			if (!selectedPin.value) return;
			editing.value = true;
			editForm.value = {
				title: selectedPin.value.title,
				body: selectedPin.value.body || "",
				category: selectedPin.value.category
			};
		}
		function cancelEdit() {
			editing.value = false;
		}
		async function saveEdit() {
			if (!selectedPin.value) return;
			if (!editForm.value.title.trim()) return alert("Заголовок обязателен");
			try {
				const data = await store.updatePin(selectedPin.value.id, {
					title: editForm.value.title.trim(),
					body: editForm.value.body,
					category: editForm.value.category
				});
				Object.assign(selectedPin.value, data);
				editing.value = false;
				mapApi.renderPins();
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка сохранения");
			}
		}
		const mapApi = useMap(openPin, (p) => {
			openPin(p);
			nextTick(() => startEdit());
		});
		const { mapContainer, loaded } = mapApi;
		const { isDark } = useTheme();
		watch(isDark, (v) => mapApi.setThemeStyle(v));
		const page = usePage();
		const userPlan = computed(() => page.props.auth?.user?.plan || "free");
		const radiusOptions = computed(() => {
			const isPro = userPlan.value === "pro" || userPlan.value === "business";
			return [
				{
					v: 500,
					l: "500 м"
				},
				{
					v: 1e3,
					l: "1 км"
				},
				{
					v: 2e3,
					l: "2 км",
					pro: true
				},
				{
					v: 5e3,
					l: "5 км",
					pro: true
				}
			].map((o) => ({
				...o,
				disabled: o.pro && !isPro
			}));
		});
		const radiusLabel = computed(() => {
			const v = newPin.value.radius_meters;
			return v >= 1e3 ? `${v / 1e3} км` : `${v} м`;
		});
		function formatAddr(d) {
			const a = d.address || {};
			const road = a.road || a.pedestrian || a.footway || a.street || a.path || a.cycleway || "";
			const house = a.house_number ? `, ${a.house_number}` : "";
			const city = a.city || a.town || a.village || a.municipality || a.county || "";
			const suburb = a.suburb || a.neighbourhood || a.quarter || "";
			if (road) return `${road}${house}${city ? ` · ${city}` : ""}`;
			if (suburb && city) return `${suburb} · ${city}`;
			return d.display_name?.split(",").slice(0, 3).join(", ") || "Адрес не определён";
		}
		async function reverseGeocode(lat, lng) {
			loadingStreet.value = true;
			try {
				const d = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=ru`, { headers: { Accept: "application/json" } })).json();
				myStreet.value = formatAddr(d);
			} catch {
				myStreet.value = "";
			} finally {
				loadingStreet.value = false;
			}
		}
		async function fetchPinAddress(lat, lng) {
			loadingPinAddress.value = true;
			try {
				const d = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=ru`, { headers: { Accept: "application/json" } })).json();
				pinAddress.value = formatAddr(d);
			} catch {
				pinAddress.value = "";
			} finally {
				loadingPinAddress.value = false;
			}
		}
		function openCreate(lngLat) {
			setCoords(lngLat.lat, lngLat.lng);
			fetchPinAddress(lngLat.lat, lngLat.lng);
			mapApi.addTempMarker(lngLat);
			showCreate.value = true;
		}
		function closeCreate() {
			showCreate.value = false;
			mapApi.removeTempMarker();
		}
		watch(showCreate, (v) => {
			if (v && !pinAddress.value) fetchPinAddress(newPin.value.latitude, newPin.value.longitude);
		});
		async function submit() {
			if (creating.value) return;
			creating.value = true;
			try {
				await submitPin(true);
				mapApi.removeTempMarker();
				mapApi.renderPins();
				showCreate.value = false;
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка создания пина");
			} finally {
				creating.value = false;
			}
		}
		async function deleteSelectedPin() {
			if (!selectedPin.value) return;
			if (!confirm(`Удалить пин "${selectedPin.value.title}"?`)) return;
			try {
				await store.deletePin(selectedPin.value.id);
				closePin();
				mapApi.renderPins();
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка удаления");
			}
		}
		watch(selectedPin, () => {
			editing.value = false;
		});
		function onEsc(e) {
			if (e.key !== "Escape") return;
			if (showCreate.value) {
				closeCreate();
				return;
			}
			if (editing.value) {
				cancelEdit();
				return;
			}
			if (editingCommentId.value) {
				cancelEditComment();
				return;
			}
			if (selectedPin.value) {
				closePin();
				return;
			}
		}
		onMounted(async () => {
			window.addEventListener("keydown", onEsc);
			let geo = {
				lat: 53.9022,
				lng: 27.5615
			};
			let gotGeo = false;
			try {
				geo = await requestGeolocation();
				gotGeo = true;
			} catch {}
			if (gotGeo) reverseGeocode(geo.lat, geo.lng);
			try {
				await fetchNearby(geo.lat, geo.lng);
			} catch {}
			try {
				(await store.fetchMine()).forEach((p) => {
					if (!store.pins.find((x) => x.id === p.id)) store.pins.unshift(p);
				});
			} catch {}
			await nextTick();
			await mapApi.initMap([geo.lng, geo.lat], (e) => {
				if ((e.originalEvent?.target)?.closest?.(".maplibregl-marker")) return;
				openCreate(e.lngLat);
			});
			if (gotGeo) mapApi.showUserLocation(geo.lat, geo.lng);
			else try {
				mapApi.map?.setZoom(7);
			} catch {}
			setTimeout(() => mapApi.triggerGeolocate(), 800);
			mapApi.renderPins();
			mapApi.startPolling(3e4);
			mapApi.bindRealtime();
			try {
				mapApi.map?.on("geolocate", (e) => {
					const c = e.coords;
					if (c) {
						reverseGeocode(c.latitude, c.longitude);
						mapApi.showUserLocation(c.latitude, c.longitude);
					}
				});
			} catch {}
		});
		onUnmounted(() => window.removeEventListener("keydown", onEsc));
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<!--[-->`);
			_push(ssrRenderComponent(unref(Head), { title: "Карта" }, null, _parent));
			_push(ssrRenderComponent(_sfc_main, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="relative w-full h-[calc(100dvh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden" data-v-a6652ced${_scopeId}><div class="absolute inset-0 w-full h-full bg-[#eaf0f6]" data-v-a6652ced${_scopeId}></div>`);
						if (!unref(loaded)) _push(`<div class="absolute inset-0 grid place-items-center bg-[#eef3f8] z-[5]" data-v-a6652ced${_scopeId}><div class="bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-soft flex items-center gap-3" data-v-a6652ced${_scopeId}><span class="w-5 h-5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" data-v-a6652ced${_scopeId}></span><span class="text-sm font-medium" data-v-a6652ced${_scopeId}>Загружаем карту…</span></div></div>`);
						else _push(`<!---->`);
						_push(`<div class="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto flex flex-col gap-2.5 z-10 pointer-events-none" data-v-a6652ced${_scopeId}><div class="pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-2xl sm:rounded-full p-1.5 sm:pl-2 sm:pr-2 shadow-soft flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full" data-v-a6652ced${_scopeId}><span class="shrink-0 bg-ink-900 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5" data-v-a6652ced${_scopeId}><span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" data-v-a6652ced${_scopeId}></span>${ssrInterpolate(unref(store).pins.length)}</span><div class="h-5 w-px bg-stone-200 shrink-0 hidden sm:block" data-v-a6652ced${_scopeId}></div><div class="flex items-center gap-1 overflow-x-auto scrollbar-none" data-v-a6652ced${_scopeId}><button class="${ssrRenderClass(["shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition", unref(selectedCategory) === "all" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>Все</button><button class="${ssrRenderClass(["shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1", unref(selectedCategory) === "mine" ? "bg-amber-400 text-stone-900 border-amber-400 shadow-soft" : "bg-white border-amber-200 hover:bg-amber-50"])}" data-v-a6652ced${_scopeId}>📍 Мои</button><!--[-->`);
						ssrRenderList(unref(categories), (c) => {
							_push(`<button class="${ssrRenderClass(["shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition hidden sm:inline-flex items-center gap-1", unref(selectedCategory) === c.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.i)} <span data-v-a6652ced${_scopeId}>${ssrInterpolate(c.l)}</span></button>`);
						});
						_push(`<!--]--><!--[-->`);
						ssrRenderList(unref(categories).slice(0, 4), (c) => {
							_push(`<button class="${ssrRenderClass(["shrink-0 w-9 h-9 rounded-full text-sm grid place-items-center border sm:hidden", unref(selectedCategory) === c.v ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"])}"${ssrRenderAttr("title", c.l)} data-v-a6652ced${_scopeId}>${ssrInterpolate(c.i)}</button>`);
						});
						_push(`<!--]--></div></div>`);
						if (myStreet.value || loadingStreet.value) {
							_push(`<div class="pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full pl-1 pr-3 py-1 shadow-soft flex items-center gap-2 w-fit max-w-[min(92vw,380px)]" data-v-a6652ced${_scopeId}><span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0" data-v-a6652ced${_scopeId}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-v-a6652ced${_scopeId}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" data-v-a6652ced${_scopeId}></path><circle cx="12" cy="10" r="3" data-v-a6652ced${_scopeId}></circle></svg></span><div class="min-w-0 leading-none" data-v-a6652ced${_scopeId}><div class="text-[10px] font-bold tracking-widest uppercase text-stone-400" data-v-a6652ced${_scopeId}>вы здесь</div><div class="text-xs font-semibold text-ink-900 truncate" data-v-a6652ced${_scopeId}>${ssrInterpolate(loadingStreet.value ? "Определяем улицу…" : myStreet.value)}</div></div>`);
							if (loadingStreet.value) _push(`<span class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0" data-v-a6652ced${_scopeId}></span>`);
							else _push(`<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" data-v-a6652ced${_scopeId}></span>`);
							_push(`</div>`);
						} else _push(`<!---->`);
						_push(`<div class="hidden sm:flex pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 text-xs font-medium shadow-soft items-center gap-2 w-fit" data-v-a6652ced${_scopeId}><span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" data-v-a6652ced${_scopeId}></span> кликнуть по карте — создашь пин <span class="bg-ink-900 text-white rounded-full px-2 py-0.5 text-[11px] font-bold" data-v-a6652ced${_scopeId}>2 мин</span></div></div><div class="absolute bottom-4 right-4 sm:bottom-6 sm:right-4 flex flex-col items-center gap-2.5 z-10 pointer-events-none" data-v-a6652ced${_scopeId}><button class="pointer-events-auto sm:hidden w-14 h-14 rounded-full bg-ink-900 text-white shadow-float grid place-items-center text-xl hover:bg-ink-800 active:scale-95 transition" data-v-a6652ced${_scopeId}>＋</button></div><div class="absolute bottom-4 left-4 hidden xl:flex z-10 pointer-events-none" data-v-a6652ced${_scopeId}><div class="bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 shadow-soft flex items-center gap-2 text-xs font-medium" data-v-a6652ced${_scopeId}><span class="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[11px]" data-v-a6652ced${_scopeId}>◐</span> ${ssrInterpolate(unref(store).pins.length)} пинов · живёт 2–24ч · размытие 200м </div></div>`);
						if (showCreate.value) {
							_push(`<div class="absolute inset-0 z-30 flex items-end sm:items-center justify-center sm:p-4" data-v-a6652ced${_scopeId}><div class="absolute inset-0 bg-ink-900/30 backdrop-blur-[2px]" data-v-a6652ced${_scopeId}></div><div class="relative w-full sm:max-w-[520px] bg-white sm:rounded-[24px] rounded-t-[20px] shadow-float border border-stone-200 overflow-hidden max-h-[88vh] sm:max-h-[84vh] flex flex-col" data-v-a6652ced${_scopeId}><div class="sm:hidden w-10 h-1 bg-stone-200 rounded-full mx-auto mt-2.5 shrink-0" data-v-a6652ced${_scopeId}></div><div class="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3 border-b border-stone-100 flex items-start justify-between gap-3 shrink-0" data-v-a6652ced${_scopeId}><div class="min-w-0" data-v-a6652ced${_scopeId}><h3 class="text-[16px] font-black tracking-tight leading-none" data-v-a6652ced${_scopeId}>Новый пин</h3><p class="text-[11px] text-stone-500 mt-1 leading-relaxed" data-v-a6652ced${_scopeId}>Клик по карте — переместить точку</p></div><button class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600 shrink-0 transition text-sm" data-v-a6652ced${_scopeId}>✕</button></div><form class="p-4 sm:p-5 space-y-3 overflow-y-auto overscroll-contain scrollbar-thin" data-v-a6652ced${_scopeId}><div class="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5" data-v-a6652ced${_scopeId}><span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0" data-v-a6652ced${_scopeId}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-v-a6652ced${_scopeId}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" data-v-a6652ced${_scopeId}></path><circle cx="12" cy="10" r="3" data-v-a6652ced${_scopeId}></circle></svg></span><div class="min-w-0 flex-1" data-v-a6652ced${_scopeId}><div class="text-[12px] font-semibold text-ink-900 leading-tight truncate" data-v-a6652ced${_scopeId}>`);
							if (loadingPinAddress.value) _push(`<span class="text-stone-400" data-v-a6652ced${_scopeId}>Определяем адрес…</span>`);
							else if (showCoords.value) _push(`<span class="font-mono" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(newPin).latitude.toFixed(5))}, ${ssrInterpolate(unref(newPin).longitude.toFixed(5))}</span>`);
							else _push(`<span data-v-a6652ced${_scopeId}>${ssrInterpolate(pinAddress.value || "Адрес не определён")}</span>`);
							_push(`</div><div class="text-[10px] text-stone-400 leading-none mt-0.5 truncate" data-v-a6652ced${_scopeId}>`);
							if (showCoords.value) _push(`<span data-v-a6652ced${_scopeId}>${ssrInterpolate(pinAddress.value || "кликни → переместить")}</span>`);
							else _push(`<span data-v-a6652ced${_scopeId}>кликни → переместить</span>`);
							_push(`</div></div>`);
							if (loadingPinAddress.value) _push(`<span class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0" data-v-a6652ced${_scopeId}></span>`);
							else if (!showCoords.value) _push(`<span class="hidden sm:inline text-[10px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5 shrink-0" data-v-a6652ced${_scopeId}>✓</span>`);
							else _push(`<!---->`);
							_push(`</div><label class="flex items-center justify-between bg-white border border-stone-200 rounded-full px-3 py-2 cursor-pointer hover:bg-stone-50 transition" data-v-a6652ced${_scopeId}><span class="text-[11px] font-semibold flex items-center gap-1.5" data-v-a6652ced${_scopeId}><span class="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[10px]" data-v-a6652ced${_scopeId}>◈</span> Показать координаты</span><span class="relative inline-flex items-center" data-v-a6652ced${_scopeId}><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(showCoords.value) ? ssrLooseContain(showCoords.value, null) : showCoords.value) ? " checked" : ""} class="sr-only" data-v-a6652ced${_scopeId}><span class="${ssrRenderClass(["w-8 h-5 rounded-full p-0.5 flex items-center transition", showCoords.value ? "bg-ink-900" : "bg-stone-300"])}" data-v-a6652ced${_scopeId}><span class="${ssrRenderClass(["w-4 h-4 bg-white rounded-full shadow transition", showCoords.value ? "translate-x-3" : "translate-x-0"])}" data-v-a6652ced${_scopeId}></span></span></span></label><div data-v-a6652ced${_scopeId}><label class="text-[10px] font-bold tracking-wide uppercase text-stone-500" data-v-a6652ced${_scopeId}>Заголовок *</label><input${ssrRenderAttr("value", unref(newPin).title)} placeholder="Напр. Отдам стул, где кофе?" maxlength="100" required class="mt-1 input-premium !py-2.5 text-[13px]" data-v-a6652ced${_scopeId}><div class="flex justify-between text-[10px] mt-1" data-v-a6652ced${_scopeId}><span class="text-stone-400" data-v-a6652ced${_scopeId}>Коротко</span><span class="${ssrRenderClass(unref(newPin).title.length > 80 ? "text-amber-600" : "text-stone-400")}" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(newPin).title.length)}/100</span></div></div><div data-v-a6652ced${_scopeId}><label class="text-[10px] font-bold tracking-wide uppercase text-stone-500" data-v-a6652ced${_scopeId}>Подробности</label><textarea placeholder="Адрес, время, контакты…" rows="2" maxlength="1000" class="mt-1 input-premium resize-none !py-2.5 text-[13px]" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(newPin).body)}</textarea></div><div data-v-a6652ced${_scopeId}><label class="text-[10px] font-bold tracking-wide uppercase text-stone-500" data-v-a6652ced${_scopeId}>Категория</label><div class="mt-1.5 grid grid-cols-3 gap-1.5" data-v-a6652ced${_scopeId}><!--[-->`);
							ssrRenderList(unref(categories), (c) => {
								_push(`<button type="button" class="${ssrRenderClass(["group relative px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition", unref(newPin).category === c.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}><span class="text-sm leading-none" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.i)}</span><span class="leading-none text-[11px]" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.l)}</span></button>`);
							});
							_push(`<!--]--></div></div><div data-v-a6652ced${_scopeId}><label class="text-[10px] font-bold tracking-wide uppercase text-stone-500" data-v-a6652ced${_scopeId}>Приватность</label><div class="mt-1.5 grid grid-cols-3 gap-1.5" data-v-a6652ced${_scopeId}><button type="button" class="${ssrRenderClass(["rounded-full py-2 text-xs font-semibold border transition flex items-center justify-center gap-1", unref(newPin).location_precision === "blur_200" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>Размыто <span class="text-[11px] opacity-60" data-v-a6652ced${_scopeId}>200м</span></button><button type="button" class="${ssrRenderClass(["rounded-full py-2 text-xs font-semibold border transition", unref(newPin).location_precision === "exact" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>Точно</button><button type="button" class="${ssrRenderClass(["rounded-full py-2 text-xs font-semibold border transition", unref(newPin).location_precision === "district" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>Район</button></div><p class="text-[10px] text-stone-400 mt-1 text-center" data-v-a6652ced${_scopeId}>200м по умолчанию</p></div><div class="bg-white border border-stone-200 rounded-xl p-2.5" data-v-a6652ced${_scopeId}><div class="flex items-center justify-between" data-v-a6652ced${_scopeId}><label class="text-[10px] font-bold tracking-wide uppercase text-stone-500" data-v-a6652ced${_scopeId}>Радиус</label><span class="text-[11px] font-bold bg-ink-900 text-white rounded-full px-2 py-0.5" data-v-a6652ced${_scopeId}>${ssrInterpolate(radiusLabel.value)}</span></div><div class="mt-1.5 grid grid-cols-4 gap-1" data-v-a6652ced${_scopeId}><!--[-->`);
							ssrRenderList(radiusOptions.value, (o) => {
								_push(`<button type="button"${ssrIncludeBooleanAttr(o.disabled) ? " disabled" : ""} class="${ssrRenderClass(["rounded-full py-2 text-xs font-semibold border transition", o.disabled ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed" : unref(newPin).radius_meters === o.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>${ssrInterpolate(o.l)}</button>`);
							});
							_push(`<!--]--></div></div><label class="flex items-center gap-2.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-stone-100 transition" data-v-a6652ced${_scopeId}><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(newPin).is_anonymous) ? ssrLooseContain(unref(newPin).is_anonymous, null) : unref(newPin).is_anonymous) ? " checked" : ""} class="rounded text-ink-900 w-[16px] h-[16px] border-stone-300" data-v-a6652ced${_scopeId}><div class="flex-1 min-w-0" data-v-a6652ced${_scopeId}><div class="text-xs font-semibold leading-none" data-v-a6652ced${_scopeId}>Анонимно</div><div class="text-[11px] text-stone-500 mt-0.5" data-v-a6652ced${_scopeId}>без репутации</div></div><span class="hidden sm:inline text-[11px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5" data-v-a6652ced${_scopeId}>🔒</span></label><div class="sticky bottom-0 bg-white pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] -mx-1 px-1 flex gap-2 border-t border-stone-100 mt-1.5" data-v-a6652ced${_scopeId}><button type="button" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 font-semibold hover:bg-stone-50 active:scale-[0.98] transition min-h-[42px] text-sm" data-v-a6652ced${_scopeId}>Отмена</button><button${ssrIncludeBooleanAttr(creating.value || !unref(newPin).title.trim()) ? " disabled" : ""} type="submit" class="flex-[1.4] bg-ink-900 text-white rounded-full py-2.5 font-semibold hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-soft active:scale-[0.98] transition flex items-center justify-center gap-2 min-h-[42px] text-sm" data-v-a6652ced${_scopeId}>`);
							if (creating.value) _push(`<span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" data-v-a6652ced${_scopeId}></span>`);
							else _push(`<!---->`);
							_push(` ${ssrInterpolate(creating.value ? "Создаём…" : "Создать пин →")}</button></div><p class="text-[10px] text-stone-400 text-center leading-relaxed" data-v-a6652ced${_scopeId}>Free: 3/день · Pro \$4.99 · 2–24ч · правила района</p></form></div></div>`);
						} else _push(`<!---->`);
						if (unref(selectedPin)) {
							_push(`<div class="absolute inset-x-3 bottom-3 top-auto max-h-[78vh] sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[380px] sm:max-h-none bg-white rounded-[20px] shadow-float border border-stone-200 flex flex-col overflow-hidden z-20" data-v-a6652ced${_scopeId}><div class="p-5 border-b border-stone-200" data-v-a6652ced${_scopeId}>`);
							if (!editing.value) {
								_push(`<div class="flex justify-between items-start gap-3" data-v-a6652ced${_scopeId}><h3 class="font-bold leading-tight pr-2 text-[15px]" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(selectedPin).title)}</h3><div class="flex items-center gap-1 shrink-0" data-v-a6652ced${_scopeId}>`);
								if (unref(selectedPin).is_owner) _push(`<button class="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-50 grid place-items-center" title="Редактировать" data-v-a6652ced${_scopeId}>✎</button>`);
								else _push(`<!---->`);
								if (unref(selectedPin).is_owner) _push(`<button class="w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center" title="Удалить пин" data-v-a6652ced${_scopeId}>🗑</button>`);
								else _push(`<!---->`);
								_push(`<button class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600" data-v-a6652ced${_scopeId}>✕</button></div></div>`);
							} else {
								_push(`<div class="space-y-3" data-v-a6652ced${_scopeId}><input${ssrRenderAttr("value", editForm.value.title)} maxlength="100" placeholder="Заголовок" class="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900" data-v-a6652ced${_scopeId}><textarea rows="3" maxlength="1000" placeholder="Подробности" class="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900 resize-none" data-v-a6652ced${_scopeId}>${ssrInterpolate(editForm.value.body)}</textarea><div class="flex gap-1.5 flex-wrap" data-v-a6652ced${_scopeId}><!--[-->`);
								ssrRenderList(unref(categories), (c) => {
									_push(`<button class="${ssrRenderClass(["px-3 py-1.5 rounded-full text-xs font-semibold border", editForm.value.category === c.v ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"])}" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.i)} ${ssrInterpolate(c.l)}</button>`);
								});
								_push(`<!--]--></div><div class="flex gap-2" data-v-a6652ced${_scopeId}><button class="flex-1 bg-ink-900 text-white rounded-full py-2.5 text-sm font-semibold hover:bg-ink-800" data-v-a6652ced${_scopeId}>Сохранить</button><button class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-sm font-semibold hover:bg-stone-50" data-v-a6652ced${_scopeId}>Отмена</button></div></div>`);
							}
							if (!editing.value) _push(`<p class="text-sm text-stone-600 mt-2 leading-relaxed" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(selectedPin).body)}</p>`);
							else _push(`<!---->`);
							if (!editing.value) {
								_push(`<div class="flex flex-wrap gap-1.5 mt-3 items-center" data-v-a6652ced${_scopeId}><span class="text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1 font-medium" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(selectedPin).category)}</span><span class="text-xs bg-white border border-stone-200 rounded-full pl-1 pr-2.5 py-1 flex items-center gap-1.5" data-v-a6652ced${_scopeId}>`);
								if (unref(selectedPin).user?.avatar_path) _push(`<img${ssrRenderAttr("src", `/storage/${unref(selectedPin).user.avatar_path}`)} class="w-5 h-5 rounded-full object-cover border border-stone-200" data-v-a6652ced${_scopeId}>`);
								else if (unref(selectedPin).user?.name) _push(`<span class="w-5 h-5 rounded-full bg-ink-900 text-white grid place-items-center text-[10px] font-bold" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(selectedPin).user.name[0].toUpperCase())}</span>`);
								else _push(`<span class="w-5 h-5 rounded-full bg-stone-200 border border-stone-300 grid place-items-center text-[10px]" data-v-a6652ced${_scopeId}>?</span>`);
								_push(` ${ssrInterpolate(unref(selectedPin).user?.name || "аноним")} · ${ssrInterpolate(unref(selectedPin).user?.level || "novice")}</span><span class="text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1" data-v-a6652ced${_scopeId}>до ${ssrInterpolate(new Date(unref(selectedPin).expires_at).toLocaleTimeString().slice(0, 5))}</span></div>`);
							} else _push(`<!---->`);
							_push(`<div class="flex gap-1.5 mt-4" data-v-a6652ced${_scopeId}><button class="${ssrRenderClass(["flex-1 rounded-full py-2.5 text-xs font-semibold border active:scale-95 transition flex items-center justify-center gap-1", unref(selectedPin).my_reaction === "like" ? "bg-rose-500 text-white border-rose-500 shadow-[0_2px_10px_rgba(244,63,94,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>❤️ ${ssrInterpolate(unref(selectedPin).reactions_count || 0)}`);
							if (unref(selectedPin).my_reaction === "like") _push(`<span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" data-v-a6652ced${_scopeId}></span>`);
							else _push(`<!---->`);
							_push(`</button><button class="${ssrRenderClass(["px-4 rounded-full text-xs font-semibold border active:scale-95 transition", unref(selectedPin).my_reaction === "fire" ? "bg-orange-500 text-white border-orange-500 shadow-[0_2px_10px_rgba(249,115,22,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>🔥</button><button class="${ssrRenderClass(["px-4 rounded-full text-xs font-semibold border active:scale-95 transition", unref(selectedPin).my_reaction === "useful" ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"])}" data-v-a6652ced${_scopeId}>👍</button><button class="w-10 h-10 bg-white border border-stone-200 rounded-full grid place-items-center hover:bg-red-50 hover:text-red-600" data-v-a6652ced${_scopeId}>⚠</button></div>`);
							if (unref(selectedPin).my_reaction) _push(`<div class="mt-2 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5" data-v-a6652ced${_scopeId}>✓ Выбрано: ${ssrInterpolate({
								like: "❤️ Лайк",
								fire: "🔥 Огонь",
								useful: "👍 Полезно",
								laugh: "😂 Смешно",
								sad: "😢 Грустно",
								angry: "😡 Злость"
							}[unref(selectedPin).my_reaction] || unref(selectedPin).my_reaction)}</div>`);
							else _push(`<!---->`);
							_push(`<div class="grid grid-cols-3 gap-2 mt-4" data-v-a6652ced${_scopeId}><button class="group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all" data-v-a6652ced${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" data-v-a6652ced${_scopeId}></span><span class="text-[15px] leading-none" data-v-a6652ced${_scopeId}>👑</span><span class="text-xs font-black leading-none" data-v-a6652ced${_scopeId}>Топ \$0.99</span><span class="text-[11px] font-bold leading-none opacity-80" data-v-a6652ced${_scopeId}>поднять 1ч</span></button><button class="group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all" data-v-a6652ced${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" data-v-a6652ced${_scopeId}></span><span class="text-[15px] leading-none" data-v-a6652ced${_scopeId}>✨</span><span class="text-xs font-black leading-none" data-v-a6652ced${_scopeId}>Подсветка \$1.99</span><span class="text-[11px] font-semibold leading-none opacity-80" data-v-a6652ced${_scopeId}>анимация</span></button><button class="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all" data-v-a6652ced${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" data-v-a6652ced${_scopeId}></span><span class="text-[15px] leading-none" data-v-a6652ced${_scopeId}>⏳</span><span class="text-xs font-black leading-none" data-v-a6652ced${_scopeId}>+24ч \$2.99</span><span class="text-[11px] font-semibold leading-none opacity-80" data-v-a6652ced${_scopeId}>продлить</span></button></div></div><div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/40" data-v-a6652ced${_scopeId}><!--[-->`);
							ssrRenderList(unref(comments), (c) => {
								_push(`<div class="bg-white border border-stone-200 rounded-2xl p-3.5" data-v-a6652ced${_scopeId}><div class="font-semibold text-xs flex items-center gap-2" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.is_anonymous ? "аноним" : c.user?.name)} <span class="text-stone-400 font-normal" data-v-a6652ced${_scopeId}>${ssrInterpolate(new Date(c.created_at).toLocaleTimeString())}</span>`);
								if (c.user_id === unref(page).props.auth.user.id || unref(page).props.auth.user.is_admin || unref(page).props.auth.user.role === "admin") {
									_push(`<span class="ml-auto flex gap-1" data-v-a6652ced${_scopeId}>`);
									if (unref(editingCommentId) !== c.id) _push(`<button class="text-[11px] px-2 py-0.5 rounded-full border hover:bg-stone-50" data-v-a6652ced${_scopeId}>✎ ред.</button>`);
									else _push(`<!--[--><button class="text-[11px] px-2.5 py-1 rounded-full bg-ink-900 text-white font-semibold" data-v-a6652ced${_scopeId}>✓ Сохранить</button><button class="text-[11px] px-2.5 py-1 rounded-full border hover:bg-stone-50" data-v-a6652ced${_scopeId}>✕</button><!--]-->`);
									_push(`</span>`);
								} else _push(`<!---->`);
								_push(`</div>`);
								if (unref(editingCommentId) === c.id) _push(`<div class="mt-2" data-v-a6652ced${_scopeId}><textarea rows="2" maxlength="1000" class="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ink-900" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(editingContent))}</textarea><div class="text-[11px] text-stone-400 mt-1 text-right" data-v-a6652ced${_scopeId}>${ssrInterpolate(unref(editingContent).length)}/1000 · 3/день на пин</div></div>`);
								else _push(`<div class="text-sm text-stone-700 mt-1.5 leading-relaxed break-words" data-v-a6652ced${_scopeId}>${ssrInterpolate(c.content)}</div>`);
								_push(`</div>`);
							});
							_push(`<!--]-->`);
							if (!unref(comments).length) _push(`<div class="text-center py-10" data-v-a6652ced${_scopeId}><div class="w-10 h-10 rounded-full bg-white border grid place-items-center mx-auto text-stone-400" data-v-a6652ced${_scopeId}>💬</div><div class="text-xs text-stone-400 mt-2" data-v-a6652ced${_scopeId}>Комментариев пока нет<br data-v-a6652ced${_scopeId}>Будь первым</div></div>`);
							else _push(`<!---->`);
							_push(`</div><form class="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-stone-200 bg-white flex gap-2" data-v-a6652ced${_scopeId}><input${ssrRenderAttr("value", unref(commentText))} placeholder="Написать комментарий..." class="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-full px-4 py-3 text-[16px] sm:text-sm focus:outline-none focus:border-ink-900 focus:bg-white transition" data-v-a6652ced${_scopeId}><button class="w-11 h-11 rounded-full bg-ink-900 text-white grid place-items-center hover:bg-ink-800 active:scale-95 transition shrink-0" data-v-a6652ced${_scopeId}>↗</button></form></div>`);
						} else _push(`<!---->`);
						_push(`</div>`);
					} else return [createVNode("div", { class: "relative w-full h-[calc(100dvh-64px)] min-h-[400px] bg-[#eaf0f6] overflow-hidden" }, [
						createVNode("div", {
							ref_key: "mapContainer",
							ref: mapContainer,
							class: "absolute inset-0 w-full h-full bg-[#eaf0f6]"
						}, null, 512),
						!unref(loaded) ? (openBlock(), createBlock("div", {
							key: 0,
							class: "absolute inset-0 grid place-items-center bg-[#eef3f8] z-[5]"
						}, [createVNode("div", { class: "bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-soft flex items-center gap-3" }, [createVNode("span", { class: "w-5 h-5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" }), createVNode("span", { class: "text-sm font-medium" }, "Загружаем карту…")])])) : createCommentVNode("", true),
						createVNode("div", { class: "absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-auto flex flex-col gap-2.5 z-10 pointer-events-none" }, [
							createVNode("div", { class: "pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-2xl sm:rounded-full p-1.5 sm:pl-2 sm:pr-2 shadow-soft flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full" }, [
								createVNode("span", { class: "shrink-0 bg-ink-900 text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5" }, [createVNode("span", { class: "w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" }), createTextVNode(toDisplayString(unref(store).pins.length), 1)]),
								createVNode("div", { class: "h-5 w-px bg-stone-200 shrink-0 hidden sm:block" }),
								createVNode("div", { class: "flex items-center gap-1 overflow-x-auto scrollbar-none" }, [
									createVNode("button", {
										onClick: ($event) => selectedCategory.value = "all",
										class: ["shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition", unref(selectedCategory) === "all" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"]
									}, "Все", 10, ["onClick"]),
									createVNode("button", {
										onClick: ($event) => selectedCategory.value = "mine",
										class: ["shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1", unref(selectedCategory) === "mine" ? "bg-amber-400 text-stone-900 border-amber-400 shadow-soft" : "bg-white border-amber-200 hover:bg-amber-50"]
									}, "📍 Мои", 10, ["onClick"]),
									(openBlock(true), createBlock(Fragment, null, renderList(unref(categories), (c) => {
										return openBlock(), createBlock("button", {
											key: c.v,
											onClick: ($event) => selectedCategory.value = c.v,
											class: ["shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition hidden sm:inline-flex items-center gap-1", unref(selectedCategory) === c.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50"]
										}, [createTextVNode(toDisplayString(c.i) + " ", 1), createVNode("span", null, toDisplayString(c.l), 1)], 10, ["onClick"]);
									}), 128)),
									(openBlock(true), createBlock(Fragment, null, renderList(unref(categories).slice(0, 4), (c) => {
										return openBlock(), createBlock("button", {
											key: "m" + c.v,
											onClick: ($event) => selectedCategory.value = c.v,
											class: ["shrink-0 w-9 h-9 rounded-full text-sm grid place-items-center border sm:hidden", unref(selectedCategory) === c.v ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"],
											title: c.l
										}, toDisplayString(c.i), 11, ["onClick", "title"]);
									}), 128))
								])
							]),
							createVNode(Transition, { name: "fade" }, {
								default: withCtx(() => [myStreet.value || loadingStreet.value ? (openBlock(), createBlock("div", {
									key: 0,
									class: "pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full pl-1 pr-3 py-1 shadow-soft flex items-center gap-2 w-fit max-w-[min(92vw,380px)]"
								}, [
									createVNode("span", { class: "w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0" }, [(openBlock(), createBlock("svg", {
										width: "13",
										height: "13",
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "white",
										"stroke-width": "2",
										"stroke-linecap": "round",
										"stroke-linejoin": "round"
									}, [createVNode("path", { d: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" }), createVNode("circle", {
										cx: "12",
										cy: "10",
										r: "3"
									})]))]),
									createVNode("div", { class: "min-w-0 leading-none" }, [createVNode("div", { class: "text-[10px] font-bold tracking-widest uppercase text-stone-400" }, "вы здесь"), createVNode("div", { class: "text-xs font-semibold text-ink-900 truncate" }, toDisplayString(loadingStreet.value ? "Определяем улицу…" : myStreet.value), 1)]),
									loadingStreet.value ? (openBlock(), createBlock("span", {
										key: 0,
										class: "w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0"
									})) : (openBlock(), createBlock("span", {
										key: 1,
										class: "w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"
									}))
								])) : createCommentVNode("", true)]),
								_: 1
							}),
							createVNode("div", { class: "hidden sm:flex pointer-events-auto bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 text-xs font-medium shadow-soft items-center gap-2 w-fit" }, [
								createVNode("span", { class: "w-2 h-2 bg-emerald-500 rounded-full animate-pulse" }),
								createTextVNode(" кликнуть по карте — создашь пин "),
								createVNode("span", { class: "bg-ink-900 text-white rounded-full px-2 py-0.5 text-[11px] font-bold" }, "2 мин")
							])
						]),
						createVNode("div", { class: "absolute bottom-4 right-4 sm:bottom-6 sm:right-4 flex flex-col items-center gap-2.5 z-10 pointer-events-none" }, [createVNode("button", {
							onClick: ($event) => showCreate.value = true,
							class: "pointer-events-auto sm:hidden w-14 h-14 rounded-full bg-ink-900 text-white shadow-float grid place-items-center text-xl hover:bg-ink-800 active:scale-95 transition"
						}, "＋", 8, ["onClick"])]),
						createVNode("div", { class: "absolute bottom-4 left-4 hidden xl:flex z-10 pointer-events-none" }, [createVNode("div", { class: "bg-white/95 backdrop-blur border border-stone-200 rounded-full px-3.5 py-2 shadow-soft flex items-center gap-2 text-xs font-medium" }, [createVNode("span", { class: "w-7 h-7 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[11px]" }, "◐"), createTextVNode(" " + toDisplayString(unref(store).pins.length) + " пинов · живёт 2–24ч · размытие 200м ", 1)])]),
						createVNode(Transition, { name: "fade" }, {
							default: withCtx(() => [showCreate.value ? (openBlock(), createBlock("div", {
								key: 0,
								class: "absolute inset-0 z-30 flex items-end sm:items-center justify-center sm:p-4"
							}, [createVNode("div", {
								onClick: closeCreate,
								class: "absolute inset-0 bg-ink-900/30 backdrop-blur-[2px]"
							}), createVNode("div", { class: "relative w-full sm:max-w-[520px] bg-white sm:rounded-[24px] rounded-t-[20px] shadow-float border border-stone-200 overflow-hidden max-h-[88vh] sm:max-h-[84vh] flex flex-col" }, [
								createVNode("div", { class: "sm:hidden w-10 h-1 bg-stone-200 rounded-full mx-auto mt-2.5 shrink-0" }),
								createVNode("div", { class: "px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3 border-b border-stone-100 flex items-start justify-between gap-3 shrink-0" }, [createVNode("div", { class: "min-w-0" }, [createVNode("h3", { class: "text-[16px] font-black tracking-tight leading-none" }, "Новый пин"), createVNode("p", { class: "text-[11px] text-stone-500 mt-1 leading-relaxed" }, "Клик по карте — переместить точку")]), createVNode("button", {
									onClick: closeCreate,
									class: "w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600 shrink-0 transition text-sm"
								}, "✕")]),
								createVNode("form", {
									onSubmit: withModifiers(submit, ["prevent"]),
									class: "p-4 sm:p-5 space-y-3 overflow-y-auto overscroll-contain scrollbar-thin"
								}, [
									createVNode("div", { class: "bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5" }, [
										createVNode("span", { class: "w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0" }, [(openBlock(), createBlock("svg", {
											width: "12",
											height: "12",
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "white",
											"stroke-width": "2",
											"stroke-linecap": "round",
											"stroke-linejoin": "round"
										}, [createVNode("path", { d: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" }), createVNode("circle", {
											cx: "12",
											cy: "10",
											r: "3"
										})]))]),
										createVNode("div", { class: "min-w-0 flex-1" }, [createVNode("div", { class: "text-[12px] font-semibold text-ink-900 leading-tight truncate" }, [loadingPinAddress.value ? (openBlock(), createBlock("span", {
											key: 0,
											class: "text-stone-400"
										}, "Определяем адрес…")) : showCoords.value ? (openBlock(), createBlock("span", {
											key: 1,
											class: "font-mono"
										}, toDisplayString(unref(newPin).latitude.toFixed(5)) + ", " + toDisplayString(unref(newPin).longitude.toFixed(5)), 1)) : (openBlock(), createBlock("span", { key: 2 }, toDisplayString(pinAddress.value || "Адрес не определён"), 1))]), createVNode("div", { class: "text-[10px] text-stone-400 leading-none mt-0.5 truncate" }, [showCoords.value ? (openBlock(), createBlock("span", { key: 0 }, toDisplayString(pinAddress.value || "кликни → переместить"), 1)) : (openBlock(), createBlock("span", { key: 1 }, "кликни → переместить"))])]),
										loadingPinAddress.value ? (openBlock(), createBlock("span", {
											key: 0,
											class: "w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin shrink-0"
										})) : !showCoords.value ? (openBlock(), createBlock("span", {
											key: 1,
											class: "hidden sm:inline text-[10px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5 shrink-0"
										}, "✓")) : createCommentVNode("", true)
									]),
									createVNode("label", { class: "flex items-center justify-between bg-white border border-stone-200 rounded-full px-3 py-2 cursor-pointer hover:bg-stone-50 transition" }, [createVNode("span", { class: "text-[11px] font-semibold flex items-center gap-1.5" }, [createVNode("span", { class: "w-5 h-5 rounded-full bg-stone-100 border border-stone-200 grid place-items-center text-[10px]" }, "◈"), createTextVNode(" Показать координаты")]), createVNode("span", { class: "relative inline-flex items-center" }, [withDirectives(createVNode("input", {
										type: "checkbox",
										"onUpdate:modelValue": ($event) => showCoords.value = $event,
										class: "sr-only"
									}, null, 8, ["onUpdate:modelValue"]), [[vModelCheckbox, showCoords.value]]), createVNode("span", { class: ["w-8 h-5 rounded-full p-0.5 flex items-center transition", showCoords.value ? "bg-ink-900" : "bg-stone-300"] }, [createVNode("span", { class: ["w-4 h-4 bg-white rounded-full shadow transition", showCoords.value ? "translate-x-3" : "translate-x-0"] }, null, 2)], 2)])]),
									createVNode("div", null, [
										createVNode("label", { class: "text-[10px] font-bold tracking-wide uppercase text-stone-500" }, "Заголовок *"),
										withDirectives(createVNode("input", {
											"onUpdate:modelValue": ($event) => unref(newPin).title = $event,
											placeholder: "Напр. Отдам стул, где кофе?",
											maxlength: "100",
											required: "",
											class: "mt-1 input-premium !py-2.5 text-[13px]"
										}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(newPin).title]]),
										createVNode("div", { class: "flex justify-between text-[10px] mt-1" }, [createVNode("span", { class: "text-stone-400" }, "Коротко"), createVNode("span", { class: unref(newPin).title.length > 80 ? "text-amber-600" : "text-stone-400" }, toDisplayString(unref(newPin).title.length) + "/100", 3)])
									]),
									createVNode("div", null, [createVNode("label", { class: "text-[10px] font-bold tracking-wide uppercase text-stone-500" }, "Подробности"), withDirectives(createVNode("textarea", {
										"onUpdate:modelValue": ($event) => unref(newPin).body = $event,
										placeholder: "Адрес, время, контакты…",
										rows: "2",
										maxlength: "1000",
										class: "mt-1 input-premium resize-none !py-2.5 text-[13px]"
									}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(newPin).body]])]),
									createVNode("div", null, [createVNode("label", { class: "text-[10px] font-bold tracking-wide uppercase text-stone-500" }, "Категория"), createVNode("div", { class: "mt-1.5 grid grid-cols-3 gap-1.5" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(categories), (c) => {
										return openBlock(), createBlock("button", {
											key: c.v,
											type: "button",
											onClick: ($event) => unref(newPin).category = c.v,
											class: ["group relative px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition", unref(newPin).category === c.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"]
										}, [createVNode("span", { class: "text-sm leading-none" }, toDisplayString(c.i), 1), createVNode("span", { class: "leading-none text-[11px]" }, toDisplayString(c.l), 1)], 10, ["onClick"]);
									}), 128))])]),
									createVNode("div", null, [
										createVNode("label", { class: "text-[10px] font-bold tracking-wide uppercase text-stone-500" }, "Приватность"),
										createVNode("div", { class: "mt-1.5 grid grid-cols-3 gap-1.5" }, [
											createVNode("button", {
												type: "button",
												onClick: ($event) => unref(newPin).location_precision = "blur_200",
												class: ["rounded-full py-2 text-xs font-semibold border transition flex items-center justify-center gap-1", unref(newPin).location_precision === "blur_200" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"]
											}, [createTextVNode("Размыто "), createVNode("span", { class: "text-[11px] opacity-60" }, "200м")], 10, ["onClick"]),
											createVNode("button", {
												type: "button",
												onClick: ($event) => unref(newPin).location_precision = "exact",
												class: ["rounded-full py-2 text-xs font-semibold border transition", unref(newPin).location_precision === "exact" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"]
											}, "Точно", 10, ["onClick"]),
											createVNode("button", {
												type: "button",
												onClick: ($event) => unref(newPin).location_precision = "district",
												class: ["rounded-full py-2 text-xs font-semibold border transition", unref(newPin).location_precision === "district" ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"]
											}, "Район", 10, ["onClick"])
										]),
										createVNode("p", { class: "text-[10px] text-stone-400 mt-1 text-center" }, "200м по умолчанию")
									]),
									createVNode("div", { class: "bg-white border border-stone-200 rounded-xl p-2.5" }, [createVNode("div", { class: "flex items-center justify-between" }, [createVNode("label", { class: "text-[10px] font-bold tracking-wide uppercase text-stone-500" }, "Радиус"), createVNode("span", { class: "text-[11px] font-bold bg-ink-900 text-white rounded-full px-2 py-0.5" }, toDisplayString(radiusLabel.value), 1)]), createVNode("div", { class: "mt-1.5 grid grid-cols-4 gap-1" }, [(openBlock(true), createBlock(Fragment, null, renderList(radiusOptions.value, (o) => {
										return openBlock(), createBlock("button", {
											key: o.v,
											type: "button",
											disabled: o.disabled,
											onClick: ($event) => unref(newPin).radius_meters = o.v,
											class: ["rounded-full py-2 text-xs font-semibold border transition", o.disabled ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed" : unref(newPin).radius_meters === o.v ? "bg-ink-900 text-white border-ink-900 shadow-soft" : "bg-white border-stone-200 hover:bg-stone-50"]
										}, toDisplayString(o.l), 11, ["disabled", "onClick"]);
									}), 128))])]),
									createVNode("label", { class: "flex items-center gap-2.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-stone-100 transition" }, [
										withDirectives(createVNode("input", {
											type: "checkbox",
											"onUpdate:modelValue": ($event) => unref(newPin).is_anonymous = $event,
											class: "rounded text-ink-900 w-[16px] h-[16px] border-stone-300"
										}, null, 8, ["onUpdate:modelValue"]), [[vModelCheckbox, unref(newPin).is_anonymous]]),
										createVNode("div", { class: "flex-1 min-w-0" }, [createVNode("div", { class: "text-xs font-semibold leading-none" }, "Анонимно"), createVNode("div", { class: "text-[11px] text-stone-500 mt-0.5" }, "без репутации")]),
										createVNode("span", { class: "hidden sm:inline text-[11px] font-medium bg-white border border-stone-200 rounded-full px-2 py-0.5" }, "🔒")
									]),
									createVNode("div", { class: "sticky bottom-0 bg-white pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] -mx-1 px-1 flex gap-2 border-t border-stone-100 mt-1.5" }, [createVNode("button", {
										type: "button",
										onClick: closeCreate,
										class: "flex-1 bg-white border border-stone-200 rounded-full py-2.5 font-semibold hover:bg-stone-50 active:scale-[0.98] transition min-h-[42px] text-sm"
									}, "Отмена"), createVNode("button", {
										disabled: creating.value || !unref(newPin).title.trim(),
										type: "submit",
										class: "flex-[1.4] bg-ink-900 text-white rounded-full py-2.5 font-semibold hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-soft active:scale-[0.98] transition flex items-center justify-center gap-2 min-h-[42px] text-sm"
									}, [creating.value ? (openBlock(), createBlock("span", {
										key: 0,
										class: "w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
									})) : createCommentVNode("", true), createTextVNode(" " + toDisplayString(creating.value ? "Создаём…" : "Создать пин →"), 1)], 8, ["disabled"])]),
									createVNode("p", { class: "text-[10px] text-stone-400 text-center leading-relaxed" }, "Free: 3/день · Pro $4.99 · 2–24ч · правила района")
								], 32)
							])])) : createCommentVNode("", true)]),
							_: 1
						}),
						createVNode(Transition, {
							"enter-active-class": "transition duration-200 ease-out",
							"enter-from-class": "opacity-0 translate-y-4 sm:translate-x-4 sm:translate-y-0",
							"enter-to-class": "opacity-100 translate-y-0 sm:translate-x-0",
							"leave-active-class": "transition duration-150 ease-in",
							"leave-from-class": "opacity-100",
							"leave-to-class": "opacity-0 translate-y-4 sm:translate-x-4"
						}, {
							default: withCtx(() => [unref(selectedPin) ? (openBlock(), createBlock("div", {
								key: 0,
								class: "absolute inset-x-3 bottom-3 top-auto max-h-[78vh] sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[380px] sm:max-h-none bg-white rounded-[20px] shadow-float border border-stone-200 flex flex-col overflow-hidden z-20"
							}, [
								createVNode("div", { class: "p-5 border-b border-stone-200" }, [
									!editing.value ? (openBlock(), createBlock("div", {
										key: 0,
										class: "flex justify-between items-start gap-3"
									}, [createVNode("h3", { class: "font-bold leading-tight pr-2 text-[15px]" }, toDisplayString(unref(selectedPin).title), 1), createVNode("div", { class: "flex items-center gap-1 shrink-0" }, [
										unref(selectedPin).is_owner ? (openBlock(), createBlock("button", {
											key: 0,
											onClick: startEdit,
											class: "w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-stone-50 grid place-items-center",
											title: "Редактировать"
										}, "✎")) : createCommentVNode("", true),
										unref(selectedPin).is_owner ? (openBlock(), createBlock("button", {
											key: 1,
											onClick: deleteSelectedPin,
											class: "w-8 h-8 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center",
											title: "Удалить пин"
										}, "🗑")) : createCommentVNode("", true),
										createVNode("button", {
											onClick: ($event) => unref(closePin)(),
											class: "w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 grid place-items-center text-stone-600"
										}, "✕", 8, ["onClick"])
									])])) : (openBlock(), createBlock("div", {
										key: 1,
										class: "space-y-3"
									}, [
										withDirectives(createVNode("input", {
											"onUpdate:modelValue": ($event) => editForm.value.title = $event,
											maxlength: "100",
											placeholder: "Заголовок",
											class: "w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900"
										}, null, 8, ["onUpdate:modelValue"]), [[vModelText, editForm.value.title]]),
										withDirectives(createVNode("textarea", {
											"onUpdate:modelValue": ($event) => editForm.value.body = $event,
											rows: "3",
											maxlength: "1000",
											placeholder: "Подробности",
											class: "w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-ink-900 resize-none"
										}, null, 8, ["onUpdate:modelValue"]), [[vModelText, editForm.value.body]]),
										createVNode("div", { class: "flex gap-1.5 flex-wrap" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(categories), (c) => {
											return openBlock(), createBlock("button", {
												key: c.v,
												onClick: ($event) => editForm.value.category = c.v,
												class: ["px-3 py-1.5 rounded-full text-xs font-semibold border", editForm.value.category === c.v ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"]
											}, toDisplayString(c.i) + " " + toDisplayString(c.l), 11, ["onClick"]);
										}), 128))]),
										createVNode("div", { class: "flex gap-2" }, [createVNode("button", {
											onClick: saveEdit,
											class: "flex-1 bg-ink-900 text-white rounded-full py-2.5 text-sm font-semibold hover:bg-ink-800"
										}, "Сохранить"), createVNode("button", {
											onClick: cancelEdit,
											class: "flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-sm font-semibold hover:bg-stone-50"
										}, "Отмена")])
									])),
									!editing.value ? (openBlock(), createBlock("p", {
										key: 2,
										class: "text-sm text-stone-600 mt-2 leading-relaxed"
									}, toDisplayString(unref(selectedPin).body), 1)) : createCommentVNode("", true),
									!editing.value ? (openBlock(), createBlock("div", {
										key: 3,
										class: "flex flex-wrap gap-1.5 mt-3 items-center"
									}, [
										createVNode("span", { class: "text-xs bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1 font-medium" }, toDisplayString(unref(selectedPin).category), 1),
										createVNode("span", { class: "text-xs bg-white border border-stone-200 rounded-full pl-1 pr-2.5 py-1 flex items-center gap-1.5" }, [unref(selectedPin).user?.avatar_path ? (openBlock(), createBlock("img", {
											key: 0,
											src: `/storage/${unref(selectedPin).user.avatar_path}`,
											class: "w-5 h-5 rounded-full object-cover border border-stone-200"
										}, null, 8, ["src"])) : unref(selectedPin).user?.name ? (openBlock(), createBlock("span", {
											key: 1,
											class: "w-5 h-5 rounded-full bg-ink-900 text-white grid place-items-center text-[10px] font-bold"
										}, toDisplayString(unref(selectedPin).user.name[0].toUpperCase()), 1)) : (openBlock(), createBlock("span", {
											key: 2,
											class: "w-5 h-5 rounded-full bg-stone-200 border border-stone-300 grid place-items-center text-[10px]"
										}, "?")), createTextVNode(" " + toDisplayString(unref(selectedPin).user?.name || "аноним") + " · " + toDisplayString(unref(selectedPin).user?.level || "novice"), 1)]),
										createVNode("span", { class: "text-xs bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1" }, "до " + toDisplayString(new Date(unref(selectedPin).expires_at).toLocaleTimeString().slice(0, 5)), 1)
									])) : createCommentVNode("", true),
									createVNode("div", { class: "flex gap-1.5 mt-4" }, [
										createVNode("button", {
											onClick: ($event) => unref(react)(unref(selectedPin), "like"),
											class: ["flex-1 rounded-full py-2.5 text-xs font-semibold border active:scale-95 transition flex items-center justify-center gap-1", unref(selectedPin).my_reaction === "like" ? "bg-rose-500 text-white border-rose-500 shadow-[0_2px_10px_rgba(244,63,94,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"]
										}, [createTextVNode("❤️ " + toDisplayString(unref(selectedPin).reactions_count || 0), 1), unref(selectedPin).my_reaction === "like" ? (openBlock(), createBlock("span", {
											key: 0,
											class: "w-1.5 h-1.5 bg-white rounded-full animate-pulse"
										})) : createCommentVNode("", true)], 10, ["onClick"]),
										createVNode("button", {
											onClick: ($event) => unref(react)(unref(selectedPin), "fire"),
											class: ["px-4 rounded-full text-xs font-semibold border active:scale-95 transition", unref(selectedPin).my_reaction === "fire" ? "bg-orange-500 text-white border-orange-500 shadow-[0_2px_10px_rgba(249,115,22,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"]
										}, "🔥", 10, ["onClick"]),
										createVNode("button", {
											onClick: ($event) => unref(react)(unref(selectedPin), "useful"),
											class: ["px-4 rounded-full text-xs font-semibold border active:scale-95 transition", unref(selectedPin).my_reaction === "useful" ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.35)]" : "bg-white border-stone-200 hover:bg-stone-50"]
										}, "👍", 10, ["onClick"]),
										createVNode("button", {
											onClick: ($event) => unref(reportPin)(unref(selectedPin)),
											class: "w-10 h-10 bg-white border border-stone-200 rounded-full grid place-items-center hover:bg-red-50 hover:text-red-600"
										}, "⚠", 8, ["onClick"])
									]),
									unref(selectedPin).my_reaction ? (openBlock(), createBlock("div", {
										key: 4,
										class: "mt-2 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5"
									}, "✓ Выбрано: " + toDisplayString({
										like: "❤️ Лайк",
										fire: "🔥 Огонь",
										useful: "👍 Полезно",
										laugh: "😂 Смешно",
										sad: "😢 Грустно",
										angry: "😡 Злость"
									}[unref(selectedPin).my_reaction] || unref(selectedPin).my_reaction), 1)) : createCommentVNode("", true),
									createVNode("div", { class: "grid grid-cols-3 gap-2 mt-4" }, [
										createVNode("button", {
											onClick: ($event) => unref(boost)(unref(selectedPin), "top"),
											class: "group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all"
										}, [
											createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
											createVNode("span", { class: "text-[15px] leading-none" }, "👑"),
											createVNode("span", { class: "text-xs font-black leading-none" }, "Топ $0.99"),
											createVNode("span", { class: "text-[11px] font-bold leading-none opacity-80" }, "поднять 1ч")
										], 8, ["onClick"]),
										createVNode("button", {
											onClick: ($event) => unref(boost)(unref(selectedPin), "glow"),
											class: "group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all"
										}, [
											createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
											createVNode("span", { class: "text-[15px] leading-none" }, "✨"),
											createVNode("span", { class: "text-xs font-black leading-none" }, "Подсветка $1.99"),
											createVNode("span", { class: "text-[11px] font-semibold leading-none opacity-80" }, "анимация")
										], 8, ["onClick"]),
										createVNode("button", {
											onClick: ($event) => unref(boost)(unref(selectedPin), "extend"),
											class: "group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl py-3 px-1 flex flex-col items-center justify-center gap-0.5 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all"
										}, [
											createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
											createVNode("span", { class: "text-[15px] leading-none" }, "⏳"),
											createVNode("span", { class: "text-xs font-black leading-none" }, "+24ч $2.99"),
											createVNode("span", { class: "text-[11px] font-semibold leading-none opacity-80" }, "продлить")
										], 8, ["onClick"])
									])
								]),
								createVNode("div", { class: "flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-stone-50/40" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(comments), (c) => {
									return openBlock(), createBlock("div", {
										key: c.id,
										class: "bg-white border border-stone-200 rounded-2xl p-3.5"
									}, [createVNode("div", { class: "font-semibold text-xs flex items-center gap-2" }, [
										createTextVNode(toDisplayString(c.is_anonymous ? "аноним" : c.user?.name) + " ", 1),
										createVNode("span", { class: "text-stone-400 font-normal" }, toDisplayString(new Date(c.created_at).toLocaleTimeString()), 1),
										c.user_id === unref(page).props.auth.user.id || unref(page).props.auth.user.is_admin || unref(page).props.auth.user.role === "admin" ? (openBlock(), createBlock("span", {
											key: 0,
											class: "ml-auto flex gap-1"
										}, [unref(editingCommentId) !== c.id ? (openBlock(), createBlock("button", {
											key: 0,
											onClick: ($event) => unref(startEditComment)(c),
											class: "text-[11px] px-2 py-0.5 rounded-full border hover:bg-stone-50"
										}, "✎ ред.", 8, ["onClick"])) : (openBlock(), createBlock(Fragment, { key: 1 }, [createVNode("button", {
											onClick: unref(saveEditComment),
											class: "text-[11px] px-2.5 py-1 rounded-full bg-ink-900 text-white font-semibold"
										}, "✓ Сохранить", 8, ["onClick"]), createVNode("button", {
											onClick: unref(cancelEditComment),
											class: "text-[11px] px-2.5 py-1 rounded-full border hover:bg-stone-50"
										}, "✕", 8, ["onClick"])], 64))])) : createCommentVNode("", true)
									]), unref(editingCommentId) === c.id ? (openBlock(), createBlock("div", {
										key: 0,
										class: "mt-2"
									}, [withDirectives(createVNode("textarea", {
										"onUpdate:modelValue": ($event) => isRef(editingContent) ? editingContent.value = $event : null,
										rows: "2",
										maxlength: "1000",
										class: "w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-ink-900"
									}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(editingContent)]]), createVNode("div", { class: "text-[11px] text-stone-400 mt-1 text-right" }, toDisplayString(unref(editingContent).length) + "/1000 · 3/день на пин", 1)])) : (openBlock(), createBlock("div", {
										key: 1,
										class: "text-sm text-stone-700 mt-1.5 leading-relaxed break-words"
									}, toDisplayString(c.content), 1))]);
								}), 128)), !unref(comments).length ? (openBlock(), createBlock("div", {
									key: 0,
									class: "text-center py-10"
								}, [createVNode("div", { class: "w-10 h-10 rounded-full bg-white border grid place-items-center mx-auto text-stone-400" }, "💬"), createVNode("div", { class: "text-xs text-stone-400 mt-2" }, [
									createTextVNode("Комментариев пока нет"),
									createVNode("br"),
									createTextVNode("Будь первым")
								])])) : createCommentVNode("", true)]),
								createVNode("form", {
									onSubmit: withModifiers(unref(sendComment), ["prevent"]),
									class: "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-stone-200 bg-white flex gap-2"
								}, [withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => isRef(commentText) ? commentText.value = $event : null,
									placeholder: "Написать комментарий...",
									class: "flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-full px-4 py-3 text-[16px] sm:text-sm focus:outline-none focus:border-ink-900 focus:bg-white transition"
								}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(commentText)]]), createVNode("button", { class: "w-11 h-11 rounded-full bg-ink-900 text-white grid place-items-center hover:bg-ink-800 active:scale-95 transition shrink-0" }, "↗")], 40, ["onSubmit"])
							])) : createCommentVNode("", true)]),
							_: 1
						})
					])];
				}),
				_: 1
			}, _parent));
			_push(`<!--]-->`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Map/Index.vue
var _sfc_setup = Index_vue_vue_type_script_setup_true_lang_default.setup;
Index_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Map/Index.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Index_default = /*#__PURE__*/ _plugin_vue_export_helper_default(Index_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-a6652ced"]]);
//#endregion
export { Index_default as default };
