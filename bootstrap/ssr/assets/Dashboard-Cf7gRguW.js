import { t as _sfc_main } from "./AuthenticatedLayout-Eh2FghNL.js";
import { t as useGeolocation } from "./useGeolocation-C4grL3cw.js";
import { Fragment, computed, createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, onMounted, openBlock, ref, renderList, toDisplayString, unref, useSSRContext, vModelSelect, vModelText, withCtx, withDirectives } from "vue";
import { Head, Link, usePage } from "@inertiajs/vue3";
import { ssrIncludeBooleanAttr, ssrInterpolate, ssrLooseContain, ssrLooseEqual, ssrRenderAttr, ssrRenderClass, ssrRenderComponent, ssrRenderList } from "vue/server-renderer";
import axios from "axios";
//#region resources/js/Pages/Dashboard.vue?vue&type=script&setup=true&lang.ts
var Dashboard_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Dashboard",
	__ssrInlineRender: true,
	setup(__props) {
		const user = usePage().props.auth.user;
		const pins = ref([]);
		const zoneCount = ref(0);
		const { coords, requestGeolocation } = useGeolocation([user.longitude ? Number(user.longitude) : 37.6173, user.latitude ? Number(user.latitude) : 55.7558]);
		const zoneForm = ref({
			radius_km: user.home_radius_km || 2,
			notify_via: "in_app"
		});
		const showZoneForm = ref(false);
		const myPins = computed(() => pins.value.filter((p) => p.is_owner || p.user?.id === user.id));
		const otherPins = computed(() => pins.value.filter((p) => !(p.is_owner || p.user?.id === user.id)));
		async function deletePin(id) {
			if (!confirm("Удалить пин?")) return;
			try {
				await axios.delete(`/api/pins/${id}`);
				pins.value = pins.value.filter((p) => p.id !== id);
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка удаления");
			}
		}
		async function boostFromDashboard(type) {
			const target = myPins.value[0] || otherPins.value[0] || pins.value[0];
			if (!target) {
				alert("Создай пин на карте чтобы попробовать буст");
				return;
			}
			if (type === "top" && !confirm(`Поднять пин "${target.title}" в ТОП на 1ч за $0.99?`)) return;
			if (type === "glow" && !confirm(`Подсветить пин "${target.title}" анимацией за $1.99?`)) return;
			if (type === "extend" && !confirm(`Продлить пин "${target.title}" на 24ч за $2.99?`)) return;
			try {
				await axios.post(`/api/pins/${target.id}/boost`, { type });
				alert("Буст активирован: " + type + " — пин \"" + target.title + "\"");
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка буста");
			}
		}
		onMounted(async () => {
			const loc = user.home_lat && user.home_lng ? {
				lat: Number(user.home_lat),
				lng: Number(user.home_lng)
			} : await requestGeolocation().catch(() => ({
				lat: 53.9022,
				lng: 27.5615
			}));
			try {
				const [nearRes, mineRes] = await Promise.allSettled([axios.get("/api/pins", { params: {
					lat: loc.lat,
					lng: loc.lng,
					radius: 5e3
				} }), axios.get("/api/pins/mine")]);
				const near = nearRes.status === "fulfilled" ? Array.isArray(nearRes.value.data) ? nearRes.value.data : nearRes.value.data.data || [] : [];
				const mine = mineRes.status === "fulfilled" ? Array.isArray(mineRes.value.data) ? mineRes.value.data : mineRes.value.data.data || [] : [];
				const map = /* @__PURE__ */ new Map();
				[...mine, ...near].forEach((p) => {
					if (!map.has(p.id)) map.set(p.id, p);
				});
				pins.value = Array.from(map.values()).slice(0, 12);
				if (!pins.value.length && mine.length) pins.value = mine.slice(0, 12);
			} catch {}
			try {
				const { data } = await axios.get("/api/zone-subscriptions");
				zoneCount.value = Array.isArray(data) ? data.length : 0;
			} catch (e) {
				if (e?.response?.status !== 401) console.error(e);
			}
		});
		async function createZone() {
			await axios.post("/api/zone-subscriptions", {
				lat: coords.value.lat,
				lng: coords.value.lng,
				radius_km: zoneForm.value.radius_km,
				notify_via: zoneForm.value.notify_via
			});
			zoneCount.value++;
			showZoneForm.value = false;
		}
		const levelLabel = {
			novice: "Новичок",
			local: "Местный",
			guide: "Гид района"
		};
		const levelColor = {
			novice: "bg-stone-100 text-stone-700 border-stone-200",
			local: "bg-emerald-50 text-emerald-700 border-emerald-200",
			guide: "bg-amber-50 text-amber-700 border-amber-200"
		};
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<!--[-->`);
			_push(ssrRenderComponent(unref(Head), { title: "Дашборд" }, null, _parent));
			_push(ssrRenderComponent(_sfc_main, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="bg-surface min-h-[calc(100vh-64px)]"${_scopeId}><div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-5"${_scopeId}><div class="bg-ink-900 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden"${_scopeId}><div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"${_scopeId}></div><div class="absolute -right-10 bottom-0 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.05]"${_scopeId}></div><div class="relative"${_scopeId}><div class="flex items-center gap-2 text-xs font-medium text-white/60"${_scopeId}> Привет, ${ssrInterpolate(unref(user).name)} <span class="${ssrRenderClass(["px-2.5 py-1 rounded-full text-xs font-bold border", levelColor[unref(user).level || "novice"]])}"${_scopeId}>${ssrInterpolate(levelLabel[unref(user).level || "novice"])}</span><span class="bg-white/10 border border-white/15 rounded-full px-2.5 py-1 text-white"${_scopeId}>${ssrInterpolate(unref(user).reputation_score || 0)} ★</span></div><h1 class="text-[24px] font-black tracking-tight mt-2"${_scopeId}>Твой район живой?</h1><p class="text-white/60 text-sm mt-1.5 max-w-xl leading-relaxed"${_scopeId}>Пины живут 2ч (free) / 24ч (pro). Проверь карту — не пропусти помощь и события рядом.</p></div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "relative bg-white text-ink-900 px-7 py-3 rounded-full font-bold hover:bg-stone-50 shadow-soft transition inline-flex items-center gap-2"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Открыть карту <span${_scopeId}>→</span>`);
								else return [createTextVNode("Открыть карту "), createVNode("span", null, "→")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div><div class="grid grid-cols-2 lg:grid-cols-4 gap-3"${_scopeId}><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group"${_scopeId}><div class="w-8 h-8 rounded-xl bg-ink-900 text-white grid place-items-center text-xs card-icon"${_scopeId}>◉</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide"${_scopeId}>План</div><div class="font-black text-lg capitalize tracking-tight"${_scopeId}>${ssrInterpolate(unref(user).plan || "free")}</div><div class="text-xs text-stone-500 dark:text-zinc-500"${_scopeId}>${ssrInterpolate(unref(user).plan === "free" ? "3 пина/день · 1 км" : "Безлимит · 5 км")}</div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group"${_scopeId}><div class="w-8 h-8 rounded-xl bg-brand-500 text-white grid place-items-center text-xs card-icon"${_scopeId}>✦</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide"${_scopeId}>Пинов сегодня</div><div class="font-black text-lg tracking-tight"${_scopeId}>${ssrInterpolate(unref(user).pins_today_count || 0)}/${ssrInterpolate(unref(user).plan === "free" ? 3 : "∞")}</div><div class="text-xs text-stone-500 dark:text-zinc-500"${_scopeId}>сброс в 00:00</div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group"${_scopeId}><div class="w-8 h-8 rounded-xl bg-emerald-600 text-white grid place-items-center text-xs card-icon"${_scopeId}>◐</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide"${_scopeId}>Подписки</div><div class="font-black text-lg tracking-tight"${_scopeId}>${ssrInterpolate(zoneCount.value)}</div><div class="text-xs text-stone-500 dark:text-zinc-500"${_scopeId}>уведомления о пинах</div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group"${_scopeId}><div class="w-8 h-8 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-xs card-icon"${_scopeId}>◎</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide"${_scopeId}>Радиус</div><div class="font-black text-lg tracking-tight"${_scopeId}>${ssrInterpolate(unref(user).home_radius_km || 2)} км</div><div class="text-xs text-stone-500 dark:text-zinc-500"${_scopeId}>${ssrInterpolate(unref(user).home_lat ? "дом задан" : "не задан")}</div></div></div><div class="grid lg:grid-cols-3 gap-4"${_scopeId}><div class="lg:col-span-2 bg-white border border-stone-200 rounded-[20px] p-6 shadow-soft"${_scopeId}><div class="flex items-center justify-between"${_scopeId}><h3 class="font-black tracking-tight"${_scopeId}>Быстрые действия</h3>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "text-xs font-semibold text-stone-500 hover:text-ink-900 bg-stone-100 rounded-full px-3 py-1"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`На карту →`);
								else return [createTextVNode("На карту →")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div><div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5"${_scopeId}>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "bg-ink-900 text-white rounded-[16px] p-4 flex flex-col gap-2 hover:bg-ink-800 transition shadow-soft"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`<span class="w-8 h-8 rounded-xl bg-white/15 grid place-items-center"${_scopeId}>＋</span><span class="text-sm font-bold leading-tight"${_scopeId}>Создать пин</span><span class="text-[11px] text-white/60"${_scopeId}>в 2 клика</span>`);
								else return [
									createVNode("span", { class: "w-8 h-8 rounded-xl bg-white/15 grid place-items-center" }, "＋"),
									createVNode("span", { class: "text-sm font-bold leading-tight" }, "Создать пин"),
									createVNode("span", { class: "text-[11px] text-white/60" }, "в 2 клика")
								];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 hover:bg-white hover:shadow-soft transition"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`<span class="w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm"${_scopeId}>🗺️</span><span class="text-sm font-bold leading-tight"${_scopeId}>Карта</span><span class="text-[11px] text-stone-500"${_scopeId}>30с polling</span>`);
								else return [
									createVNode("span", { class: "w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm" }, "🗺️"),
									createVNode("span", { class: "text-sm font-bold leading-tight" }, "Карта"),
									createVNode("span", { class: "text-[11px] text-stone-500" }, "30с polling")
								];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`<button class="bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 text-left hover:bg-white hover:shadow-soft transition"${_scopeId}><span class="w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm"${_scopeId}>🔔</span><span class="text-sm font-bold leading-tight"${_scopeId}>Зона</span><span class="text-[11px] text-stone-500"${_scopeId}>подписаться</span></button>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/profile",
							class: "bg-gradient-to-br from-amber-400 to-amber-500 rounded-[16px] p-4 flex flex-col gap-2 hover:from-amber-300 transition"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`<span class="w-8 h-8 rounded-xl bg-white/90 grid place-items-center text-sm"${_scopeId}>★</span><span class="text-sm font-bold leading-tight"${_scopeId}>Pro \$4.99</span><span class="text-[11px] text-ink-900/60"${_scopeId}>безлимит</span>`);
								else return [
									createVNode("span", { class: "w-8 h-8 rounded-xl bg-white/90 grid place-items-center text-sm" }, "★"),
									createVNode("span", { class: "text-sm font-bold leading-tight" }, "Pro $4.99"),
									createVNode("span", { class: "text-[11px] text-ink-900/60" }, "безлимит")
								];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div>`);
						if (showZoneForm.value) _push(`<div class="mt-4 border border-stone-200 rounded-2xl p-4 bg-stone-50 flex flex-wrap gap-3 items-end"${_scopeId}><div${_scopeId}><div class="text-xs font-medium"${_scopeId}>Радиус км</div><input${ssrRenderAttr("value", zoneForm.value.radius_km)} type="number" min="1" max="10" class="mt-1 border border-stone-200 rounded-xl px-3 py-2 w-24 text-sm bg-white focus:border-ink-900 outline-none"${_scopeId}></div><div${_scopeId}><div class="text-xs font-medium"${_scopeId}>Уведомления</div><select class="mt-1 border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white"${_scopeId}><option value="in_app"${ssrIncludeBooleanAttr(Array.isArray(zoneForm.value.notify_via) ? ssrLooseContain(zoneForm.value.notify_via, "in_app") : ssrLooseEqual(zoneForm.value.notify_via, "in_app")) ? " selected" : ""}${_scopeId}>в приложении</option><option value="push"${ssrIncludeBooleanAttr(Array.isArray(zoneForm.value.notify_via) ? ssrLooseContain(zoneForm.value.notify_via, "push") : ssrLooseEqual(zoneForm.value.notify_via, "push")) ? " selected" : ""}${_scopeId}>пуш</option><option value="email"${ssrIncludeBooleanAttr(Array.isArray(zoneForm.value.notify_via) ? ssrLooseContain(zoneForm.value.notify_via, "email") : ssrLooseEqual(zoneForm.value.notify_via, "email")) ? " selected" : ""}${_scopeId}>email</option></select></div><div class="text-[11px] text-stone-500 bg-white border rounded-full px-3 py-2"${_scopeId}>${ssrInterpolate(unref(coords).lat.toFixed(4))}, ${ssrInterpolate(unref(coords).lng.toFixed(4))}</div><button class="bg-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold ml-auto hover:bg-ink-800"${_scopeId}>Подписаться</button></div>`);
						else _push(`<!---->`);
						_push(`<div class="mt-5 grid grid-cols-3 gap-2"${_scopeId}><button class="group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"${_scopeId}></span><span class="text-lg"${_scopeId}>👑</span><span class="text-[15px] font-black"${_scopeId}>Топ \$0.99</span><span class="text-sm font-semibold opacity-80"${_scopeId}>поднять 1ч</span></button><button class="group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"${_scopeId}></span><span class="text-lg"${_scopeId}>✨</span><span class="text-[15px] font-black"${_scopeId}>Подсветка \$1.99</span><span class="text-sm font-semibold opacity-80"${_scopeId}>анимация</span></button><button class="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"${_scopeId}><span class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"${_scopeId}></span><span class="text-lg"${_scopeId}>⏳</span><span class="text-[15px] font-black"${_scopeId}>+24ч \$2.99</span><span class="text-sm font-semibold opacity-80"${_scopeId}>продлить</span></button></div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft"${_scopeId}><h3 class="font-black tracking-tight"${_scopeId}>Свежие пины рядом</h3>`);
						if (pins.value.length) {
							_push(`<div class="mt-4 space-y-5"${_scopeId}>`);
							if (myPins.value.length) {
								_push(`<div${_scopeId}><div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500"${_scopeId}>Мои · ${ssrInterpolate(myPins.value.length)}</div><div class="mt-2 space-y-2.5"${_scopeId}><!--[-->`);
								ssrRenderList(myPins.value.slice(0, 4), (p) => {
									_push(`<div class="border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 rounded-2xl p-3.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition relative"${_scopeId}><button class="absolute top-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 grid place-items-center text-xs" title="Удалить пин"${_scopeId}>✕</button><div class="text-sm font-semibold truncate pr-8 dark:text-zinc-100"${_scopeId}>${ssrInterpolate(p.title)}</div><div class="text-xs text-stone-600 dark:text-zinc-400 line-clamp-1 mt-0.5"${_scopeId}>${ssrInterpolate(p.body)}</div><div class="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2"${_scopeId}><span class="bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5"${_scopeId}>${ssrInterpolate(p.category)}</span><span${_scopeId}>${ssrInterpolate(p.reactions_count || 0)} ❤️</span><span class="ml-auto bg-white dark:bg-zinc-800 rounded-full px-2 py-0.5 border border-stone-200 dark:border-zinc-700"${_scopeId}>до ${ssrInterpolate(new Date(p.expires_at).toLocaleTimeString().slice(0, 5))}</span></div></div>`);
								});
								_push(`<!--]--></div></div>`);
							} else _push(`<!---->`);
							if (otherPins.value.length) {
								_push(`<div${_scopeId}><div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500"${_scopeId}>Пользователей · ${ssrInterpolate(otherPins.value.length)}</div><div class="mt-2 space-y-2.5"${_scopeId}><!--[-->`);
								ssrRenderList(otherPins.value.slice(0, 6), (p) => {
									_push(`<div class="border border-stone-200 dark:border-zinc-700 rounded-2xl p-3.5 hover:bg-stone-50 dark:hover:bg-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600 transition bg-white dark:bg-zinc-800/50"${_scopeId}><div class="text-sm font-semibold truncate dark:text-zinc-100"${_scopeId}>${ssrInterpolate(p.title)}</div><div class="text-xs text-stone-500 dark:text-zinc-400 line-clamp-1 mt-0.5"${_scopeId}>${ssrInterpolate(p.body)}</div><div class="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2"${_scopeId}><span class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5"${_scopeId}>${ssrInterpolate(p.category)}</span><span${_scopeId}>${ssrInterpolate(p.reactions_count || 0)} ❤️</span><span class="ml-auto bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5"${_scopeId}>до ${ssrInterpolate(new Date(p.expires_at).toLocaleTimeString().slice(0, 5))}</span></div></div>`);
								});
								_push(`<!--]--></div></div>`);
							} else _push(`<!---->`);
							if (!myPins.value.length && !otherPins.value.length) _push(`<div class="text-center py-4 text-xs text-stone-400"${_scopeId}>Нет пинов</div>`);
							else _push(`<!---->`);
							_push(`</div>`);
						} else _push(`<div class="text-center py-8"${_scopeId}><div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 mx-auto grid place-items-center text-stone-400"${_scopeId}>◎</div><div class="text-sm font-medium text-stone-600 dark:text-zinc-400 mt-3"${_scopeId}>Пинов пока нет</div><div class="text-xs text-stone-400"${_scopeId}>Стань первым в районе</div></div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "mt-4 inline-flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Открыть карту`);
								else return [createTextVNode("Открыть карту")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></div><div class="bg-white border border-stone-200 rounded-[20px] p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft"${_scopeId}><div class="text-sm flex items-center gap-3"${_scopeId}><span class="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 grid place-items-center text-emerald-700 text-xs"${_scopeId}>✓</span><span${_scopeId}><b${_scopeId}>Приватность:</b> <span class="text-stone-600"${_scopeId}>ты — не точка, ты — пин. Размытие 200м · анонимно · блок в 1 клик.</span></span></div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/profile",
							class: "text-sm font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition whitespace-nowrap"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Настройки →`);
								else return [createTextVNode("Настройки →")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></div></div>`);
					} else return [createVNode("div", { class: "bg-surface min-h-[calc(100vh-64px)]" }, [createVNode("div", { class: "max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-5" }, [
						createVNode("div", { class: "bg-ink-900 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden" }, [
							createVNode("div", { class: "absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20" }),
							createVNode("div", { class: "absolute -right-10 bottom-0 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.05]" }),
							createVNode("div", { class: "relative" }, [
								createVNode("div", { class: "flex items-center gap-2 text-xs font-medium text-white/60" }, [
									createTextVNode(" Привет, " + toDisplayString(unref(user).name) + " ", 1),
									createVNode("span", { class: ["px-2.5 py-1 rounded-full text-xs font-bold border", levelColor[unref(user).level || "novice"]] }, toDisplayString(levelLabel[unref(user).level || "novice"]), 3),
									createVNode("span", { class: "bg-white/10 border border-white/15 rounded-full px-2.5 py-1 text-white" }, toDisplayString(unref(user).reputation_score || 0) + " ★", 1)
								]),
								createVNode("h1", { class: "text-[24px] font-black tracking-tight mt-2" }, "Твой район живой?"),
								createVNode("p", { class: "text-white/60 text-sm mt-1.5 max-w-xl leading-relaxed" }, "Пины живут 2ч (free) / 24ч (pro). Проверь карту — не пропусти помощь и события рядом.")
							]),
							createVNode(unref(Link), {
								href: "/map",
								class: "relative bg-white text-ink-900 px-7 py-3 rounded-full font-bold hover:bg-stone-50 shadow-soft transition inline-flex items-center gap-2"
							}, {
								default: withCtx(() => [createTextVNode("Открыть карту "), createVNode("span", null, "→")]),
								_: 1
							})
						]),
						createVNode("div", { class: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, [
							createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group" }, [
								createVNode("div", { class: "w-8 h-8 rounded-xl bg-ink-900 text-white grid place-items-center text-xs card-icon" }, "◉"),
								createVNode("div", { class: "text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide" }, "План"),
								createVNode("div", { class: "font-black text-lg capitalize tracking-tight" }, toDisplayString(unref(user).plan || "free"), 1),
								createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-500" }, toDisplayString(unref(user).plan === "free" ? "3 пина/день · 1 км" : "Безлимит · 5 км"), 1)
							]),
							createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group" }, [
								createVNode("div", { class: "w-8 h-8 rounded-xl bg-brand-500 text-white grid place-items-center text-xs card-icon" }, "✦"),
								createVNode("div", { class: "text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide" }, "Пинов сегодня"),
								createVNode("div", { class: "font-black text-lg tracking-tight" }, toDisplayString(unref(user).pins_today_count || 0) + "/" + toDisplayString(unref(user).plan === "free" ? 3 : "∞"), 1),
								createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-500" }, "сброс в 00:00")
							]),
							createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group" }, [
								createVNode("div", { class: "w-8 h-8 rounded-xl bg-emerald-600 text-white grid place-items-center text-xs card-icon" }, "◐"),
								createVNode("div", { class: "text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide" }, "Подписки"),
								createVNode("div", { class: "font-black text-lg tracking-tight" }, toDisplayString(zoneCount.value), 1),
								createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-500" }, "уведомления о пинах")
							]),
							createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-5 card-hover group" }, [
								createVNode("div", { class: "w-8 h-8 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-xs card-icon" }, "◎"),
								createVNode("div", { class: "text-xs font-medium text-stone-500 dark:text-zinc-500 mt-3 uppercase tracking-wide" }, "Радиус"),
								createVNode("div", { class: "font-black text-lg tracking-tight" }, toDisplayString(unref(user).home_radius_km || 2) + " км", 1),
								createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-500" }, toDisplayString(unref(user).home_lat ? "дом задан" : "не задан"), 1)
							])
						]),
						createVNode("div", { class: "grid lg:grid-cols-3 gap-4" }, [createVNode("div", { class: "lg:col-span-2 bg-white border border-stone-200 rounded-[20px] p-6 shadow-soft" }, [
							createVNode("div", { class: "flex items-center justify-between" }, [createVNode("h3", { class: "font-black tracking-tight" }, "Быстрые действия"), createVNode(unref(Link), {
								href: "/map",
								class: "text-xs font-semibold text-stone-500 hover:text-ink-900 bg-stone-100 rounded-full px-3 py-1"
							}, {
								default: withCtx(() => [createTextVNode("На карту →")]),
								_: 1
							})]),
							createVNode("div", { class: "grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5" }, [
								createVNode(unref(Link), {
									href: "/map",
									class: "bg-ink-900 text-white rounded-[16px] p-4 flex flex-col gap-2 hover:bg-ink-800 transition shadow-soft"
								}, {
									default: withCtx(() => [
										createVNode("span", { class: "w-8 h-8 rounded-xl bg-white/15 grid place-items-center" }, "＋"),
										createVNode("span", { class: "text-sm font-bold leading-tight" }, "Создать пин"),
										createVNode("span", { class: "text-[11px] text-white/60" }, "в 2 клика")
									]),
									_: 1
								}),
								createVNode(unref(Link), {
									href: "/map",
									class: "bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 hover:bg-white hover:shadow-soft transition"
								}, {
									default: withCtx(() => [
										createVNode("span", { class: "w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm" }, "🗺️"),
										createVNode("span", { class: "text-sm font-bold leading-tight" }, "Карта"),
										createVNode("span", { class: "text-[11px] text-stone-500" }, "30с polling")
									]),
									_: 1
								}),
								createVNode("button", {
									onClick: ($event) => showZoneForm.value = !showZoneForm.value,
									class: "bg-stone-50 border border-stone-200 rounded-[16px] p-4 flex flex-col gap-2 text-left hover:bg-white hover:shadow-soft transition"
								}, [
									createVNode("span", { class: "w-8 h-8 rounded-xl bg-white border grid place-items-center text-sm" }, "🔔"),
									createVNode("span", { class: "text-sm font-bold leading-tight" }, "Зона"),
									createVNode("span", { class: "text-[11px] text-stone-500" }, "подписаться")
								], 8, ["onClick"]),
								createVNode(unref(Link), {
									href: "/profile",
									class: "bg-gradient-to-br from-amber-400 to-amber-500 rounded-[16px] p-4 flex flex-col gap-2 hover:from-amber-300 transition"
								}, {
									default: withCtx(() => [
										createVNode("span", { class: "w-8 h-8 rounded-xl bg-white/90 grid place-items-center text-sm" }, "★"),
										createVNode("span", { class: "text-sm font-bold leading-tight" }, "Pro $4.99"),
										createVNode("span", { class: "text-[11px] text-ink-900/60" }, "безлимит")
									]),
									_: 1
								})
							]),
							showZoneForm.value ? (openBlock(), createBlock("div", {
								key: 0,
								class: "mt-4 border border-stone-200 rounded-2xl p-4 bg-stone-50 flex flex-wrap gap-3 items-end"
							}, [
								createVNode("div", null, [createVNode("div", { class: "text-xs font-medium" }, "Радиус км"), withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => zoneForm.value.radius_km = $event,
									type: "number",
									min: "1",
									max: "10",
									class: "mt-1 border border-stone-200 rounded-xl px-3 py-2 w-24 text-sm bg-white focus:border-ink-900 outline-none"
								}, null, 8, ["onUpdate:modelValue"]), [[
									vModelText,
									zoneForm.value.radius_km,
									void 0,
									{ number: true }
								]])]),
								createVNode("div", null, [createVNode("div", { class: "text-xs font-medium" }, "Уведомления"), withDirectives(createVNode("select", {
									"onUpdate:modelValue": ($event) => zoneForm.value.notify_via = $event,
									class: "mt-1 border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white"
								}, [
									createVNode("option", { value: "in_app" }, "в приложении"),
									createVNode("option", { value: "push" }, "пуш"),
									createVNode("option", { value: "email" }, "email")
								], 8, ["onUpdate:modelValue"]), [[vModelSelect, zoneForm.value.notify_via]])]),
								createVNode("div", { class: "text-[11px] text-stone-500 bg-white border rounded-full px-3 py-2" }, toDisplayString(unref(coords).lat.toFixed(4)) + ", " + toDisplayString(unref(coords).lng.toFixed(4)), 1),
								createVNode("button", {
									onClick: createZone,
									class: "bg-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold ml-auto hover:bg-ink-800"
								}, "Подписаться")
							])) : createCommentVNode("", true),
							createVNode("div", { class: "mt-5 grid grid-cols-3 gap-2" }, [
								createVNode("button", {
									onClick: ($event) => boostFromDashboard("top"),
									class: "group relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"
								}, [
									createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
									createVNode("span", { class: "text-lg" }, "👑"),
									createVNode("span", { class: "text-[15px] font-black" }, "Топ $0.99"),
									createVNode("span", { class: "text-sm font-semibold opacity-80" }, "поднять 1ч")
								], 8, ["onClick"]),
								createVNode("button", {
									onClick: ($event) => boostFromDashboard("glow"),
									class: "group relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"
								}, [
									createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
									createVNode("span", { class: "text-lg" }, "✨"),
									createVNode("span", { class: "text-[15px] font-black" }, "Подсветка $1.99"),
									createVNode("span", { class: "text-sm font-semibold opacity-80" }, "анимация")
								], 8, ["onClick"]),
								createVNode("button", {
									onClick: ($event) => boostFromDashboard("extend"),
									class: "group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:scale-95 transition-all text-center"
								}, [
									createVNode("span", { class: "absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" }),
									createVNode("span", { class: "text-lg" }, "⏳"),
									createVNode("span", { class: "text-[15px] font-black" }, "+24ч $2.99"),
									createVNode("span", { class: "text-sm font-semibold opacity-80" }, "продлить")
								], 8, ["onClick"])
							])
						]), createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft" }, [
							createVNode("h3", { class: "font-black tracking-tight" }, "Свежие пины рядом"),
							pins.value.length ? (openBlock(), createBlock("div", {
								key: 0,
								class: "mt-4 space-y-5"
							}, [
								myPins.value.length ? (openBlock(), createBlock("div", { key: 0 }, [createVNode("div", { class: "text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500" }, "Мои · " + toDisplayString(myPins.value.length), 1), createVNode("div", { class: "mt-2 space-y-2.5" }, [(openBlock(true), createBlock(Fragment, null, renderList(myPins.value.slice(0, 4), (p) => {
									return openBlock(), createBlock("div", {
										key: "m" + p.id,
										class: "border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 rounded-2xl p-3.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition relative"
									}, [
										createVNode("button", {
											onClick: ($event) => deletePin(p.id),
											class: "absolute top-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 grid place-items-center text-xs",
											title: "Удалить пин"
										}, "✕", 8, ["onClick"]),
										createVNode("div", { class: "text-sm font-semibold truncate pr-8 dark:text-zinc-100" }, toDisplayString(p.title), 1),
										createVNode("div", { class: "text-xs text-stone-600 dark:text-zinc-400 line-clamp-1 mt-0.5" }, toDisplayString(p.body), 1),
										createVNode("div", { class: "flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2" }, [
											createVNode("span", { class: "bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5" }, toDisplayString(p.category), 1),
											createVNode("span", null, toDisplayString(p.reactions_count || 0) + " ❤️", 1),
											createVNode("span", { class: "ml-auto bg-white dark:bg-zinc-800 rounded-full px-2 py-0.5 border border-stone-200 dark:border-zinc-700" }, "до " + toDisplayString(new Date(p.expires_at).toLocaleTimeString().slice(0, 5)), 1)
										])
									]);
								}), 128))])])) : createCommentVNode("", true),
								otherPins.value.length ? (openBlock(), createBlock("div", { key: 1 }, [createVNode("div", { class: "text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500" }, "Пользователей · " + toDisplayString(otherPins.value.length), 1), createVNode("div", { class: "mt-2 space-y-2.5" }, [(openBlock(true), createBlock(Fragment, null, renderList(otherPins.value.slice(0, 6), (p) => {
									return openBlock(), createBlock("div", {
										key: p.id,
										class: "border border-stone-200 dark:border-zinc-700 rounded-2xl p-3.5 hover:bg-stone-50 dark:hover:bg-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600 transition bg-white dark:bg-zinc-800/50"
									}, [
										createVNode("div", { class: "text-sm font-semibold truncate dark:text-zinc-100" }, toDisplayString(p.title), 1),
										createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-400 line-clamp-1 mt-0.5" }, toDisplayString(p.body), 1),
										createVNode("div", { class: "flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-zinc-400 mt-2" }, [
											createVNode("span", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5" }, toDisplayString(p.category), 1),
											createVNode("span", null, toDisplayString(p.reactions_count || 0) + " ❤️", 1),
											createVNode("span", { class: "ml-auto bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-2 py-0.5" }, "до " + toDisplayString(new Date(p.expires_at).toLocaleTimeString().slice(0, 5)), 1)
										])
									]);
								}), 128))])])) : createCommentVNode("", true),
								!myPins.value.length && !otherPins.value.length ? (openBlock(), createBlock("div", {
									key: 2,
									class: "text-center py-4 text-xs text-stone-400"
								}, "Нет пинов")) : createCommentVNode("", true)
							])) : (openBlock(), createBlock("div", {
								key: 1,
								class: "text-center py-8"
							}, [
								createVNode("div", { class: "w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 mx-auto grid place-items-center text-stone-400" }, "◎"),
								createVNode("div", { class: "text-sm font-medium text-stone-600 dark:text-zinc-400 mt-3" }, "Пинов пока нет"),
								createVNode("div", { class: "text-xs text-stone-400" }, "Стань первым в районе")
							])),
							createVNode(unref(Link), {
								href: "/map",
								class: "mt-4 inline-flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100"
							}, {
								default: withCtx(() => [createTextVNode("Открыть карту")]),
								_: 1
							})
						])]),
						createVNode("div", { class: "bg-white border border-stone-200 rounded-[20px] p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-soft" }, [createVNode("div", { class: "text-sm flex items-center gap-3" }, [createVNode("span", { class: "w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 grid place-items-center text-emerald-700 text-xs" }, "✓"), createVNode("span", null, [
							createVNode("b", null, "Приватность:"),
							createTextVNode(),
							createVNode("span", { class: "text-stone-600" }, "ты — не точка, ты — пин. Размытие 200м · анонимно · блок в 1 клик.")
						])]), createVNode(unref(Link), {
							href: "/profile",
							class: "text-sm font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition whitespace-nowrap"
						}, {
							default: withCtx(() => [createTextVNode("Настройки →")]),
							_: 1
						})])
					])])];
				}),
				_: 1
			}, _parent));
			_push(`<!--]-->`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Dashboard.vue
var _sfc_setup = Dashboard_vue_vue_type_script_setup_true_lang_default.setup;
Dashboard_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Dashboard.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Dashboard_default = Dashboard_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { Dashboard_default as default };
