import { mergeProps, onMounted, ref, useModel, useSSRContext } from "vue";
import { ssrGetDynamicModelProps, ssrInterpolate, ssrRenderAttrs, ssrRenderSlot } from "vue/server-renderer";
//#region resources/js/Components/InputLabel.vue
var _sfc_main$1 = {
	__name: "InputLabel",
	__ssrInlineRender: true,
	props: { value: String },
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<label${ssrRenderAttrs(mergeProps({ class: "block text-[13px] font-semibold tracking-tight text-ink-900" }, _attrs))}>`);
			if (__props.value) _push(`<span>${ssrInterpolate(__props.value)}</span>`);
			else {
				_push(`<span>`);
				ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
				_push(`</span>`);
			}
			_push(`</label>`);
		};
	}
};
var _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/InputLabel.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
//#endregion
//#region resources/js/Components/TextInput.vue
var _sfc_main = {
	__name: "TextInput",
	__ssrInlineRender: true,
	props: {
		"modelValue": {
			type: String,
			required: true
		},
		"modelModifiers": {}
	},
	emits: ["update:modelValue"],
	setup(__props, { expose: __expose }) {
		const model = useModel(__props, "modelValue");
		const input = ref(null);
		onMounted(() => {
			if (input.value?.hasAttribute("autofocus")) input.value.focus();
		});
		__expose({ focus: () => input.value.focus() });
		return (_ctx, _push, _parent, _attrs) => {
			let _temp0;
			_push(`<input${ssrRenderAttrs((_temp0 = mergeProps({
				class: "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm placeholder:text-stone-400 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition",
				ref_key: "input",
				ref: input
			}, _attrs), mergeProps(_temp0, ssrGetDynamicModelProps(_temp0, model.value))))}>`);
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/TextInput.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
export { _sfc_main$1 as n, _sfc_main as t };
