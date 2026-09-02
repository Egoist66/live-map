import { createTextVNode, createVNode, defineComponent, mergeProps, unref, useSSRContext, withCtx } from "vue";
import { Link } from "@inertiajs/vue3";
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderSlot, ssrRenderStyle } from "vue/server-renderer";
//#region resources/js/Layouts/GuestLayout.vue?vue&type=script&setup=true&lang.ts
var GuestLayout_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "GuestLayout",
	__ssrInlineRender: true,
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen flex bg-surface dark:bg-[#0B0F1A]" }, _attrs))}><div class="hidden lg:flex w-[48%] bg-ink-900 text-white relative overflow-hidden"><div class="absolute inset-0"><div class="absolute inset-0 opacity-[0.04]" style="${ssrRenderStyle({
				"background-image": "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
				"background-size": "24px 24px"
			})}"></div><div class="absolute -top-24 -right-24 w-[640px] h-[640px] bg-gradient-to-br from-brand-500 via-violet-600 to-accent-teal rounded-full blur-[90px] opacity-25"></div><div class="absolute -bottom-32 -left-32 w-[560px] h-[560px] bg-gradient-to-tr from-amber-500 to-accent-coral rounded-full blur-[80px] opacity-15"></div></div><div class="relative p-10 xl:p-12 flex flex-col justify-between w-full max-w-[560px] ml-auto">`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/",
				class: "flex items-center gap-2.5"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<span class="w-9 h-9 rounded-xl bg-white text-ink-900 grid place-items-center font-black text-sm shadow-soft"${_scopeId}>◉</span><span class="font-black tracking-[-0.03em] text-xl"${_scopeId}>LIVE<span class="font-light opacity-80"${_scopeId}>MAP</span></span>`);
					else return [createVNode("span", { class: "w-9 h-9 rounded-xl bg-white text-ink-900 grid place-items-center font-black text-sm shadow-soft" }, "◉"), createVNode("span", { class: "font-black tracking-[-0.03em] text-xl" }, [createTextVNode("LIVE"), createVNode("span", { class: "font-light opacity-80" }, "MAP")])];
				}),
				_: 1
			}, _parent));
			_push(`<div><div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/15 rounded-full px-3 py-1.5 text-xs font-medium"><span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span> live • обновление 30 сек </div><h2 class="mt-6 text-[42px] font-black leading-[0.9] tracking-[-0.04em]">Твое окно<br><span class="bg-gradient-to-r from-white via-violet-200 to-teal-200 bg-clip-text text-transparent">во двор</span></h2><p class="text-white/60 mt-4 leading-relaxed">Строгая, спокойная карта без шума. Только то что происходит рядом — сейчас.</p><div class="mt-8 grid grid-cols-1 gap-3"><div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-4 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-white text-ink-900 grid place-items-center text-sm">🗺️</div><div><div class="text-sm font-semibold">847 пинов рядом</div><div class="text-xs text-white/50">Вопросы · События · Помощь — фильтр в 1 клик</div></div></div><div class="bg-white/[0.07] backdrop-blur border border-white/10 rounded-2xl p-4 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-amber-400 text-ink-900 grid place-items-center text-sm">◐</div><div><div class="text-sm font-semibold">Размытие 200 м по умолчанию</div><div class="text-xs text-white/50">Ты — не точка, ты — пин. Приватность сначала.</div></div></div></div></div><div class="flex items-center justify-between text-xs text-white/40"><span>© Live Map · Пилотный район</span><span>PWA скоро</span></div></div></div><div class="flex-1 flex flex-col items-center justify-center px-6 py-10 relative dark:bg-[#0B0F1A]"><div class="absolute inset-0 -z-10 bg-gradient-to-b from-white to-surface dark:from-zinc-900 dark:to-[#0B0F1A]"></div>`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/",
				class: "lg:hidden flex items-center gap-2.5 mb-6"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<span class="w-9 h-9 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center text-sm"${_scopeId}>◉</span><span class="font-black tracking-[-0.03em] text-xl text-ink-900 dark:text-white"${_scopeId}>LIVE<span class="font-light text-ink-600 dark:text-zinc-400"${_scopeId}>MAP</span></span>`);
					else return [createVNode("span", { class: "w-9 h-9 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center text-sm" }, "◉"), createVNode("span", { class: "font-black tracking-[-0.03em] text-xl text-ink-900 dark:text-white" }, [createTextVNode("LIVE"), createVNode("span", { class: "font-light text-ink-600 dark:text-zinc-400" }, "MAP")])];
				}),
				_: 1
			}, _parent));
			_push(`<div class="w-full max-w-[440px] bg-white dark:bg-zinc-900 border border-stone-200/70 dark:border-zinc-800 rounded-[24px] shadow-float p-6 sm:p-8">`);
			ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			_push(`</div><div class="text-xs text-stone-400 mt-4 text-center max-w-[360px]">Защищено приватностью по умолчанию · Размытие 200м · Блок в 1 клик</div></div></div>`);
		};
	}
});
//#endregion
//#region resources/js/Layouts/GuestLayout.vue
var _sfc_setup = GuestLayout_vue_vue_type_script_setup_true_lang_default.setup;
GuestLayout_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Layouts/GuestLayout.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var GuestLayout_default = GuestLayout_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { GuestLayout_default as t };
