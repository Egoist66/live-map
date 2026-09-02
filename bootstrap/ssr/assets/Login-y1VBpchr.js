import { t as GuestLayout_default } from "./GuestLayout-DWTvQJeS.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, openBlock, ref, toDisplayString, unref, useSSRContext, vModelCheckbox, vModelDynamic, vModelText, withCtx, withDirectives, withModifiers } from "vue";
import { Head, Link, useForm } from "@inertiajs/vue3";
import { ssrIncludeBooleanAttr, ssrInterpolate, ssrLooseContain, ssrRenderAttr, ssrRenderComponent, ssrRenderDynamicModel } from "vue/server-renderer";
//#region resources/js/Pages/Auth/Login.vue?vue&type=script&setup=true&lang.ts
var Login_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Login",
	__ssrInlineRender: true,
	props: {
		canResetPassword: { type: Boolean },
		status: {}
	},
	setup(__props) {
		const form = useForm({
			email: "",
			password: "",
			remember: false
		});
		const showPass = ref(false);
		const submit = () => form.post(route("login"), { onFinish: () => form.reset("password") });
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(GuestLayout_default, _attrs, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(ssrRenderComponent(unref(Head), { title: "Вход" }, null, _parent, _scopeId));
						if (__props.status) _push(`<div class="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3"${_scopeId}>${ssrInterpolate(__props.status)}</div>`);
						else _push(`<!---->`);
						_push(`<h1 class="text-[22px] font-black tracking-tight"${_scopeId}>С возвращением</h1><p class="text-sm text-stone-500 mt-1"${_scopeId}>Войди и проверь, что происходит во дворе</p><form class="mt-6 space-y-4"${_scopeId}><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Email</label><input${ssrRenderAttr("value", unref(form).email)} type="email" required autofocus autocomplete="username" placeholder="you@mail.ru" class="mt-1.5 input-premium"${_scopeId}>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.email,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Пароль</label><div class="relative mt-1.5"${_scopeId}><input${ssrRenderDynamicModel(showPass.value ? "text" : "password", unref(form).password, null)}${ssrRenderAttr("type", showPass.value ? "text" : "password")} required autocomplete="current-password" placeholder="••••••••" class="input-premium !mt-0 pr-11"${_scopeId}><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500"${ssrRenderAttr("title", showPass.value ? "Скрыть" : "Показать")}${_scopeId}><span class="text-[13px]"${_scopeId}>${ssrInterpolate(showPass.value ? "🙈" : "👁")}</span></button></div>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.password,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><label class="flex items-center gap-2 text-sm font-medium"${_scopeId}><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(form).remember) ? ssrLooseContain(unref(form).remember, null) : unref(form).remember) ? " checked" : ""} class="rounded border-stone-300 text-ink-900 focus:ring-ink-900"${_scopeId}> Запомнить меня</label><button${ssrIncludeBooleanAttr(unref(form).processing) ? " disabled" : ""} class="w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2"${_scopeId}>Войти <span${_scopeId}>→</span></button><div class="flex justify-between items-center text-sm pt-2"${_scopeId}>`);
						if (__props.canResetPassword) _push(ssrRenderComponent(unref(Link), {
							href: _ctx.route("password.request"),
							class: "text-stone-500 hover:text-ink-900 font-medium"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Забыли пароль?`);
								else return [createTextVNode("Забыли пароль?")];
							}),
							_: 1
						}, _parent, _scopeId));
						else _push(`<!---->`);
						_push(ssrRenderComponent(unref(Link), {
							href: _ctx.route("register"),
							class: "font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Регистрация →`);
								else return [createTextVNode("Регистрация →")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></form>`);
					} else return [
						createVNode(unref(Head), { title: "Вход" }),
						__props.status ? (openBlock(), createBlock("div", {
							key: 0,
							class: "mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3"
						}, toDisplayString(__props.status), 1)) : createCommentVNode("", true),
						createVNode("h1", { class: "text-[22px] font-black tracking-tight" }, "С возвращением"),
						createVNode("p", { class: "text-sm text-stone-500 mt-1" }, "Войди и проверь, что происходит во дворе"),
						createVNode("form", {
							onSubmit: withModifiers(submit, ["prevent"]),
							class: "mt-6 space-y-4"
						}, [
							createVNode("div", null, [
								createVNode("label", { class: "text-[13px] font-semibold" }, "Email"),
								withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => unref(form).email = $event,
									type: "email",
									required: "",
									autofocus: "",
									autocomplete: "username",
									placeholder: "you@mail.ru",
									class: "mt-1.5 input-premium"
								}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(form).email]]),
								createVNode(InputError_default, {
									message: unref(form).errors.email,
									class: "mt-1.5"
								}, null, 8, ["message"])
							]),
							createVNode("div", null, [
								createVNode("label", { class: "text-[13px] font-semibold" }, "Пароль"),
								createVNode("div", { class: "relative mt-1.5" }, [withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => unref(form).password = $event,
									type: showPass.value ? "text" : "password",
									required: "",
									autocomplete: "current-password",
									placeholder: "••••••••",
									class: "input-premium !mt-0 pr-11"
								}, null, 8, ["onUpdate:modelValue", "type"]), [[vModelDynamic, unref(form).password]]), createVNode("button", {
									type: "button",
									onClick: ($event) => showPass.value = !showPass.value,
									class: "absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500",
									title: showPass.value ? "Скрыть" : "Показать"
								}, [createVNode("span", { class: "text-[13px]" }, toDisplayString(showPass.value ? "🙈" : "👁"), 1)], 8, ["onClick", "title"])]),
								createVNode(InputError_default, {
									message: unref(form).errors.password,
									class: "mt-1.5"
								}, null, 8, ["message"])
							]),
							createVNode("label", { class: "flex items-center gap-2 text-sm font-medium" }, [withDirectives(createVNode("input", {
								type: "checkbox",
								"onUpdate:modelValue": ($event) => unref(form).remember = $event,
								class: "rounded border-stone-300 text-ink-900 focus:ring-ink-900"
							}, null, 8, ["onUpdate:modelValue"]), [[vModelCheckbox, unref(form).remember]]), createTextVNode(" Запомнить меня")]),
							createVNode("button", {
								disabled: unref(form).processing,
								class: "w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
							}, [createTextVNode("Войти "), createVNode("span", null, "→")], 8, ["disabled"]),
							createVNode("div", { class: "flex justify-between items-center text-sm pt-2" }, [__props.canResetPassword ? (openBlock(), createBlock(unref(Link), {
								key: 0,
								href: _ctx.route("password.request"),
								class: "text-stone-500 hover:text-ink-900 font-medium"
							}, {
								default: withCtx(() => [createTextVNode("Забыли пароль?")]),
								_: 1
							}, 8, ["href"])) : createCommentVNode("", true), createVNode(unref(Link), {
								href: _ctx.route("register"),
								class: "font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition"
							}, {
								default: withCtx(() => [createTextVNode("Регистрация →")]),
								_: 1
							}, 8, ["href"])])
						], 32)
					];
				}),
				_: 1
			}, _parent));
		};
	}
});
//#endregion
//#region resources/js/Pages/Auth/Login.vue
var _sfc_setup = Login_vue_vue_type_script_setup_true_lang_default.setup;
Login_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Auth/Login.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Login_default = Login_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { Login_default as default };
