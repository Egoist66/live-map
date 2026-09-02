import { t as GuestLayout_default } from "./GuestLayout-DWTvQJeS.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { n as _sfc_main$1, t as _sfc_main$2 } from "./TextInput-DStgKlOS.js";
import { t as PrimaryButton_default } from "./PrimaryButton-BqgYZ7WE.js";
import { createTextVNode, createVNode, unref, useSSRContext, withCtx, withModifiers } from "vue";
import { Head, useForm } from "@inertiajs/vue3";
import { ssrRenderComponent } from "vue/server-renderer";
//#region resources/js/Pages/Auth/ConfirmPassword.vue
var _sfc_main = {
	__name: "ConfirmPassword",
	__ssrInlineRender: true,
	setup(__props) {
		const form = useForm({ password: "" });
		const submit = () => {
			form.post(route("password.confirm"), { onFinish: () => form.reset() });
		};
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(GuestLayout_default, _attrs, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(ssrRenderComponent(unref(Head), { title: "Подтвердите пароль" }, null, _parent, _scopeId));
						_push(`<div class="mb-4 text-sm text-gray-600"${_scopeId}> This is a secure area of the application. Please confirm your password before continuing. </div><form${_scopeId}><div${_scopeId}>`);
						_push(ssrRenderComponent(_sfc_main$1, {
							for: "password",
							value: "Password"
						}, null, _parent, _scopeId));
						_push(ssrRenderComponent(_sfc_main$2, {
							id: "password",
							type: "password",
							class: "mt-1 block w-full",
							modelValue: unref(form).password,
							"onUpdate:modelValue": ($event) => unref(form).password = $event,
							required: "",
							autocomplete: "current-password",
							autofocus: ""
						}, null, _parent, _scopeId));
						_push(ssrRenderComponent(InputError_default, {
							class: "mt-2",
							message: unref(form).errors.password
						}, null, _parent, _scopeId));
						_push(`</div><div class="mt-4 flex justify-end"${_scopeId}>`);
						_push(ssrRenderComponent(PrimaryButton_default, {
							class: ["ms-4", { "opacity-25": unref(form).processing }],
							disabled: unref(form).processing
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(` Confirm `);
								else return [createTextVNode(" Confirm ")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div></form>`);
					} else return [
						createVNode(unref(Head), { title: "Подтвердите пароль" }),
						createVNode("div", { class: "mb-4 text-sm text-gray-600" }, " This is a secure area of the application. Please confirm your password before continuing. "),
						createVNode("form", { onSubmit: withModifiers(submit, ["prevent"]) }, [createVNode("div", null, [
							createVNode(_sfc_main$1, {
								for: "password",
								value: "Password"
							}),
							createVNode(_sfc_main$2, {
								id: "password",
								type: "password",
								class: "mt-1 block w-full",
								modelValue: unref(form).password,
								"onUpdate:modelValue": ($event) => unref(form).password = $event,
								required: "",
								autocomplete: "current-password",
								autofocus: ""
							}, null, 8, ["modelValue", "onUpdate:modelValue"]),
							createVNode(InputError_default, {
								class: "mt-2",
								message: unref(form).errors.password
							}, null, 8, ["message"])
						]), createVNode("div", { class: "mt-4 flex justify-end" }, [createVNode(PrimaryButton_default, {
							class: ["ms-4", { "opacity-25": unref(form).processing }],
							disabled: unref(form).processing
						}, {
							default: withCtx(() => [createTextVNode(" Confirm ")]),
							_: 1
						}, 8, ["class", "disabled"])])], 32)
					];
				}),
				_: 1
			}, _parent));
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Auth/ConfirmPassword.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
export { _sfc_main as default };
