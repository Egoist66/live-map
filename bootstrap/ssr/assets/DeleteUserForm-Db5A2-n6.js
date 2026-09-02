import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { computed, createTextVNode, createVNode, defineComponent, mergeProps, nextTick, onMounted, onUnmounted, ref, unref, useSSRContext, vModelText, watch, withCtx, withDirectives, withKeys } from "vue";
import { useForm } from "@inertiajs/vue3";
import { ssrRenderAttr, ssrRenderAttrs, ssrRenderClass, ssrRenderComponent, ssrRenderSlot, ssrRenderStyle } from "vue/server-renderer";
//#region resources/js/Components/DangerButton.vue
var _sfc_main$2 = {};
function _sfc_ssrRender$1(_ctx, _push, _parent, _attrs) {
	_push(`<button${ssrRenderAttrs(mergeProps({ class: "inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-soft transition" }, _attrs))}>`);
	ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
	_push(`</button>`);
}
var _sfc_setup$3 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/DangerButton.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var DangerButton_default = /*#__PURE__*/ _plugin_vue_export_helper_default(_sfc_main$2, [["ssrRender", _sfc_ssrRender$1]]);
//#endregion
//#region resources/js/Components/Modal.vue
var _sfc_main$1 = {
	__name: "Modal",
	__ssrInlineRender: true,
	props: {
		show: {
			type: Boolean,
			default: false
		},
		maxWidth: {
			type: String,
			default: "2xl"
		},
		closeable: {
			type: Boolean,
			default: true
		}
	},
	emits: ["close"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		const dialog = ref();
		const showSlot = ref(props.show);
		watch(() => props.show, () => {
			if (props.show) {
				document.body.style.overflow = "hidden";
				showSlot.value = true;
				dialog.value?.showModal();
			} else {
				document.body.style.overflow = "";
				setTimeout(() => {
					dialog.value?.close();
					showSlot.value = false;
				}, 200);
			}
		});
		const close = () => {
			if (props.closeable) emit("close");
		};
		const closeOnEscape = (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				if (props.show) close();
			}
		};
		onMounted(() => document.addEventListener("keydown", closeOnEscape));
		onUnmounted(() => {
			document.removeEventListener("keydown", closeOnEscape);
			document.body.style.overflow = "";
		});
		const maxWidthClass = computed(() => {
			return {
				sm: "sm:max-w-sm",
				md: "sm:max-w-md",
				lg: "sm:max-w-lg",
				xl: "sm:max-w-xl",
				"2xl": "sm:max-w-2xl"
			}[props.maxWidth];
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<dialog${ssrRenderAttrs(mergeProps({
				class: "z-50 m-0 min-h-full min-w-full overflow-y-auto bg-transparent backdrop:bg-transparent",
				ref_key: "dialog",
				ref: dialog
			}, _attrs))}><div class="fixed inset-0 z-50 overflow-y-auto px-4 py-6 sm:px-0" scroll-region><div class="fixed inset-0 transform transition-all" style="${ssrRenderStyle(__props.show ? null : { display: "none" })}"><div class="absolute inset-0 bg-gray-500 opacity-75"></div></div><div class="${ssrRenderClass([maxWidthClass.value, "mb-6 transform overflow-hidden rounded-lg bg-white shadow-xl transition-all sm:mx-auto sm:w-full"])}" style="${ssrRenderStyle(__props.show ? null : { display: "none" })}">`);
			if (showSlot.value) ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			else _push(`<!---->`);
			_push(`</div></div></dialog>`);
		};
	}
};
var _sfc_setup$2 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/Modal.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Components/SecondaryButton.vue
var _sfc_main = {};
function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
	_push(`<button${ssrRenderAttrs(mergeProps({ class: "inline-flex items-center justify-center rounded-full bg-white border border-stone-200 px-5 py-2.5 text-sm font-semibold text-ink-900 hover:bg-stone-50 hover:border-stone-300 transition" }, _attrs))}>`);
	ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
	_push(`</button>`);
}
var _sfc_setup$1 = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/SecondaryButton.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var SecondaryButton_default = /*#__PURE__*/ _plugin_vue_export_helper_default(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
//#endregion
//#region resources/js/Pages/Profile/Partials/DeleteUserForm.vue?vue&type=script&setup=true&lang.ts
var DeleteUserForm_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "DeleteUserForm",
	__ssrInlineRender: true,
	setup(__props) {
		const confirming = ref(false);
		const passwordInput = ref(null);
		const form = useForm({ password: "" });
		const confirm = () => {
			confirming.value = true;
			nextTick(() => passwordInput.value?.focus());
		};
		const del = () => form.delete(route("profile.destroy"), {
			preserveScroll: true,
			onSuccess: () => close(),
			onError: () => passwordInput.value?.focus(),
			onFinish: () => form.reset()
		});
		const close = () => {
			confirming.value = false;
			form.clearErrors();
			form.reset();
		};
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<section${ssrRenderAttrs(_attrs)}><header><h2 class="font-bold text-red-600">Удаление аккаунта</h2><p class="text-sm text-zinc-500 mt-1">Аккаунт и все пины/комменты будут удалены безвозвратно. Сохрани нужное заранее.</p></header>`);
			_push(ssrRenderComponent(DangerButton_default, {
				onClick: confirm,
				class: "!rounded-full mt-4"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Удалить аккаунт`);
					else return [createTextVNode("Удалить аккаунт")];
				}),
				_: 1
			}, _parent));
			_push(ssrRenderComponent(_sfc_main$1, {
				show: confirming.value,
				onClose: close
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="p-6"${_scopeId}><h2 class="font-bold"${_scopeId}>Точно удалить?</h2><p class="text-sm text-zinc-600 mt-1"${_scopeId}>Введи пароль для подтверждения.</p><div class="mt-4"${_scopeId}><input id="password"${ssrRenderAttr("value", unref(form).password)} type="password" placeholder="Пароль" class="w-3/4 border rounded-xl px-3 py-2.5 text-sm"${_scopeId}>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.password,
							class: "mt-1"
						}, null, _parent, _scopeId));
						_push(`</div><div class="mt-6 flex justify-end gap-2"${_scopeId}>`);
						_push(ssrRenderComponent(SecondaryButton_default, {
							onClick: close,
							class: "!rounded-full"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Отмена`);
								else return [createTextVNode("Отмена")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(ssrRenderComponent(DangerButton_default, {
							onClick: del,
							disabled: unref(form).processing,
							class: "!rounded-full"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Удалить`);
								else return [createTextVNode("Удалить")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></div>`);
					} else return [createVNode("div", { class: "p-6" }, [
						createVNode("h2", { class: "font-bold" }, "Точно удалить?"),
						createVNode("p", { class: "text-sm text-zinc-600 mt-1" }, "Введи пароль для подтверждения."),
						createVNode("div", { class: "mt-4" }, [withDirectives(createVNode("input", {
							id: "password",
							ref_key: "passwordInput",
							ref: passwordInput,
							"onUpdate:modelValue": ($event) => unref(form).password = $event,
							type: "password",
							placeholder: "Пароль",
							onKeyup: withKeys(del, ["enter"]),
							class: "w-3/4 border rounded-xl px-3 py-2.5 text-sm"
						}, null, 40, ["onUpdate:modelValue"]), [[vModelText, unref(form).password]]), createVNode(InputError_default, {
							message: unref(form).errors.password,
							class: "mt-1"
						}, null, 8, ["message"])]),
						createVNode("div", { class: "mt-6 flex justify-end gap-2" }, [createVNode(SecondaryButton_default, {
							onClick: close,
							class: "!rounded-full"
						}, {
							default: withCtx(() => [createTextVNode("Отмена")]),
							_: 1
						}), createVNode(DangerButton_default, {
							onClick: del,
							disabled: unref(form).processing,
							class: "!rounded-full"
						}, {
							default: withCtx(() => [createTextVNode("Удалить")]),
							_: 1
						}, 8, ["disabled"])])
					])];
				}),
				_: 1
			}, _parent));
			_push(`</section>`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Profile/Partials/DeleteUserForm.vue
var DeleteUserForm_exports = /* @__PURE__ */ __exportAll({ default: () => DeleteUserForm_default });
var _sfc_setup = DeleteUserForm_vue_vue_type_script_setup_true_lang_default.setup;
DeleteUserForm_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Profile/Partials/DeleteUserForm.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var DeleteUserForm_default = DeleteUserForm_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { DeleteUserForm_exports as n, DeleteUserForm_default as t };
