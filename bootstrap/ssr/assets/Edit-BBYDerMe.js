import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { t as _sfc_main } from "./AuthenticatedLayout-Eh2FghNL.js";
import { t as useTheme } from "./useTheme-bkO1S2cW.js";
import { t as DeleteUserForm_default } from "./DeleteUserForm-Db5A2-n6.js";
import { t as UpdatePasswordForm_default } from "./UpdatePasswordForm-tDCHcBgo.js";
import { r as AvatarPreview_default, t as UpdateProfileInformationForm_default } from "./UpdateProfileInformationForm-FlYTtoLz.js";
import { Fragment, computed, createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, openBlock, ref, renderList, toDisplayString, unref, useSSRContext, vModelText, vShow, watch, withCtx, withDirectives } from "vue";
import { Head, Link, usePage } from "@inertiajs/vue3";
import { ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrRenderComponent, ssrRenderList, ssrRenderStyle } from "vue/server-renderer";
import axios from "axios";
//#region resources/js/Pages/Profile/Edit.vue?vue&type=script&setup=true&lang.ts
var Edit_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Edit",
	__ssrInlineRender: true,
	props: {
		mustVerifyEmail: { type: Boolean },
		status: {},
		user: {}
	},
	setup(__props) {
		const props = __props;
		const page = usePage();
		const u = computed(() => props.user || page.props.auth.user);
		const { theme, setTheme } = useTheme();
		const active = ref("profile");
		const tabs = [
			{
				id: "profile",
				label: "Профиль",
				icon: "◉",
				desc: "Фото, имя, дом"
			},
			{
				id: "pins",
				label: "Мои пины",
				icon: "📍",
				desc: "Созданные, удалить"
			},
			{
				id: "privacy",
				label: "Приватность",
				icon: "🔒",
				desc: "Анонимность, зона"
			},
			{
				id: "appearance",
				label: "Внешний вид",
				icon: "◐",
				desc: "Тема, карта"
			},
			{
				id: "security",
				label: "Безопасность",
				icon: "🛡",
				desc: "Пароль, удаление"
			},
			{
				id: "support",
				label: "Поддержка",
				icon: "💬",
				desc: "Письмо, донат"
			}
		];
		const myPins = ref([]);
		const loadingPins = ref(false);
		async function loadMyPins() {
			loadingPins.value = true;
			try {
				const { data } = await axios.get("/api/pins/mine");
				myPins.value = Array.isArray(data) ? data : [];
			} catch {} finally {
				loadingPins.value = false;
			}
		}
		async function deleteMyPin(id) {
			if (!confirm("Удалить пин?")) return;
			try {
				await axios.delete(`/api/pins/${id}`);
				myPins.value = myPins.value.filter((p) => p.id !== id);
			} catch (e) {
				alert(e?.response?.data?.message || "Ошибка");
			}
		}
		watch(active, (v) => {
			if (v === "pins") loadMyPins();
			if (v === "support") loadRate();
		});
		const showAvatar = ref(false);
		const supportSubject = ref("");
		const supportBody = ref("");
		const supportBodyRef = ref(null);
		const donateSel = ref(5);
		const usdRate = ref(null);
		const rateLoading = ref(false);
		async function loadRate() {
			if (usdRate.value) return;
			rateLoading.value = true;
			try {
				const d = await (await fetch("https://api.nbrb.by/exrates/rates/431?parammode=2")).json();
				usdRate.value = d.Cur_OfficialRate / d.Cur_Scale;
			} catch {
				try {
					const d2 = await (await fetch("https://api.exchangerate-api.com/v4/latest/USD")).json();
					usdRate.value = d2.rates?.BYN || null;
				} catch {}
			} finally {
				rateLoading.value = false;
			}
		}
		function fmtByn(usd) {
			if (!usdRate.value) return "—";
			return (usd * usdRate.value).toFixed(2) + " BYN";
		}
		function mailToSupport() {
			const subj = encodeURIComponent(supportSubject.value || "Обращение в поддержку Live Map");
			const body = encodeURIComponent(supportBody.value + (supportBody.value ? "\n\n---\n" : `Пользователь: ${u.value.name} <${u.value.email}>`));
			window.location.href = `mailto:razormad666@gmail.com?subject=${subj}&body=${body}`;
		}
		function mailToDonate(usd) {
			const byn = usdRate.value ? (usd * usdRate.value).toFixed(2) + " BYN" : `${usd}$`;
			const subj = encodeURIComponent(`Донат Live Map — $${usd} (~${byn})`);
			const body = encodeURIComponent(`Привет! Хочу задонатить $${usd} (~${byn}) разработчику Live Map.\n\nПользователь: ${u.value.name} <${u.value.email}>\nТариф: ${u.value.plan || "free"}\n\nСообщение:\n`);
			window.location.href = `mailto:razormad666@gmail.com?subject=${subj}&body=${body}`;
		}
		const avatarSrc = computed(() => u.value.avatar_path ? `/storage/${u.value.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.value.name)}&background=0F172A&color=fff&bold=true`);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<!--[-->`);
			_push(ssrRenderComponent(unref(Head), { title: "Настройки" }, null, _parent));
			_push(ssrRenderComponent(_sfc_main, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]" data-v-c3bdba16${_scopeId}><div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6" data-v-c3bdba16${_scopeId}><div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden" data-v-c3bdba16${_scopeId}><div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20" data-v-c3bdba16${_scopeId}></div><div class="relative flex items-center gap-4 min-w-0" data-v-c3bdba16${_scopeId}><button class="group relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40" data-v-c3bdba16${_scopeId}><img${ssrRenderAttr("src", avatarSrc.value)} class="w-full h-full object-cover group-hover:scale-105 transition duration-300" data-v-c3bdba16${_scopeId}><span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs" data-v-c3bdba16${_scopeId}>🔍</span></button><div class="min-w-0" data-v-c3bdba16${_scopeId}><h1 class="text-xl font-black tracking-tight truncate" data-v-c3bdba16${_scopeId}>${ssrInterpolate(u.value.name)} <span class="font-medium text-white/60 text-sm ml-2" data-v-c3bdba16${_scopeId}>${ssrInterpolate(u.value.level || "novice")} · ${ssrInterpolate(u.value.reputation_score || 0)} ★</span></h1><p class="text-white/60 text-sm mt-0.5 truncate" data-v-c3bdba16${_scopeId}>${ssrInterpolate(u.value.email)} · <span class="capitalize" data-v-c3bdba16${_scopeId}>${ssrInterpolate(u.value.plan || "free")}</span> · ${ssrInterpolate(u.value.home_lat ? `дом ${Number(u.value.home_lat).toFixed(3)}, ${Number(u.value.home_lng).toFixed(3)}` : "дом не задан")}</p></div></div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "relative bg-white text-ink-900 px-6 py-3 rounded-full font-bold h-fit hover:bg-stone-50 transition shrink-0 self-start sm:self-center"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`На карту →`);
								else return [createTextVNode("На карту →")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div><div class="mt-6 grid lg:grid-cols-[280px_1fr] gap-6 items-start" data-v-c3bdba16${_scopeId}><div class="lg:sticky lg:top-[80px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-2 shadow-soft" data-v-c3bdba16${_scopeId}><div class="hidden lg:block px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase" data-v-c3bdba16${_scopeId}>Настройки</div><nav class="flex lg:block gap-1.5 lg:space-y-1 overflow-x-auto scrollbar-none pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 snap-x" data-v-c3bdba16${_scopeId}><!--[-->`);
						ssrRenderList(tabs, (t) => {
							_push(`<button class="${ssrRenderClass(["shrink-0 lg:w-full text-left flex items-center gap-3 px-3 py-2.5 lg:py-3 rounded-xl transition snap-start", active.value === t.id ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-soft" : "hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 bg-stone-50 lg:bg-transparent dark:bg-zinc-800/50 lg:dark:bg-transparent border lg:border-0 border-stone-200 dark:border-zinc-700"])}" data-v-c3bdba16${_scopeId}><span class="${ssrRenderClass([active.value === t.id ? "bg-white/15 dark:bg-ink-900/10" : "bg-white lg:bg-stone-100 dark:bg-zinc-700", "w-8 h-8 lg:w-9 lg:h-9 rounded-xl grid place-items-center text-sm shrink-0"])}" data-v-c3bdba16${_scopeId}>${ssrInterpolate(t.icon)}</span><div class="min-w-0 hidden sm:block lg:block" data-v-c3bdba16${_scopeId}><div class="text-sm font-semibold leading-none whitespace-nowrap" data-v-c3bdba16${_scopeId}>${ssrInterpolate(t.label)}</div><div class="text-xs opacity-60 leading-none mt-1 hidden lg:block" data-v-c3bdba16${_scopeId}>${ssrInterpolate(t.desc)}</div></div><span class="text-xs font-semibold sm:hidden lg:hidden" data-v-c3bdba16${_scopeId}>${ssrInterpolate(t.label)}</span>`);
							if (active.value === t.id) _push(`<span class="ml-auto text-xs hidden lg:inline" data-v-c3bdba16${_scopeId}>→</span>`);
							else _push(`<!---->`);
							_push(`</button>`);
						});
						_push(`<!--]--></nav><div class="mt-4 mx-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3" data-v-c3bdba16${_scopeId}><div class="text-xs font-bold" data-v-c3bdba16${_scopeId}>Подписка ${ssrInterpolate(u.value.plan || "free")}</div><div class="text-xs text-stone-600 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>${ssrInterpolate(u.value.pins_today_count || 0)}/${ssrInterpolate(u.value.plan === "free" ? 3 : "∞")} пинов сегодня</div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/profile",
							class: "text-xs font-semibold underline mt-2 inline-block"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Управление →`);
								else return [createTextVNode("Управление →")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></div><div class="space-y-4 min-w-0" data-v-c3bdba16${_scopeId}><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" style="${ssrRenderStyle(active.value === "profile" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight text-lg" data-v-c3bdba16${_scopeId}>Профиль</h3><p class="text-sm text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Фото, имя и домашняя зона — на них строится весь Live Map.</p>`);
						_push(ssrRenderComponent(UpdateProfileInformationForm_default, {
							"must-verify-email": __props.mustVerifyEmail,
							status: __props.status,
							class: "mt-5 max-w-xl"
						}, null, _parent, _scopeId));
						_push(`</div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" style="${ssrRenderStyle(active.value === "privacy" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight text-lg" data-v-c3bdba16${_scopeId}>Приватность</h3><p class="text-sm text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Ты — не точка, ты — пин. Управляй размытием и анонимностью.</p><div class="mt-5 space-y-4 max-w-xl" data-v-c3bdba16${_scopeId}><div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4" data-v-c3bdba16${_scopeId}><div class="text-sm font-semibold" data-v-c3bdba16${_scopeId}>Базовые принципы</div><ul class="text-sm text-stone-600 dark:text-zinc-400 mt-2 space-y-1 list-disc pl-5" data-v-c3bdba16${_scopeId}><li data-v-c3bdba16${_scopeId}>Размытие 200м по умолчанию — координаты смещаются случайно</li><li data-v-c3bdba16${_scopeId}>Анонимный пин скрывает имя и репутацию</li><li data-v-c3bdba16${_scopeId}>Блокировка в 1 клик скрывает контент пользователя</li></ul></div><div class="border border-stone-200 dark:border-zinc-700 rounded-2xl p-4" data-v-c3bdba16${_scopeId}><div class="text-sm font-semibold" data-v-c3bdba16${_scopeId}>Режим анонимности по умолчанию</div><p class="text-xs text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию». При создании пина можно переопределить.</p><button class="mt-3 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full" data-v-c3bdba16${_scopeId}>Перейти в Профиль →</button></div></div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" style="${ssrRenderStyle(active.value === "appearance" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight text-lg" data-v-c3bdba16${_scopeId}>Внешний вид</h3><p class="text-sm text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Тема оформления и отображение карты.</p><div class="mt-6 space-y-5 max-w-xl" data-v-c3bdba16${_scopeId}><div data-v-c3bdba16${_scopeId}><div class="text-sm font-semibold" data-v-c3bdba16${_scopeId}>Тема</div><div class="text-xs text-stone-500 dark:text-zinc-400" data-v-c3bdba16${_scopeId}>Выбери как выглядит Live Map на этом устройстве</div><div class="mt-3 grid grid-cols-3 gap-2" data-v-c3bdba16${_scopeId}><button class="${ssrRenderClass(["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "light" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"])}" data-v-c3bdba16${_scopeId}><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 grid place-items-center text-sm" data-v-c3bdba16${_scopeId}>☀️</span><span class="text-xs font-semibold" data-v-c3bdba16${_scopeId}>Светлая</span></button><button class="${ssrRenderClass(["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "dark" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"])}" data-v-c3bdba16${_scopeId}><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-items-center text-sm text-white" data-v-c3bdba16${_scopeId}>🌙</span><span class="text-xs font-semibold" data-v-c3bdba16${_scopeId}>Тёмная</span></button><button class="${ssrRenderClass(["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "system" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"])}" data-v-c3bdba16${_scopeId}><span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-zinc-800 grid place-items-center text-sm" data-v-c3bdba16${_scopeId}>◐</span><span class="text-xs font-semibold" data-v-c3bdba16${_scopeId}>Система</span></button></div><div class="text-[11px] text-stone-400 mt-2" data-v-c3bdba16${_scopeId}>Система = следует настройкам OS</div></div></div></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft" style="${ssrRenderStyle(active.value === "pins" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight text-lg" data-v-c3bdba16${_scopeId}>Мои пины</h3><p class="text-sm text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Правый клик по пину на карте тоже удаляет. Здесь — полный список.</p>`);
						if (loadingPins.value) _push(`<div class="mt-5 flex items-center gap-2 text-sm text-stone-500" data-v-c3bdba16${_scopeId}><span class="w-4 h-4 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" data-v-c3bdba16${_scopeId}></span> Загружаем…</div>`);
						else if (myPins.value.length) {
							_push(`<div class="mt-5 grid sm:grid-cols-2 gap-3" data-v-c3bdba16${_scopeId}><!--[-->`);
							ssrRenderList(myPins.value, (p) => {
								_push(`<div class="border border-stone-200 rounded-2xl p-4 hover:bg-stone-50 transition relative" data-v-c3bdba16${_scopeId}><button class="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-xs" title="Удалить" data-v-c3bdba16${_scopeId}>✕</button><div class="text-sm font-bold pr-8 truncate" data-v-c3bdba16${_scopeId}>${ssrInterpolate(p.title)}</div><div class="text-xs text-stone-500 mt-1 line-clamp-2" data-v-c3bdba16${_scopeId}>${ssrInterpolate(p.body)}</div><div class="flex items-center gap-1.5 mt-3 text-[11px]" data-v-c3bdba16${_scopeId}><span class="bg-ink-900 text-white rounded-full px-2 py-0.5" data-v-c3bdba16${_scopeId}>${ssrInterpolate(p.category)}</span><span class="bg-stone-100 rounded-full px-2 py-0.5" data-v-c3bdba16${_scopeId}>${ssrInterpolate(new Date(p.expires_at).toLocaleDateString())} ${ssrInterpolate(new Date(p.expires_at).toLocaleTimeString().slice(0, 5))}</span></div></div>`);
							});
							_push(`<!--]--></div>`);
						} else {
							_push(`<div class="mt-6 text-center py-8 border border-dashed border-stone-200 rounded-2xl" data-v-c3bdba16${_scopeId}><div class="w-10 h-10 rounded-xl bg-stone-100 border mx-auto grid place-items-center" data-v-c3bdba16${_scopeId}>📍</div><div class="text-sm font-medium mt-2" data-v-c3bdba16${_scopeId}>Пока нет пинов</div><div class="text-xs text-stone-400" data-v-c3bdba16${_scopeId}>Создай первый на карте</div>`);
							_push(ssrRenderComponent(unref(Link), {
								href: "/map",
								class: "mt-3 inline-flex bg-ink-900 text-white px-5 py-2 rounded-full text-sm font-semibold"
							}, {
								default: withCtx((_, _push, _parent, _scopeId) => {
									if (_push) _push(`На карту →`);
									else return [createTextVNode("На карту →")];
								}),
								_: 1
							}, _parent, _scopeId));
							_push(`</div>`);
						}
						_push(`</div><div class="space-y-4" style="${ssrRenderStyle(active.value === "support" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight text-lg" data-v-c3bdba16${_scopeId}>Обратиться в поддержку</h3><p class="text-sm text-stone-500 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Опиши проблему — ответим в течение часа.</p><div class="mt-5 max-w-xl space-y-3" data-v-c3bdba16${_scopeId}><div data-v-c3bdba16${_scopeId}><label class="text-sm font-medium" data-v-c3bdba16${_scopeId}>Тема</label><input${ssrRenderAttr("value", supportSubject.value)} placeholder="Напр. Не грузится карта в Минске" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700" data-v-c3bdba16${_scopeId}></div><div data-v-c3bdba16${_scopeId}><label class="text-sm font-medium" data-v-c3bdba16${_scopeId}>Сообщение</label><textarea rows="6" placeholder="Опиши проблему подробно..." class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700 resize-y" data-v-c3bdba16${_scopeId}>${ssrInterpolate(supportBody.value)}</textarea></div><button class="w-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-3 font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100" data-v-c3bdba16${_scopeId}>✉️ Отправить обращение</button></div></div><div class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-[20px] p-6" data-v-c3bdba16${_scopeId}><h3 class="font-black tracking-tight" data-v-c3bdba16${_scopeId}>Задонатить разработчику ❤️</h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1" data-v-c3bdba16${_scopeId}>Поддержи Live Map — выбери сумму в долларах, покажем по курсу НБРБ (BYN).</p><div class="mt-4 flex items-center gap-2 text-xs" data-v-c3bdba16${_scopeId}><span class="bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-full px-3 py-1.5" data-v-c3bdba16${_scopeId}>Курс: `);
						if (usdRate.value) _push(`<b data-v-c3bdba16${_scopeId}>${ssrInterpolate(usdRate.value.toFixed(4))} BYN / \$</b>`);
						else if (rateLoading.value) _push(`<span class="inline-flex items-center gap-1" data-v-c3bdba16${_scopeId}><span class="w-3 h-3 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" data-v-c3bdba16${_scopeId}></span> загрузка…</span>`);
						else _push(`<span data-v-c3bdba16${_scopeId}>—</span>`);
						_push(`</span><button class="text-xs underline" data-v-c3bdba16${_scopeId}>обновить</button></div><div class="mt-4 grid grid-cols-3 gap-2" data-v-c3bdba16${_scopeId}><!--[-->`);
						ssrRenderList([
							2,
							5,
							10
						], (usd) => {
							_push(`<button class="${ssrRenderClass(["rounded-2xl border p-4 text-center transition", donateSel.value === usd ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white shadow-lg" : "bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"])}" data-v-c3bdba16${_scopeId}><div class="text-lg font-black" data-v-c3bdba16${_scopeId}>\$${ssrInterpolate(usd)}</div><div class="text-xs opacity-70" data-v-c3bdba16${_scopeId}>${ssrInterpolate(fmtByn(usd))}</div></button>`);
						});
						_push(`<!--]--></div><button class="mt-4 w-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-full py-3.5 font-black shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] transition" data-v-c3bdba16${_scopeId}>💛 Задонатить \$${ssrInterpolate(donateSel.value)} → ${ssrInterpolate(fmtByn(donateSel.value))}</button><p class="text-[11px] text-stone-500 dark:text-zinc-400 mt-2 text-center" data-v-c3bdba16${_scopeId}>Откроется почтовый клиент с письмом — укажи удобный способ перевода, банк пересчитает по курсу</p></div></div><div class="space-y-4" style="${ssrRenderStyle(active.value === "security" ? null : { display: "none" })}" data-v-c3bdba16${_scopeId}><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" data-v-c3bdba16${_scopeId}>`);
						_push(ssrRenderComponent(UpdatePasswordForm_default, { class: "max-w-xl" }, null, _parent, _scopeId));
						_push(`</div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" data-v-c3bdba16${_scopeId}>`);
						_push(ssrRenderComponent(DeleteUserForm_default, { class: "max-w-xl" }, null, _parent, _scopeId));
						_push(`</div></div></div></div></div>`);
						_push(ssrRenderComponent(AvatarPreview_default, {
							src: avatarSrc.value,
							name: u.value.name,
							open: showAvatar.value,
							onClose: ($event) => showAvatar.value = false
						}, null, _parent, _scopeId));
						_push(`</div>`);
					} else return [createVNode("div", { class: "bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]" }, [createVNode("div", { class: "max-w-[1280px] mx-auto px-4 sm:px-6 py-6" }, [createVNode("div", { class: "bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden" }, [
						createVNode("div", { class: "absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20" }),
						createVNode("div", { class: "relative flex items-center gap-4 min-w-0" }, [createVNode("button", {
							onClick: ($event) => showAvatar.value = true,
							class: "group relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40"
						}, [createVNode("img", {
							src: avatarSrc.value,
							class: "w-full h-full object-cover group-hover:scale-105 transition duration-300"
						}, null, 8, ["src"]), createVNode("span", { class: "absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs" }, "🔍")], 8, ["onClick"]), createVNode("div", { class: "min-w-0" }, [createVNode("h1", { class: "text-xl font-black tracking-tight truncate" }, [createTextVNode(toDisplayString(u.value.name) + " ", 1), createVNode("span", { class: "font-medium text-white/60 text-sm ml-2" }, toDisplayString(u.value.level || "novice") + " · " + toDisplayString(u.value.reputation_score || 0) + " ★", 1)]), createVNode("p", { class: "text-white/60 text-sm mt-0.5 truncate" }, [
							createTextVNode(toDisplayString(u.value.email) + " · ", 1),
							createVNode("span", { class: "capitalize" }, toDisplayString(u.value.plan || "free"), 1),
							createTextVNode(" · " + toDisplayString(u.value.home_lat ? `дом ${Number(u.value.home_lat).toFixed(3)}, ${Number(u.value.home_lng).toFixed(3)}` : "дом не задан"), 1)
						])])]),
						createVNode(unref(Link), {
							href: "/map",
							class: "relative bg-white text-ink-900 px-6 py-3 rounded-full font-bold h-fit hover:bg-stone-50 transition shrink-0 self-start sm:self-center"
						}, {
							default: withCtx(() => [createTextVNode("На карту →")]),
							_: 1
						})
					]), createVNode("div", { class: "mt-6 grid lg:grid-cols-[280px_1fr] gap-6 items-start" }, [createVNode("div", { class: "lg:sticky lg:top-[80px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-2 shadow-soft" }, [
						createVNode("div", { class: "hidden lg:block px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase" }, "Настройки"),
						createVNode("nav", { class: "flex lg:block gap-1.5 lg:space-y-1 overflow-x-auto scrollbar-none pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 snap-x" }, [(openBlock(), createBlock(Fragment, null, renderList(tabs, (t) => {
							return createVNode("button", {
								key: t.id,
								onClick: ($event) => active.value = t.id,
								class: ["shrink-0 lg:w-full text-left flex items-center gap-3 px-3 py-2.5 lg:py-3 rounded-xl transition snap-start", active.value === t.id ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-soft" : "hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 bg-stone-50 lg:bg-transparent dark:bg-zinc-800/50 lg:dark:bg-transparent border lg:border-0 border-stone-200 dark:border-zinc-700"]
							}, [
								createVNode("span", { class: ["w-8 h-8 lg:w-9 lg:h-9 rounded-xl grid place-items-center text-sm shrink-0", active.value === t.id ? "bg-white/15 dark:bg-ink-900/10" : "bg-white lg:bg-stone-100 dark:bg-zinc-700"] }, toDisplayString(t.icon), 3),
								createVNode("div", { class: "min-w-0 hidden sm:block lg:block" }, [createVNode("div", { class: "text-sm font-semibold leading-none whitespace-nowrap" }, toDisplayString(t.label), 1), createVNode("div", { class: "text-xs opacity-60 leading-none mt-1 hidden lg:block" }, toDisplayString(t.desc), 1)]),
								createVNode("span", { class: "text-xs font-semibold sm:hidden lg:hidden" }, toDisplayString(t.label), 1),
								active.value === t.id ? (openBlock(), createBlock("span", {
									key: 0,
									class: "ml-auto text-xs hidden lg:inline"
								}, "→")) : createCommentVNode("", true)
							], 10, ["onClick"]);
						}), 64))]),
						createVNode("div", { class: "mt-4 mx-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3" }, [
							createVNode("div", { class: "text-xs font-bold" }, "Подписка " + toDisplayString(u.value.plan || "free"), 1),
							createVNode("div", { class: "text-xs text-stone-600 dark:text-zinc-400 mt-1" }, toDisplayString(u.value.pins_today_count || 0) + "/" + toDisplayString(u.value.plan === "free" ? 3 : "∞") + " пинов сегодня", 1),
							createVNode(unref(Link), {
								href: "/profile",
								class: "text-xs font-semibold underline mt-2 inline-block"
							}, {
								default: withCtx(() => [createTextVNode("Управление →")]),
								_: 1
							})
						])
					]), createVNode("div", { class: "space-y-4 min-w-0" }, [
						withDirectives(createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" }, [
							createVNode("h3", { class: "font-black tracking-tight text-lg" }, "Профиль"),
							createVNode("p", { class: "text-sm text-stone-500 dark:text-zinc-400 mt-1" }, "Фото, имя и домашняя зона — на них строится весь Live Map."),
							createVNode(UpdateProfileInformationForm_default, {
								"must-verify-email": __props.mustVerifyEmail,
								status: __props.status,
								class: "mt-5 max-w-xl"
							}, null, 8, ["must-verify-email", "status"])
						], 512), [[vShow, active.value === "profile"]]),
						withDirectives(createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" }, [
							createVNode("h3", { class: "font-black tracking-tight text-lg" }, "Приватность"),
							createVNode("p", { class: "text-sm text-stone-500 dark:text-zinc-400 mt-1" }, "Ты — не точка, ты — пин. Управляй размытием и анонимностью."),
							createVNode("div", { class: "mt-5 space-y-4 max-w-xl" }, [createVNode("div", { class: "bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4" }, [createVNode("div", { class: "text-sm font-semibold" }, "Базовые принципы"), createVNode("ul", { class: "text-sm text-stone-600 dark:text-zinc-400 mt-2 space-y-1 list-disc pl-5" }, [
								createVNode("li", null, "Размытие 200м по умолчанию — координаты смещаются случайно"),
								createVNode("li", null, "Анонимный пин скрывает имя и репутацию"),
								createVNode("li", null, "Блокировка в 1 клик скрывает контент пользователя")
							])]), createVNode("div", { class: "border border-stone-200 dark:border-zinc-700 rounded-2xl p-4" }, [
								createVNode("div", { class: "text-sm font-semibold" }, "Режим анонимности по умолчанию"),
								createVNode("p", { class: "text-xs text-stone-500 dark:text-zinc-400 mt-1" }, "Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию». При создании пина можно переопределить."),
								createVNode("button", {
									onClick: ($event) => active.value = "profile",
									class: "mt-3 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full"
								}, "Перейти в Профиль →", 8, ["onClick"])
							])])
						], 512), [[vShow, active.value === "privacy"]]),
						withDirectives(createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" }, [
							createVNode("h3", { class: "font-black tracking-tight text-lg" }, "Внешний вид"),
							createVNode("p", { class: "text-sm text-stone-500 dark:text-zinc-400 mt-1" }, "Тема оформления и отображение карты."),
							createVNode("div", { class: "mt-6 space-y-5 max-w-xl" }, [createVNode("div", null, [
								createVNode("div", { class: "text-sm font-semibold" }, "Тема"),
								createVNode("div", { class: "text-xs text-stone-500 dark:text-zinc-400" }, "Выбери как выглядит Live Map на этом устройстве"),
								createVNode("div", { class: "mt-3 grid grid-cols-3 gap-2" }, [
									createVNode("button", {
										onClick: ($event) => unref(setTheme)("light"),
										class: ["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "light" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"]
									}, [createVNode("span", { class: "w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 grid place-items-center text-sm" }, "☀️"), createVNode("span", { class: "text-xs font-semibold" }, "Светлая")], 10, ["onClick"]),
									createVNode("button", {
										onClick: ($event) => unref(setTheme)("dark"),
										class: ["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "dark" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"]
									}, [createVNode("span", { class: "w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-items-center text-sm text-white" }, "🌙"), createVNode("span", { class: "text-xs font-semibold" }, "Тёмная")], 10, ["onClick"]),
									createVNode("button", {
										onClick: ($event) => unref(setTheme)("system"),
										class: ["rounded-2xl border p-3 flex flex-col items-center gap-2 transition", unref(theme) === "system" ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft" : "bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"]
									}, [createVNode("span", { class: "w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-zinc-800 grid place-items-center text-sm" }, "◐"), createVNode("span", { class: "text-xs font-semibold" }, "Система")], 10, ["onClick"])
								]),
								createVNode("div", { class: "text-[11px] text-stone-400 mt-2" }, "Система = следует настройкам OS")
							])])
						], 512), [[vShow, active.value === "appearance"]]),
						withDirectives(createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft" }, [
							createVNode("h3", { class: "font-black tracking-tight text-lg" }, "Мои пины"),
							createVNode("p", { class: "text-sm text-stone-500 dark:text-zinc-400 mt-1" }, "Правый клик по пину на карте тоже удаляет. Здесь — полный список."),
							loadingPins.value ? (openBlock(), createBlock("div", {
								key: 0,
								class: "mt-5 flex items-center gap-2 text-sm text-stone-500"
							}, [createVNode("span", { class: "w-4 h-4 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" }), createTextVNode(" Загружаем…")])) : myPins.value.length ? (openBlock(), createBlock("div", {
								key: 1,
								class: "mt-5 grid sm:grid-cols-2 gap-3"
							}, [(openBlock(true), createBlock(Fragment, null, renderList(myPins.value, (p) => {
								return openBlock(), createBlock("div", {
									key: p.id,
									class: "border border-stone-200 rounded-2xl p-4 hover:bg-stone-50 transition relative"
								}, [
									createVNode("button", {
										onClick: ($event) => deleteMyPin(p.id),
										class: "absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 grid place-items-center text-xs",
										title: "Удалить"
									}, "✕", 8, ["onClick"]),
									createVNode("div", { class: "text-sm font-bold pr-8 truncate" }, toDisplayString(p.title), 1),
									createVNode("div", { class: "text-xs text-stone-500 mt-1 line-clamp-2" }, toDisplayString(p.body), 1),
									createVNode("div", { class: "flex items-center gap-1.5 mt-3 text-[11px]" }, [createVNode("span", { class: "bg-ink-900 text-white rounded-full px-2 py-0.5" }, toDisplayString(p.category), 1), createVNode("span", { class: "bg-stone-100 rounded-full px-2 py-0.5" }, toDisplayString(new Date(p.expires_at).toLocaleDateString()) + " " + toDisplayString(new Date(p.expires_at).toLocaleTimeString().slice(0, 5)), 1)])
								]);
							}), 128))])) : (openBlock(), createBlock("div", {
								key: 2,
								class: "mt-6 text-center py-8 border border-dashed border-stone-200 rounded-2xl"
							}, [
								createVNode("div", { class: "w-10 h-10 rounded-xl bg-stone-100 border mx-auto grid place-items-center" }, "📍"),
								createVNode("div", { class: "text-sm font-medium mt-2" }, "Пока нет пинов"),
								createVNode("div", { class: "text-xs text-stone-400" }, "Создай первый на карте"),
								createVNode(unref(Link), {
									href: "/map",
									class: "mt-3 inline-flex bg-ink-900 text-white px-5 py-2 rounded-full text-sm font-semibold"
								}, {
									default: withCtx(() => [createTextVNode("На карту →")]),
									_: 1
								})
							]))
						], 512), [[vShow, active.value === "pins"]]),
						withDirectives(createVNode("div", { class: "space-y-4" }, [createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft" }, [
							createVNode("h3", { class: "font-black tracking-tight text-lg" }, "Обратиться в поддержку"),
							createVNode("p", { class: "text-sm text-stone-500 dark:text-zinc-400 mt-1" }, "Опиши проблему — ответим в течение часа."),
							createVNode("div", { class: "mt-5 max-w-xl space-y-3" }, [
								createVNode("div", null, [createVNode("label", { class: "text-sm font-medium" }, "Тема"), withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => supportSubject.value = $event,
									placeholder: "Напр. Не грузится карта в Минске",
									class: "mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700"
								}, null, 8, ["onUpdate:modelValue"]), [[vModelText, supportSubject.value]])]),
								createVNode("div", null, [createVNode("label", { class: "text-sm font-medium" }, "Сообщение"), withDirectives(createVNode("textarea", {
									ref_key: "supportBodyRef",
									ref: supportBodyRef,
									"onUpdate:modelValue": ($event) => supportBody.value = $event,
									rows: "6",
									placeholder: "Опиши проблему подробно...",
									class: "mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700 resize-y"
								}, null, 8, ["onUpdate:modelValue"]), [[vModelText, supportBody.value]])]),
								createVNode("button", {
									onClick: mailToSupport,
									class: "w-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-3 font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100"
								}, "✉️ Отправить обращение")
							])
						]), createVNode("div", { class: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-[20px] p-6" }, [
							createVNode("h3", { class: "font-black tracking-tight" }, "Задонатить разработчику ❤️"),
							createVNode("p", { class: "text-sm text-stone-600 dark:text-zinc-400 mt-1" }, "Поддержи Live Map — выбери сумму в долларах, покажем по курсу НБРБ (BYN)."),
							createVNode("div", { class: "mt-4 flex items-center gap-2 text-xs" }, [createVNode("span", { class: "bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-full px-3 py-1.5" }, [createTextVNode("Курс: "), usdRate.value ? (openBlock(), createBlock("b", { key: 0 }, toDisplayString(usdRate.value.toFixed(4)) + " BYN / $", 1)) : rateLoading.value ? (openBlock(), createBlock("span", {
								key: 1,
								class: "inline-flex items-center gap-1"
							}, [createVNode("span", { class: "w-3 h-3 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin" }), createTextVNode(" загрузка…")])) : (openBlock(), createBlock("span", { key: 2 }, "—"))]), createVNode("button", {
								onClick: loadRate,
								class: "text-xs underline"
							}, "обновить")]),
							createVNode("div", { class: "mt-4 grid grid-cols-3 gap-2" }, [(openBlock(), createBlock(Fragment, null, renderList([
								2,
								5,
								10
							], (usd) => {
								return createVNode("button", {
									key: usd,
									onClick: ($event) => donateSel.value = usd,
									class: ["rounded-2xl border p-4 text-center transition", donateSel.value === usd ? "bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white shadow-lg" : "bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-700 hover:bg-stone-50"]
								}, [createVNode("div", { class: "text-lg font-black" }, "$" + toDisplayString(usd), 1), createVNode("div", { class: "text-xs opacity-70" }, toDisplayString(fmtByn(usd)), 1)], 10, ["onClick"]);
							}), 64))]),
							createVNode("button", {
								onClick: ($event) => mailToDonate(donateSel.value),
								class: "mt-4 w-full bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-stone-900 rounded-full py-3.5 font-black shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.45)] transition"
							}, "💛 Задонатить $" + toDisplayString(donateSel.value) + " → " + toDisplayString(fmtByn(donateSel.value)), 9, ["onClick"]),
							createVNode("p", { class: "text-[11px] text-stone-500 dark:text-zinc-400 mt-2 text-center" }, "Откроется почтовый клиент с письмом — укажи удобный способ перевода, банк пересчитает по курсу")
						])], 512), [[vShow, active.value === "support"]]),
						withDirectives(createVNode("div", { class: "space-y-4" }, [createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" }, [createVNode(UpdatePasswordForm_default, { class: "max-w-xl" })]), createVNode("div", { class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover" }, [createVNode(DeleteUserForm_default, { class: "max-w-xl" })])], 512), [[vShow, active.value === "security"]])
					])])]), createVNode(AvatarPreview_default, {
						src: avatarSrc.value,
						name: u.value.name,
						open: showAvatar.value,
						onClose: ($event) => showAvatar.value = false
					}, null, 8, [
						"src",
						"name",
						"open",
						"onClose"
					])])];
				}),
				_: 1
			}, _parent));
			_push(`<!--]-->`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Profile/Edit.vue
var _sfc_setup = Edit_vue_vue_type_script_setup_true_lang_default.setup;
Edit_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Profile/Edit.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Edit_default = /*#__PURE__*/ _plugin_vue_export_helper_default(Edit_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-c3bdba16"]]);
//#endregion
export { Edit_default as default };
