import { createTextVNode, createVNode, defineComponent, unref, useSSRContext, withCtx } from "vue";
import { Head, Link } from "@inertiajs/vue3";
import { ssrRenderComponent, ssrRenderStyle } from "vue/server-renderer";
//#region resources/js/Pages/Welcome.vue?vue&type=script&setup=true&lang.ts
var Welcome_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Welcome",
	__ssrInlineRender: true,
	props: {
		canLogin: { type: Boolean },
		canRegister: { type: Boolean }
	},
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<!--[-->`);
			_push(ssrRenderComponent(unref(Head), { title: "Твое окно во двор" }, null, _parent));
			_push(`<div class="min-h-screen bg-surface dark:bg-[#0B0F1A] text-ink-900 dark:text-zinc-100 antialiased selection:bg-ink-900 dark:selection:bg-brand-500 selection:text-white"><header class="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/70 backdrop-blur border-b border-stone-200/60 dark:border-zinc-800"><div class="max-w-[1280px] mx-auto px-6 h-[64px] flex items-center justify-between">`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/",
				class: "flex items-center gap-2.5"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<span class="w-9 h-9 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shadow-soft relative overflow-hidden"${_scopeId}><span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-teal opacity-90"${_scopeId}></span><span class="relative text-sm font-black"${_scopeId}>◉</span></span><span class="font-black tracking-[-0.03em] text-[19px]"${_scopeId}>LIVE<span class="font-light text-ink-600 dark:text-zinc-400"${_scopeId}>MAP</span></span><span class="hidden sm:inline ml-2 text-xs font-medium tracking-wide text-stone-500 dark:text-zinc-500 border-l border-stone-200 dark:border-zinc-700 pl-3"${_scopeId}>ТВОЕ ОКНО ВО ДВОР</span>`);
					else return [
						createVNode("span", { class: "w-9 h-9 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shadow-soft relative overflow-hidden" }, [createVNode("span", { class: "absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-teal opacity-90" }), createVNode("span", { class: "relative text-sm font-black" }, "◉")]),
						createVNode("span", { class: "font-black tracking-[-0.03em] text-[19px]" }, [createTextVNode("LIVE"), createVNode("span", { class: "font-light text-ink-600 dark:text-zinc-400" }, "MAP")]),
						createVNode("span", { class: "hidden sm:inline ml-2 text-xs font-medium tracking-wide text-stone-500 dark:text-zinc-500 border-l border-stone-200 dark:border-zinc-700 pl-3" }, "ТВОЕ ОКНО ВО ДВОР")
					];
				}),
				_: 1
			}, _parent));
			_push(`<nav class="flex items-center gap-2">`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/faq",
				class: "hidden sm:inline-flex text-[13px] font-medium text-stone-600 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`FAQ`);
					else return [createTextVNode("FAQ")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(unref(Link), {
				href: "/map",
				class: "hidden sm:inline-flex text-[13px] font-medium text-stone-600 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Карта`);
					else return [createTextVNode("Карта")];
				}),
				_: 1
			}, _parent));
			if (_ctx.$page.props.auth.user) _push(ssrRenderComponent(unref(Link), {
				href: _ctx.route("dashboard"),
				class: "inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100 shadow-soft transition"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Кабинет`);
					else return [createTextVNode("Кабинет")];
				}),
				_: 1
			}, _parent));
			else {
				_push(`<!--[-->`);
				if (__props.canLogin) _push(ssrRenderComponent(unref(Link), {
					href: _ctx.route("login"),
					class: "text-sm font-semibold px-4 py-2 rounded-full hover:bg-white dark:hover:bg-zinc-800 transition"
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Войти`);
						else return [createTextVNode("Войти")];
					}),
					_: 1
				}, _parent));
				else _push(`<!---->`);
				if (__props.canRegister) _push(ssrRenderComponent(unref(Link), {
					href: _ctx.route("register"),
					class: "bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100 shadow-soft transition"
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Начать бесплатно`);
						else return [createTextVNode("Начать бесплатно")];
					}),
					_: 1
				}, _parent));
				else _push(`<!---->`);
				_push(`<!--]-->`);
			}
			_push(`</nav></div></header><section class="max-w-[1280px] mx-auto px-6 pt-8 sm:pt-14 pb-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center"><div><div class="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-full pl-1.5 pr-3 py-1 shadow-soft"><span class="bg-emerald-500 text-white rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE</span><span class="text-xs font-medium text-stone-600 dark:text-zinc-400">847 пинов рядом · обновление 30 сек</span></div><h1 class="mt-6 text-[42px] sm:text-[64px] font-black tracking-[-0.05em] leading-[0.85] dark:text-white">Район <span class="bg-gradient-to-r from-brand-500 via-violet-500 to-accent-teal bg-clip-text text-transparent">живой</span>,<br>пока ты рядом.</h1><p class="mt-5 text-[17px] leading-relaxed text-stone-600 dark:text-zinc-400 max-w-[560px]">Строгая гиперлокальная сеть вокруг карты. Вопросы, события, помощь и объявления — всё в радиусе 1 км. Без ленты, без шума. Пины живут 2–24 часа.</p><div class="mt-7 flex flex-wrap gap-3">`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/map",
				class: "bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-ink-800 dark:hover:bg-zinc-100 shadow-soft hover:shadow-card transition inline-flex items-center gap-2"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Открыть карту <span class="w-6 h-6 rounded-full bg-white/15 dark:bg-ink-900/10 grid place-items-center text-xs"${_scopeId}>→</span>`);
					else return [createTextVNode("Открыть карту "), createVNode("span", { class: "w-6 h-6 rounded-full bg-white/15 dark:bg-ink-900/10 grid place-items-center text-xs" }, "→")];
				}),
				_: 1
			}, _parent));
			_push(`<a href="#how" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 px-7 py-3.5 rounded-full font-semibold hover:bg-stone-50 dark:hover:bg-zinc-800 transition">Как это работает</a></div><div class="mt-8 flex items-center gap-6 py-5 border-y border-stone-200/60 dark:border-zinc-800 max-w-[520px]"><div><div class="font-black text-[22px] tracking-tight">500+</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">активных рядом</div></div><div class="w-px h-10 bg-stone-200 dark:bg-zinc-800"></div><div><div class="font-black text-[22px] tracking-tight">~2 мин</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">создать пин</div></div><div class="w-px h-10 bg-stone-200 dark:bg-zinc-800"></div><div><div class="font-black text-[22px] tracking-tight">200 м</div><div class="text-xs font-medium text-stone-500 dark:text-zinc-500 uppercase tracking-wide">размытие по умолч.</div></div></div><div class="mt-4 flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-500"><span class="w-7 h-7 rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 grid place-items-center">✓</span> Приватность сначала · Анонимно по желанию · Блок в 1 клик </div></div><div class="relative"><div class="rounded-[28px] overflow-hidden bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-float p-3"><div class="aspect-[4/3.1] rounded-[18px] overflow-hidden relative bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700"><div class="absolute inset-0 bg-gradient-to-br from-stone-50 to-stone-200 dark:from-zinc-800 dark:to-zinc-900"></div><div class="absolute inset-0 opacity-[0.07] dark:opacity-[0.15]" style="${ssrRenderStyle({
				"background-image": "radial-gradient(circle at 1px 1px, #0F172A 1px, transparent 0)",
				"background-size": "20px 20px"
			})}"></div><div class="absolute inset-0 bg-gradient-to-t from-white/60 dark:from-zinc-900/60 via-transparent to-transparent"></div><div class="absolute top-4 left-4 right-4 flex justify-between"><span class="bg-white dark:bg-zinc-800 rounded-full px-3.5 py-2 text-xs font-semibold shadow-card border border-stone-200 dark:border-zinc-700 flex items-center gap-2"><span class="w-6 h-6 rounded-full bg-ink-900 text-white grid place-items-center text-[10px]">?</span> Где починить велик?</span><span class="bg-amber-400 rounded-full px-3 py-1.5 text-xs font-black shadow">★ ТОП</span></div><div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><div class="w-4 h-4 bg-brand-500 rounded-full border-[3px] border-white dark:border-zinc-900 shadow-lg"></div><div class="absolute inset-0 bg-brand-500 rounded-full animate-ping opacity-20"></div></div><div class="absolute bottom-4 left-4 right-4 flex gap-3"><div class="flex-1 bg-white dark:bg-zinc-800 rounded-2xl p-3.5 shadow-card border border-stone-200 dark:border-zinc-700"><div class="text-xs font-bold flex items-center gap-1.5"><span class="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 grid place-items-center text-white text-[11px]">◐</span> Настолки в кофейне</div><div class="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-snug">Нас трое, нужен четвёртый. Ленина 15, до 22:00</div><div class="mt-2.5 flex gap-1.5"><span class="text-[11px] bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-2.5 py-1 rounded-full font-medium">3 💬</span><span class="text-[11px] bg-white dark:bg-zinc-700 border border-stone-200 dark:border-zinc-600 px-2.5 py-1 rounded-full">5 ❤️</span><span class="text-[11px] text-stone-400 ml-auto">до 21:00</span></div></div><div class="hidden sm:flex w-[88px] bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-2xl p-3 flex-col justify-between shadow-card"><div class="text-[11px] font-bold leading-tight">+ Создать пин</div><div class="w-7 h-7 rounded-full bg-white dark:bg-ink-900 dark:text-white text-ink-900 grid place-items-center text-sm ml-auto">＋</div></div></div></div><div class="flex items-center justify-between px-1 pt-3"><div class="flex -space-x-2"><img src="https://i.pravatar.cc/100?img=11" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900"><img src="https://i.pravatar.cc/100?img=32" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900"><img src="https://i.pravatar.cc/100?img=14" class="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900"><span class="w-7 h-7 rounded-full bg-stone-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 grid place-items-center text-[10px] font-bold">+42</span></div><span class="text-xs font-medium text-stone-500 dark:text-zinc-500">сейчас в районе</span></div></div><div class="absolute -bottom-5 -left-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-float hidden sm:flex gap-3 items-center max-w-[320px]"><div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-teal grid place-items-center text-white">◉</div><div><div class="text-xs font-bold">Твоя приватность</div><div class="text-xs text-stone-500 dark:text-zinc-400 leading-snug">Ты — не точка на карте, ты — пин с размытием 200 м.</div></div></div></div></section><section id="how" class="max-w-[1280px] mx-auto px-6 py-6 grid md:grid-cols-3 gap-4"><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover group cursor-default"><div class="w-11 h-11 rounded-xl bg-ink-900 dark:bg-white dark:text-ink-900 text-white grid place-items-center font-bold text-sm card-icon">01</div><h3 class="mt-4 font-bold text-[15px]">Открой карту <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Пины в радиусе: вопросы, события, предупреждения. Фильтр по типу в 1 клик.</p></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover group cursor-default"><div class="w-11 h-11 rounded-xl bg-brand-500 text-white grid place-items-center font-bold text-sm card-icon">02</div><h3 class="mt-4 font-bold text-[15px]">Создай пин <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Выбери точность: 200 м, точно или район. Анонимно или с репутацией.</p></div><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover group cursor-default"><div class="w-11 h-11 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold text-sm card-icon">03</div><h3 class="mt-4 font-bold text-[15px]">Получай отклик <span class="card-arrow inline-block opacity-0 group-hover:opacity-100">→</span></h3><p class="text-sm text-stone-600 dark:text-zinc-400 mt-1.5 leading-relaxed">Комментарии, реакции, пуши подписчикам. Больше реакций — дольше жизнь.</p></div></section><section class="max-w-[1280px] mx-auto px-6 py-6 grid lg:grid-cols-5 gap-4"><div class="lg:col-span-3 bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-8 relative overflow-hidden"><div class="absolute -right-20 -top-20 w-80 h-80 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div><div class="absolute -right-10 -bottom-10 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.06]"></div><div class="relative"><div class="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-xs font-medium">🔒 Приватность по умолчанию</div><h3 class="mt-4 text-2xl font-black tracking-tight">Спокойная карта. Без слежки.</h3><p class="text-white/60 mt-2 max-w-xl leading-relaxed">Точное место никогда не показывается. По умолчанию смещение 200 м, сообщения — только взаимно, блок — в один клик.</p><div class="mt-5 flex flex-wrap gap-2 text-xs font-medium"><span class="bg-white text-ink-900 px-3.5 py-2 rounded-full">Размытие 200 м</span><span class="bg-white/10 border border-white/15 px-3.5 py-2 rounded-full">Анонимность</span><span class="bg-white/10 border border-white/15 px-3.5 py-2 rounded-full">Без истории перемещений</span></div></div></div><div class="lg:col-span-2 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[24px] p-7 shadow-soft card-hover"><h3 class="font-black tracking-tight">Монетизация для активных</h3><p class="text-xs text-stone-500 dark:text-zinc-500 mt-1">Честные бусты, без навязчивости</p><div class="mt-5 space-y-2.5 text-sm"><div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-white dark:hover:bg-zinc-700 transition"><span class="font-medium">Поднять в топ 1 ч</span><b class="bg-white dark:bg-zinc-700 border dark:border-zinc-600 px-2.5 py-1 rounded-full text-xs">\$0.99</b></div><div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-white dark:hover:bg-zinc-700 transition"><span class="font-medium">Подсветка на карте</span><b class="bg-white dark:bg-zinc-700 border dark:border-zinc-600 px-2.5 py-1 rounded-full text-xs">\$1.99</b></div><div class="flex justify-between items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-white dark:hover:bg-zinc-700 transition"><span class="font-medium">Уведомить 1 км • 1 ч</span><b class="bg-white dark:bg-zinc-700 border dark:border-zinc-600 px-2.5 py-1 rounded-full text-xs">\$4.99</b></div></div><div class="mt-4 text-xs text-stone-500 dark:text-zinc-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2.5">Pro \$4.99/мес — безлимит, 5 км, 24 ч. Business \$19.99 — витрина.</div></div></section><section class="max-w-[1280px] mx-auto px-6 py-8"><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-soft card-hover"><div><div class="text-[20px] font-black tracking-tight">Готов почувствовать пульс района?</div><div class="text-sm text-stone-600 dark:text-zinc-400 mt-1">Создай первый пин за 2 минуты. Живут 2 часа — не пропусти.</div></div>`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/map",
				class: "bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-8 py-3.5 rounded-full font-semibold whitespace-nowrap hover:bg-ink-800 dark:hover:bg-zinc-100 shadow-soft transition"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Открыть карту — бесплатно`);
					else return [createTextVNode("Открыть карту — бесплатно")];
				}),
				_: 1
			}, _parent));
			_push(`</div><div class="text-center text-xs text-stone-400 mt-6 tracking-wide">© Live Map · `);
			_push(ssrRenderComponent(unref(Link), {
				href: "/faq",
				class: "underline hover:text-ink-900 dark:hover:text-white"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`FAQ`);
					else return [createTextVNode("FAQ")];
				}),
				_: 1
			}, _parent));
			_push(` · Пилотный район · PWA скоро · API для города</div></section></div><!--]-->`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Welcome.vue
var _sfc_setup = Welcome_vue_vue_type_script_setup_true_lang_default.setup;
Welcome_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Welcome.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Welcome_default = Welcome_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { Welcome_default as default };
