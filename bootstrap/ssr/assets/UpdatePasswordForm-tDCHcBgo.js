import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { t as PrimaryButton_default } from "./PrimaryButton-BqgYZ7WE.js";
import { computed, createTextVNode, defineComponent, ref, unref, useSSRContext, withCtx } from "vue";
import { useForm } from "@inertiajs/vue3";
import { ssrInterpolate, ssrRenderAttr, ssrRenderAttrs, ssrRenderClass, ssrRenderComponent, ssrRenderDynamicModel } from "vue/server-renderer";
//#region resources/js/Pages/Profile/Partials/UpdatePasswordForm.vue?vue&type=script&setup=true&lang.ts
var UpdatePasswordForm_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "UpdatePasswordForm",
	__ssrInlineRender: true,
	setup(__props) {
		ref(null);
		ref(null);
		const show1 = ref(false);
		const show2 = ref(false);
		const show3 = ref(false);
		const form = useForm({
			current_password: "",
			password: "",
			password_confirmation: ""
		});
		const canSubmit = computed(() => form.current_password.trim().length > 0 && form.password.trim().length >= 8 && form.password_confirmation.trim().length > 0);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<section${ssrRenderAttrs(_attrs)}><header><h2 class="font-bold dark:text-white">Смена пароля</h2><p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Минимум 8 символов. Используй сочетание букв, цифр и символов.</p></header><form novalidate class="mt-6 space-y-4"><div><label class="text-sm font-medium">Текущий пароль <span class="text-red-500">*</span></label><div class="relative mt-1"><input id="current_password"${ssrRenderDynamicModel(show1.value ? "text" : "password", unref(form).current_password, null)}${ssrRenderAttr("type", show1.value ? "text" : "password")} required minlength="1" autocomplete="current-password" placeholder="••••••••" class="${ssrRenderClass(["w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition", unref(form).errors.current_password ? "border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50" : "focus:border-ink-900 focus:ring-ink-900/10"])}"><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">${ssrInterpolate(show1.value ? "🙈" : "👁")}</button></div>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.current_password,
				class: "mt-1"
			}, null, _parent));
			_push(`</div><div><label class="text-sm font-medium">Новый пароль <span class="text-red-500">*</span></label><div class="relative mt-1"><input id="password"${ssrRenderDynamicModel(show2.value ? "text" : "password", unref(form).password, null)}${ssrRenderAttr("type", show2.value ? "text" : "password")} required minlength="8" autocomplete="new-password" placeholder="Не менее 8 символов" class="${ssrRenderClass(["w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition", unref(form).errors.password ? "border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50" : "focus:border-ink-900 focus:ring-ink-900/10"])}"><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">${ssrInterpolate(show2.value ? "🙈" : "👁")}</button></div>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.password,
				class: "mt-1"
			}, null, _parent));
			if (!unref(form).errors.password) _push(`<p class="text-[11px] text-zinc-400 mt-1">Минимум 8 символов, лучше с цифрами и символами</p>`);
			else _push(`<!---->`);
			_push(`</div><div><label class="text-sm font-medium">Подтверди пароль <span class="text-red-500">*</span></label><div class="relative mt-1"><input id="password_confirmation"${ssrRenderDynamicModel(show3.value ? "text" : "password", unref(form).password_confirmation, null)}${ssrRenderAttr("type", show3.value ? "text" : "password")} required autocomplete="new-password" placeholder="Повтори пароль" class="${ssrRenderClass(["w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition", unref(form).errors.password_confirmation ? "border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50" : "focus:border-ink-900 focus:ring-ink-900/10"])}"><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">${ssrInterpolate(show3.value ? "🙈" : "👁")}</button></div>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.password_confirmation,
				class: "mt-1"
			}, null, _parent));
			_push(`</div><div class="flex items-center gap-3 pt-1">`);
			_push(ssrRenderComponent(PrimaryButton_default, {
				disabled: unref(form).processing || !canSubmit.value,
				class: ["!bg-black dark:!bg-white dark:!text-ink-900 !rounded-full disabled:opacity-40", !canSubmit.value ? "opacity-40 cursor-not-allowed" : ""]
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Сохранить пароль`);
					else return [createTextVNode("Сохранить пароль")];
				}),
				_: 1
			}, _parent));
			if (unref(form).recentlySuccessful) _push(`<span class="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-full px-3 py-1">✓ Сохранено</span>`);
			else _push(`<!---->`);
			_push(`</div></form></section>`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Profile/Partials/UpdatePasswordForm.vue
var UpdatePasswordForm_exports = /* @__PURE__ */ __exportAll({ default: () => UpdatePasswordForm_default });
var _sfc_setup = UpdatePasswordForm_vue_vue_type_script_setup_true_lang_default.setup;
UpdatePasswordForm_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Profile/Partials/UpdatePasswordForm.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var UpdatePasswordForm_default = UpdatePasswordForm_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { UpdatePasswordForm_exports as n, UpdatePasswordForm_default as t };
