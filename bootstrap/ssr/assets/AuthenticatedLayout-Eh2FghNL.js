import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { computed, createBlock, createTextVNode, createVNode, mergeProps, onMounted, onUnmounted, openBlock, ref, renderSlot, toDisplayString, unref, useSSRContext, withCtx } from "vue";
import { Link, usePage } from "@inertiajs/vue3";
import { ssrInterpolate, ssrRenderAttr, ssrRenderAttrs, ssrRenderClass, ssrRenderComponent, ssrRenderSlot, ssrRenderStyle } from "vue/server-renderer";
//#region resources/js/Components/ApplicationLogo.vue
var _sfc_main$5 = {};
function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
	_push(`<div${ssrRenderAttrs(mergeProps({ class: "flex items-center gap-2.5" }, _attrs))}><span class="w-9 h-9 rounded-xl bg-ink-900 text-white grid place-items-center shadow-soft relative overflow-hidden"><span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-teal opacity-90"></span><span class="relative text-[13px] font-black tracking-tighter">◉</span></span><span class="font-black tracking-[-0.03em] text-[19px] text-ink-900">LIVE<span class="font-light text-ink-600">MAP</span></span></div>`);
}
var _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/ApplicationLogo.vue");
	return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
var ApplicationLogo_default = /*#__PURE__*/ _plugin_vue_export_helper_default(_sfc_main$5, [["ssrRender", _sfc_ssrRender]]);
//#endregion
//#region resources/js/Components/Dropdown.vue
var _sfc_main$4 = {
	__name: "Dropdown",
	__ssrInlineRender: true,
	props: {
		align: {
			type: String,
			default: "right"
		},
		width: {
			type: String,
			default: "48"
		},
		contentClasses: {
			type: String,
			default: "py-1 bg-white dark:bg-zinc-900"
		}
	},
	setup(__props) {
		const props = __props;
		const closeOnEscape = (e) => {
			if (open.value && e.key === "Escape") open.value = false;
		};
		onMounted(() => document.addEventListener("keydown", closeOnEscape));
		onUnmounted(() => document.removeEventListener("keydown", closeOnEscape));
		const widthClass = computed(() => {
			return { 48: "w-48" }[props.width.toString()];
		});
		const alignmentClasses = computed(() => {
			if (props.align === "left") return "ltr:origin-top-left rtl:origin-top-right start-0";
			else if (props.align === "right") return "ltr:origin-top-right rtl:origin-top-left end-0";
			else return "origin-top";
		});
		const open = ref(false);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "relative" }, _attrs))}><div>`);
			ssrRenderSlot(_ctx.$slots, "trigger", {}, null, _push, _parent);
			_push(`</div><div class="fixed inset-0 z-40" style="${ssrRenderStyle(open.value ? null : { display: "none" })}"></div><div class="${ssrRenderClass([[widthClass.value, alignmentClasses.value], "absolute z-50 mt-2 rounded-md shadow-lg"])}" style="${ssrRenderStyle([{ "display": "none" }, open.value ? null : { display: "none" }])}"><div class="${ssrRenderClass([__props.contentClasses, "rounded-md ring-1 ring-black ring-opacity-5 dark:ring-white/10"])}">`);
			ssrRenderSlot(_ctx.$slots, "content", {}, null, _push, _parent);
			_push(`</div></div></div>`);
		};
	}
};
var _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/Dropdown.vue");
	return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Components/DropdownLink.vue
var _sfc_main$3 = {
	__name: "DropdownLink",
	__ssrInlineRender: true,
	props: { href: {
		type: String,
		required: true
	} },
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(Link), mergeProps({
				href: __props.href,
				class: "block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 dark:text-zinc-200 transition duration-150 ease-in-out hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-800 dark:hover:text-white focus:bg-gray-100 dark:focus:bg-zinc-800 focus:outline-none"
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId);
					else return [renderSlot(_ctx.$slots, "default")];
				}),
				_: 3
			}, _parent));
		};
	}
};
var _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/DropdownLink.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Components/NavLink.vue
var _sfc_main$2 = {
	__name: "NavLink",
	__ssrInlineRender: true,
	props: {
		href: {
			type: String,
			required: true
		},
		active: Boolean
	},
	setup(__props) {
		const props = __props;
		const classes = computed(() => props.active ? "inline-flex items-center px-1 pt-1 border-b-2 border-ink-900 text-sm font-semibold text-ink-900" : "inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-stone-500 hover:text-ink-900 hover:border-stone-300");
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(Link), mergeProps({
				href: __props.href,
				class: classes.value
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId);
					else return [renderSlot(_ctx.$slots, "default")];
				}),
				_: 3
			}, _parent));
		};
	}
};
var _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/NavLink.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Components/ResponsiveNavLink.vue
var _sfc_main$1 = {
	__name: "ResponsiveNavLink",
	__ssrInlineRender: true,
	props: {
		href: {
			type: String,
			required: true
		},
		active: { type: Boolean }
	},
	setup(__props) {
		const props = __props;
		const classes = computed(() => props.active ? "block w-full ps-3 pe-4 py-2 border-l-4 border-brand-500 text-start text-base font-medium text-ink-900 dark:text-white bg-stone-50 dark:bg-zinc-800 focus:outline-none transition duration-150 ease-in-out" : "block w-full ps-3 pe-4 py-2 border-l-4 border-transparent text-start text-base font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 focus:outline-none transition duration-150 ease-in-out");
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(Link), mergeProps({
				href: __props.href,
				class: classes.value
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent, _scopeId);
					else return [renderSlot(_ctx.$slots, "default")];
				}),
				_: 3
			}, _parent));
		};
	}
};
var _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/ResponsiveNavLink.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Layouts/AuthenticatedLayout.vue
var _sfc_main = {
	__name: "AuthenticatedLayout",
	__ssrInlineRender: true,
	setup(__props) {
		const showingNavigationDropdown = ref(false);
		const page = usePage();
		const avatarSrc = computed(() => {
			const u = page.props.auth.user;
			return u?.avatar_path ? `/storage/${u.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.name || "U")}&background=0F172A&color=fff&bold=true`;
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "min-h-screen bg-surface dark:bg-[#0B0F1A]" }, _attrs))}><nav class="sticky top-0 z-40 glass border-b border-stone-200/70 dark:border-zinc-800"><div class="mx-auto max-w-[1280px] px-4 sm:px-6"><div class="flex h-[64px] justify-between items-center"><div class="flex items-center gap-8">`);
			_push(ssrRenderComponent(unref(Link), {
				href: _ctx.route("dashboard"),
				class: "shrink-0"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(ssrRenderComponent(ApplicationLogo_default, null, null, _parent, _scopeId));
					else return [createVNode(ApplicationLogo_default)];
				}),
				_: 1
			}, _parent));
			_push(`<div class="hidden lg:flex items-center gap-1 bg-stone-100/80 dark:bg-zinc-800 p-1 rounded-full border border-stone-200/60 dark:border-zinc-700">`);
			_push(ssrRenderComponent(_sfc_main$2, {
				href: _ctx.route("dashboard"),
				active: _ctx.route().current("dashboard"),
				class: ["!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold", _ctx.route().current("dashboard") ? "!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200" : "!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900"]
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Кабинет`);
					else return [createTextVNode("Кабинет")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$2, {
				href: _ctx.route("map"),
				active: _ctx.route().current("map"),
				class: ["!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold", _ctx.route().current("map") ? "!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200" : "!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900"]
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Карта`);
					else return [createTextVNode("Карта")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$2, {
				href: _ctx.route("faq"),
				active: _ctx.route().current("faq"),
				class: ["!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold", _ctx.route().current("faq") ? "!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200" : "!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900"]
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`FAQ`);
					else return [createTextVNode("FAQ")];
				}),
				_: 1
			}, _parent));
			_push(`</div></div><div class="flex items-center gap-2">`);
			_push(ssrRenderComponent(unref(Link), {
				href: "/map",
				class: "hidden sm:inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-ink-800 transition"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`+ Создать пин`);
					else return [createTextVNode("+ Создать пин")];
				}),
				_: 1
			}, _parent));
			_push(`<div class="hidden sm:flex items-center">`);
			_push(ssrRenderComponent(_sfc_main$4, {
				align: "right",
				width: "48"
			}, {
				trigger: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<button class="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:shadow-card transition"${_scopeId}><img${ssrRenderAttr("src", avatarSrc.value)} class="w-7 h-7 rounded-full object-cover border dark:border-zinc-600"${_scopeId}><span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate"${_scopeId}>${ssrInterpolate(_ctx.$page.props.auth.user.name)}</span><span class="w-6 h-6 rounded-full bg-stone-100 dark:bg-zinc-700 grid place-items-center text-stone-500"${_scopeId}><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"${_scopeId}><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"${_scopeId}></path></svg></span></button>`);
					else return [createVNode("button", { class: "flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:shadow-card transition" }, [
						createVNode("img", {
							src: avatarSrc.value,
							class: "w-7 h-7 rounded-full object-cover border dark:border-zinc-600"
						}, null, 8, ["src"]),
						createVNode("span", { class: "text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate" }, toDisplayString(_ctx.$page.props.auth.user.name), 1),
						createVNode("span", { class: "w-6 h-6 rounded-full bg-stone-100 dark:bg-zinc-700 grid place-items-center text-stone-500" }, [(openBlock(), createBlock("svg", {
							class: "w-3.5 h-3.5",
							fill: "currentColor",
							viewBox: "0 0 20 20"
						}, [createVNode("path", {
							"fill-rule": "evenodd",
							d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z",
							"clip-rule": "evenodd"
						})]))])
					])];
				}),
				content: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="py-2 dark:bg-zinc-900"${_scopeId}><div class="px-4 pb-3 mb-2 border-b border-stone-100 dark:border-zinc-800 flex gap-3"${_scopeId}><img${ssrRenderAttr("src", avatarSrc.value)} class="w-9 h-9 rounded-full object-cover"${_scopeId}><div class="min-w-0"${_scopeId}><div class="text-sm font-semibold truncate dark:text-white"${_scopeId}>${ssrInterpolate(_ctx.$page.props.auth.user.name)}</div><div class="text-xs text-stone-500 truncate"${_scopeId}>${ssrInterpolate(_ctx.$page.props.auth.user.email)}</div></div></div>`);
						_push(ssrRenderComponent(_sfc_main$3, {
							href: _ctx.route("map"),
							class: "!text-sm"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Карта`);
								else return [createTextVNode("Карта")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(ssrRenderComponent(_sfc_main$3, {
							href: _ctx.route("profile.edit"),
							class: "!text-sm"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Настройки профиля`);
								else return [createTextVNode("Настройки профиля")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(ssrRenderComponent(_sfc_main$3, {
							href: _ctx.route("logout"),
							method: "post",
							as: "button",
							class: "!text-sm"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Выйти`);
								else return [createTextVNode("Выйти")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div>`);
					} else return [createVNode("div", { class: "py-2 dark:bg-zinc-900" }, [
						createVNode("div", { class: "px-4 pb-3 mb-2 border-b border-stone-100 dark:border-zinc-800 flex gap-3" }, [createVNode("img", {
							src: avatarSrc.value,
							class: "w-9 h-9 rounded-full object-cover"
						}, null, 8, ["src"]), createVNode("div", { class: "min-w-0" }, [createVNode("div", { class: "text-sm font-semibold truncate dark:text-white" }, toDisplayString(_ctx.$page.props.auth.user.name), 1), createVNode("div", { class: "text-xs text-stone-500 truncate" }, toDisplayString(_ctx.$page.props.auth.user.email), 1)])]),
						createVNode(_sfc_main$3, {
							href: _ctx.route("map"),
							class: "!text-sm"
						}, {
							default: withCtx(() => [createTextVNode("Карта")]),
							_: 1
						}, 8, ["href"]),
						createVNode(_sfc_main$3, {
							href: _ctx.route("profile.edit"),
							class: "!text-sm"
						}, {
							default: withCtx(() => [createTextVNode("Настройки профиля")]),
							_: 1
						}, 8, ["href"]),
						createVNode(_sfc_main$3, {
							href: _ctx.route("logout"),
							method: "post",
							as: "button",
							class: "!text-sm"
						}, {
							default: withCtx(() => [createTextVNode("Выйти")]),
							_: 1
						}, 8, ["href"])
					])];
				}),
				_: 1
			}, _parent));
			_push(`</div><button class="lg:hidden w-10 h-10 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft"><svg class="h-5 w-5 text-ink-900 dark:text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path class="${ssrRenderClass({
				hidden: showingNavigationDropdown.value,
				"inline-flex": !showingNavigationDropdown.value
			})}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path><path class="${ssrRenderClass({
				hidden: !showingNavigationDropdown.value,
				"inline-flex": showingNavigationDropdown.value
			})}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div></div></div><div class="${ssrRenderClass([{
				block: showingNavigationDropdown.value,
				hidden: !showingNavigationDropdown.value
			}, "lg:hidden border-t border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur"])}"><div class="px-4 py-3 space-y-1">`);
			_push(ssrRenderComponent(_sfc_main$1, {
				href: _ctx.route("dashboard"),
				active: _ctx.route().current("dashboard")
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Кабинет`);
					else return [createTextVNode("Кабинет")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$1, {
				href: _ctx.route("map"),
				active: _ctx.route().current("map")
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Карта`);
					else return [createTextVNode("Карта")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$1, {
				href: _ctx.route("faq"),
				active: _ctx.route().current("faq")
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`FAQ`);
					else return [createTextVNode("FAQ")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(unref(Link), {
				href: "/map",
				class: "mt-2 flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-4 py-2.5 text-sm font-semibold justify-center"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`+ Создать пин`);
					else return [createTextVNode("+ Создать пин")];
				}),
				_: 1
			}, _parent));
			_push(`</div><div class="border-t border-stone-200 dark:border-zinc-800 px-4 py-4"><div class="flex items-center gap-3"><img${ssrRenderAttr("src", avatarSrc.value)} class="w-9 h-9 rounded-full object-cover"><div><div class="text-sm font-semibold dark:text-white">${ssrInterpolate(_ctx.$page.props.auth.user.name)}</div><div class="text-xs text-stone-500">${ssrInterpolate(_ctx.$page.props.auth.user.email)}</div></div></div><div class="mt-3 grid grid-cols-2 gap-2">`);
			_push(ssrRenderComponent(_sfc_main$1, {
				href: _ctx.route("profile.edit"),
				class: "!border !rounded-xl !px-3"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Профиль`);
					else return [createTextVNode("Профиль")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$1, {
				href: _ctx.route("logout"),
				method: "post",
				as: "button",
				class: "!border !rounded-xl !px-3"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Выйти`);
					else return [createTextVNode("Выйти")];
				}),
				_: 1
			}, _parent));
			_push(`</div></div></div></nav>`);
			if (_ctx.$slots.header) {
				_push(`<header class="bg-white dark:bg-zinc-900 border-b border-stone-200/60 dark:border-zinc-800"><div class="mx-auto max-w-[1280px] px-4 sm:px-6 py-6">`);
				ssrRenderSlot(_ctx.$slots, "header", {}, null, _push, _parent);
				_push(`</div></header>`);
			} else _push(`<!---->`);
			_push(`<main>`);
			ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			_push(`</main></div>`);
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Layouts/AuthenticatedLayout.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
export { _sfc_main as t };
