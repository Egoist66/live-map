import { defineComponent, mergeProps, useSSRContext } from "vue";
import { ssrInterpolate, ssrRenderAttrs } from "vue/server-renderer";
//#region resources/js/Components/InputError.vue?vue&type=script&setup=true&lang.ts
var InputError_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "InputError",
	__ssrInlineRender: true,
	props: { message: {} },
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			if (__props.message) _push(`<p${ssrRenderAttrs(mergeProps({ class: "mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-3 py-2" }, _attrs))}><span class="shrink-0 w-4 h-4 rounded-full bg-red-600 text-white grid place-items-center text-[10px] leading-none mt-0.5">!</span><span>${ssrInterpolate(__props.message)}</span></p>`);
			else _push(`<!---->`);
		};
	}
});
//#endregion
//#region resources/js/Components/InputError.vue
var _sfc_setup = InputError_vue_vue_type_script_setup_true_lang_default.setup;
InputError_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/InputError.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var InputError_default = InputError_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { InputError_default as t };
