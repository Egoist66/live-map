import { t as GuestLayout_default } from "./GuestLayout-DWTvQJeS.js";
import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { t as _sfc_main } from "./AuthenticatedLayout-Eh2FghNL.js";
import { Fragment, Transition, computed, createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, openBlock, ref, renderList, resolveDynamicComponent, toDisplayString, unref, useSSRContext, withCtx } from "vue";
import { Head, Link, usePage } from "@inertiajs/vue3";
import { ssrInterpolate, ssrRenderClass, ssrRenderComponent, ssrRenderList, ssrRenderVNode } from "vue/server-renderer";
//#region resources/js/Pages/Faq.vue?vue&type=script&setup=true&lang.ts
var Faq_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Faq",
	__ssrInlineRender: true,
	setup(__props) {
		const page = usePage();
		const isAuth = computed(() => !!page.props.auth?.user);
		const Layout = computed(() => isAuth.value ? _sfc_main : GuestLayout_default);
		const open = ref("what");
		function toggle(id) {
			open.value = open.value === id ? null : id;
		}
		const sections = [
			{
				id: "what",
				title: "Что такое Live Map?",
				icon: "◉",
				q: "Зачем нужен Live Map?",
				a: `Live Map — гиперлокальная карта двора. Видишь только то, что происходит рядом (1–5 км): вопросы, события, объявления, помощь, предупреждения. Никакой ленты на весь город. Пины живут 2–24 часа — как stories, но на карте. Идея: ты — не точка на карте, ты — пин.`
			},
			{
				id: "pins",
				title: "Пины — основа",
				icon: "📍",
				q: "Что такое пин и какие бывают?",
				a: `Пин — короткое сообщение с точкой на карте: заголовок (до 100), описание (до 1000), категория, точка. Типы: 💬 Вопрос, 📍 Объявление, ⚠️ Предупреждение, 🎉 Событие, 📦 Отдам, 🤝 Помощь. Цвет маркера зависит от типа: warning → оранжевый, event → зелёный, help → синий, boosted → жёлтый пульс, sponsored → фиолетовый.`
			},
			{
				id: "ttl",
				title: "Жизнь пина",
				icon: "⏳",
				q: "Сколько живёт пин?",
				a: `Free: 2 часа, Pro/Business: 24 часа, Admin: 168ч. После expires_at пин скрывается (scopeActive: where expires_at > now()). Продлить можно бустом “+24ч $2.99”. Больше реакций — выше в выдаче (boostedFirst: is_boosted → is_pinned → created_at). Cron PruneExpiredPins чистит просрочку.`
			},
			{
				id: "radius",
				title: "Радиус видимости",
				icon: "◎",
				q: "Кто видит мой пин?",
				a: `Free видит в 1 км, Pro/Business/Admin — 5 км / 50 км. При создании radius_meters = pinRadius(), visibility_radius_km = radius/1000. На бэке Pin::nearby считает Haversine: 6371*acos(...). На фронте fetchNearby?lat&lng и фильтр selectedCategory. Домашний радиус home_radius_km (по умолчанию 2) — для пушей.`
			},
			{
				id: "privacy",
				title: "Приватность",
				icon: "🔒",
				q: "Как скрыть точное место?",
				a: `3 режима: blur_200 (по умолчанию) — точка смещается на 200 м полярным методом blurCoords (r*sqrt(u), 2πv), реальная точка хранится в real_lat/lng и не отдаётся в toPublicArray; exact — точно; district — район текстом. Анонимный пин (is_anonymous) скрывает user в выдаче, но user_id всё равно сохранён. Блок user_blocks в 1 клик.`
			},
			{
				id: "anon",
				title: "Анонимность",
				icon: "◐",
				q: "Что даёт анонимность?",
				a: `Автор скрыт (user: null для других), репутация не начисляется, нельзя построить историю перемещений. Переключатель is_anonymous_default в профиле и чекбокс при создании.`
			},
			{
				id: "levels",
				title: "Уровни и репутация",
				icon: "★",
				q: "Как растёт репутация?",
				a: `Поля users.reputation_score, level enum(novice,local,guide). Начисляется за пины, реакции, комментарии (логика в контроллерах). Отображается как ★ рядом с именем и цветом: novice gray, local emerald, guide amber. Влияет на доверие.`
			},
			{
				id: "plans",
				title: "Планы и деньги",
				icon: "💳",
				q: "Чем отличаются Free/Pro/Business?",
				a: `Free 0: 3 пина/день, 1км, 2ч, без бустов. Pro $4.99/мес: безлимит, 5км, 24ч, бусты включены. Business $19.99: + витрина businesses, is_sponsored пины. Полоса plan_expires_at, stripe_id, subscriptions таблица (Cashier). Админ — business до 2036, bypass лимитов.`
			},
			{
				id: "boosts",
				title: "Бусты",
				icon: "🚀",
				q: "Что такое бусты?",
				a: `Разовые платежи через PinBoost: top $0.99 (поднять в топ 1ч, is_boosted), glow $1.99 (подсветка), notify $4.99 (разослать 1км), extend $2.99 (+24ч к expires_at). Создаётся запись boosts с price, duration, starts/ends_at. Админ видит все.`
			},
			{
				id: "comments",
				title: "Комментарии и реакции",
				icon: "💬",
				q: "Как общаться?",
				a: `Комментарии PinComment с parent_id (ветки), is_anonymous, soft delete. Reactions morph (pin/comment) type like/fire/useful/laugh… Уникальный индекс user+reactable+type. Счётчики denormalized: reactions_count, comments_count, views_count.`
			},
			{
				id: "zones",
				title: "Зоны и уведомления",
				icon: "🔔",
				q: "Что такое подписка на зону?",
				a: `ZoneSubscription: центр lat/lng, radius_km, types json, notify_via push/email/in_app. Создаётся на /dashboard или картой. При новом пине — рассылка подписчикам зоны (queue database, позже Pusher).`
			},
			{
				id: "moderation",
				title: "Модерация",
				icon: "⚠",
				q: "Жалобы и блокировка?",
				a: `Report: reporter_id, target_type pin/comment/user, reason spam/abuse/inappropriate/illegal/fake, status pending/resolved, moderator_id. AdminMiddleware + Gate::before admin => true, canModerate(). Блоки user_blocks (blocker/blocked).`
			},
			{
				id: "map",
				title: "Карта",
				icon: "🗺",
				q: "Как устроена карта?",
				a: `MapLibre GL, стили OSM raster → positron → demotiles с фолбеком, Navigation/Geolocate/Scale. useMap: initMap(center, onClick), renderPins (цвет по категории), tempMarker (чёрная точка), moveend debounce 550ms + dist 0.0005 → fetchNearby, polling 30с, watch selectedCategory. useGeolocation → navigator.geolocation.`
			},
			{
				id: "auth",
				title: "Аккаунт",
				icon: "👤",
				q: "Авторизация и аватар?",
				a: `Breeze + Sanctum session database, Inertia, аватар store avatars/public (2МБ), symlink public/storage, avatar_path в User Fillable, предпросмотр FileReader, AvatarPreview modal по клику. Валидация на русском (lang/ru).`
			},
			{
				id: "theme",
				title: "Тема",
				icon: "◑",
				q: "Тёмная тема?",
				a: `useTheme с light/dark/system, localStorage, prefers-color-scheme, html.dark class, Tailwind darkMode class, app.css глобальные оверрайды bg-white→zinc-900. Настройка в Профиль → Внешний вид.`
			}
		];
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<!--[-->`);
			_push(ssrRenderComponent(unref(Head), { title: "FAQ" }, null, _parent));
			ssrRenderVNode(_push, createVNode(resolveDynamicComponent(Layout.value), null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="min-h-[calc(100vh-64px)] bg-surface dark:bg-[#090E1A]" data-v-5682a053${_scopeId}><div class="max-w-[900px] mx-auto px-4 sm:px-6 py-8" data-v-5682a053${_scopeId}><div class="text-center" data-v-5682a053${_scopeId}><div class="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-3 py-1 text-xs font-semibold shadow-soft" data-v-5682a053${_scopeId}><span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" data-v-5682a053${_scopeId}></span> FAQ · база знаний</div><h1 class="mt-4 text-[32px] sm:text-[42px] font-black tracking-[-0.04em] leading-none dark:text-white" data-v-5682a053${_scopeId}>Как устроен <span class="bg-gradient-to-r from-brand-500 to-accent-teal bg-clip-text text-transparent" data-v-5682a053${_scopeId}>Live Map</span></h1><p class="mt-3 text-stone-600 dark:text-zinc-400 max-w-[640px] mx-auto" data-v-5682a053${_scopeId}>Подробно: зачем пин, как живёт, радиус, приватность, планы, бусты, репутация, зоны, модерация, карта. Если не нашёл ответа — напиши пин “Вопрос” на карте.</p><div class="mt-5 flex flex-wrap justify-center gap-2" data-v-5682a053${_scopeId}>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Открыть карту`);
								else return [createTextVNode("Открыть карту")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`<a href="#faq" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-6 py-2.5 rounded-full text-sm font-semibold" data-v-5682a053${_scopeId}>Читать ниже</a></div></div><div id="faq" class="mt-8 grid gap-3" data-v-5682a053${_scopeId}><!--[-->`);
						ssrRenderList(sections, (s) => {
							_push(`<div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] shadow-soft overflow-hidden card-hover" data-v-5682a053${_scopeId}><button class="w-full flex items-center gap-4 p-5 text-left" data-v-5682a053${_scopeId}><span class="w-10 h-10 rounded-xl bg-ink-900 dark:bg-zinc-800 text-white dark:text-white grid place-items-center text-sm card-icon shrink-0" data-v-5682a053${_scopeId}>${ssrInterpolate(s.icon)}</span><div class="min-w-0 flex-1" data-v-5682a053${_scopeId}><div class="text-xs font-bold tracking-widest uppercase text-stone-400" data-v-5682a053${_scopeId}>${ssrInterpolate(s.title)}</div><div class="text-[15px] font-bold leading-tight dark:text-white" data-v-5682a053${_scopeId}>${ssrInterpolate(s.q)}</div></div><span class="${ssrRenderClass(["w-8 h-8 rounded-full border grid place-items-center shrink-0 transition", open.value === s.id ? "bg-ink-900 text-white border-ink-900 rotate-180" : "bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700"])}" data-v-5682a053${_scopeId}>⌄</span></button>`);
							if (open.value === s.id) _push(`<div class="px-5 pb-5" data-v-5682a053${_scopeId}><div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap" data-v-5682a053${_scopeId}>${ssrInterpolate(s.a)}</div></div>`);
							else _push(`<!---->`);
							_push(`</div>`);
						});
						_push(`<!--]--></div><div class="mt-6 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4" data-v-5682a053${_scopeId}><div data-v-5682a053${_scopeId}><div class="font-black" data-v-5682a053${_scopeId}>Остались вопросы?</div><div class="text-sm text-white/60" data-v-5682a053${_scopeId}>Создай пин “Вопрос” — соседи ответят за минуты.</div></div>`);
						_push(ssrRenderComponent(unref(Link), {
							href: "/map",
							class: "bg-white text-ink-900 px-6 py-2.5 rounded-full font-bold"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Создать вопрос`);
								else return [createTextVNode("Создать вопрос")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div><div class="text-center text-xs text-stone-400 mt-6" data-v-5682a053${_scopeId}>Обновлено 2026-09-01 · Версия MVP · `);
						_push(ssrRenderComponent(unref(Link), {
							href: "/",
							class: "underline"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`На главную`);
								else return [createTextVNode("На главную")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></div></div>`);
					} else return [createVNode("div", { class: "min-h-[calc(100vh-64px)] bg-surface dark:bg-[#090E1A]" }, [createVNode("div", { class: "max-w-[900px] mx-auto px-4 sm:px-6 py-8" }, [
						createVNode("div", { class: "text-center" }, [
							createVNode("div", { class: "inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-full px-3 py-1 text-xs font-semibold shadow-soft" }, [createVNode("span", { class: "w-2 h-2 bg-emerald-500 rounded-full animate-pulse" }), createTextVNode(" FAQ · база знаний")]),
							createVNode("h1", { class: "mt-4 text-[32px] sm:text-[42px] font-black tracking-[-0.04em] leading-none dark:text-white" }, [createTextVNode("Как устроен "), createVNode("span", { class: "bg-gradient-to-r from-brand-500 to-accent-teal bg-clip-text text-transparent" }, "Live Map")]),
							createVNode("p", { class: "mt-3 text-stone-600 dark:text-zinc-400 max-w-[640px] mx-auto" }, "Подробно: зачем пин, как живёт, радиус, приватность, планы, бусты, репутация, зоны, модерация, карта. Если не нашёл ответа — напиши пин “Вопрос” на карте."),
							createVNode("div", { class: "mt-5 flex flex-wrap justify-center gap-2" }, [createVNode(unref(Link), {
								href: "/map",
								class: "bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold"
							}, {
								default: withCtx(() => [createTextVNode("Открыть карту")]),
								_: 1
							}), createVNode("a", {
								href: "#faq",
								class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-6 py-2.5 rounded-full text-sm font-semibold"
							}, "Читать ниже")])
						]),
						createVNode("div", {
							id: "faq",
							class: "mt-8 grid gap-3"
						}, [(openBlock(), createBlock(Fragment, null, renderList(sections, (s) => {
							return createVNode("div", {
								key: s.id,
								class: "bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] shadow-soft overflow-hidden card-hover"
							}, [createVNode("button", {
								onClick: ($event) => toggle(s.id),
								class: "w-full flex items-center gap-4 p-5 text-left"
							}, [
								createVNode("span", { class: "w-10 h-10 rounded-xl bg-ink-900 dark:bg-zinc-800 text-white dark:text-white grid place-items-center text-sm card-icon shrink-0" }, toDisplayString(s.icon), 1),
								createVNode("div", { class: "min-w-0 flex-1" }, [createVNode("div", { class: "text-xs font-bold tracking-widest uppercase text-stone-400" }, toDisplayString(s.title), 1), createVNode("div", { class: "text-[15px] font-bold leading-tight dark:text-white" }, toDisplayString(s.q), 1)]),
								createVNode("span", { class: ["w-8 h-8 rounded-full border grid place-items-center shrink-0 transition", open.value === s.id ? "bg-ink-900 text-white border-ink-900 rotate-180" : "bg-stone-50 dark:bg-zinc-800 border-stone-200 dark:border-zinc-700"] }, "⌄", 2)
							], 8, ["onClick"]), createVNode(Transition, { name: "faq" }, {
								default: withCtx(() => [open.value === s.id ? (openBlock(), createBlock("div", {
									key: 0,
									class: "px-5 pb-5"
								}, [createVNode("div", { class: "bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap" }, toDisplayString(s.a), 1)])) : createCommentVNode("", true)]),
								_: 2
							}, 1024)]);
						}), 64))]),
						createVNode("div", { class: "mt-6 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4" }, [createVNode("div", null, [createVNode("div", { class: "font-black" }, "Остались вопросы?"), createVNode("div", { class: "text-sm text-white/60" }, "Создай пин “Вопрос” — соседи ответят за минуты.")]), createVNode(unref(Link), {
							href: "/map",
							class: "bg-white text-ink-900 px-6 py-2.5 rounded-full font-bold"
						}, {
							default: withCtx(() => [createTextVNode("Создать вопрос")]),
							_: 1
						})]),
						createVNode("div", { class: "text-center text-xs text-stone-400 mt-6" }, [createTextVNode("Обновлено 2026-09-01 · Версия MVP · "), createVNode(unref(Link), {
							href: "/",
							class: "underline"
						}, {
							default: withCtx(() => [createTextVNode("На главную")]),
							_: 1
						})])
					])])];
				}),
				_: 1
			}), _parent);
			_push(`<!--]-->`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Faq.vue
var _sfc_setup = Faq_vue_vue_type_script_setup_true_lang_default.setup;
Faq_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Faq.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Faq_default = /*#__PURE__*/ _plugin_vue_export_helper_default(Faq_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-5682a053"]]);
//#endregion
export { Faq_default as default };
