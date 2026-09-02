import { t as GuestLayout_default } from "./GuestLayout-DWTvQJeS.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { Fragment, createBlock, createCommentVNode, createTextVNode, createVNode, defineComponent, openBlock, ref, renderList, toDisplayString, unref, useSSRContext, vModelDynamic, vModelText, withCtx, withDirectives, withModifiers } from "vue";
import { Head, Link, useForm } from "@inertiajs/vue3";
import { ssrIncludeBooleanAttr, ssrInterpolate, ssrRenderAttr, ssrRenderClass, ssrRenderComponent, ssrRenderDynamicModel, ssrRenderList } from "vue/server-renderer";
//#region resources/js/Pages/Auth/Register.vue?vue&type=script&setup=true&lang.ts
var Register_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Register",
	__ssrInlineRender: true,
	setup(__props) {
		const form = useForm({
			name: "",
			email: "",
			password: "",
			password_confirmation: "",
			home_lat: null,
			home_lng: null,
			home_radius_km: 2,
			home_address: ""
		});
		const showPass = ref(false);
		const showPass2 = ref(false);
		const locating = ref(false);
		const addrLoading = ref(false);
		async function detectLocation() {
			locating.value = true;
			try {
				const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {
					enableHighAccuracy: false,
					timeout: 6e3
				}));
				form.home_lat = Number(pos.coords.latitude.toFixed(7));
				form.home_lng = Number(pos.coords.longitude.toFixed(7));
				addrLoading.value = true;
				try {
					const d = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${form.home_lat}&lon=${form.home_lng}&zoom=14&accept-language=ru`)).json();
					const a = d.address || {};
					const city = a.city || a.town || a.village || "";
					const road = a.road || a.suburb || "";
					form.home_address = [road, city].filter(Boolean).join(" · ") || d.display_name?.split(",").slice(0, 2).join(", ") || `${form.home_lat}, ${form.home_lng}`;
				} catch {
					form.home_address = `${form.home_lat}, ${form.home_lng}`;
				} finally {
					addrLoading.value = false;
				}
			} catch {
				alert("Не удалось определить местоположение");
			} finally {
				locating.value = false;
			}
		}
		const submit = () => form.post(route("register"), { onFinish: () => form.reset("password", "password_confirmation") });
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(GuestLayout_default, _attrs, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(ssrRenderComponent(unref(Head), { title: "Регистрация" }, null, _parent, _scopeId));
						_push(`<h1 class="text-[22px] font-black tracking-tight"${_scopeId}>Создай аккаунт</h1><p class="text-sm text-stone-500 mt-1"${_scopeId}>Выбери район, радиус и стань частью живой карты</p><form class="mt-6 space-y-4"${_scopeId}><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Имя / ник</label><input${ssrRenderAttr("value", unref(form).name)} type="text" required autofocus autocomplete="name" placeholder="Роберт Дауни" class="mt-1.5 input-premium"${_scopeId}>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.name,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Email</label><input${ssrRenderAttr("value", unref(form).email)} type="email" required autocomplete="username" placeholder="you@mail.ru" class="mt-1.5 input-premium"${_scopeId}>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.email,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Пароль</label><div class="relative mt-1.5"${_scopeId}><input${ssrRenderDynamicModel(showPass.value ? "text" : "password", unref(form).password, null)}${ssrRenderAttr("type", showPass.value ? "text" : "password")} required autocomplete="new-password" placeholder="••••••••" class="input-premium !mt-0 pr-11"${_scopeId}><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500"${ssrRenderAttr("title", showPass.value ? "Скрыть" : "Показать")}${_scopeId}><span class="text-[13px]"${_scopeId}>${ssrInterpolate(showPass.value ? "🙈" : "👁")}</span></button></div>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.password,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><div${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Подтверди пароль</label><div class="relative mt-1.5"${_scopeId}><input${ssrRenderDynamicModel(showPass2.value ? "text" : "password", unref(form).password_confirmation, null)}${ssrRenderAttr("type", showPass2.value ? "text" : "password")} required placeholder="••••••••" class="input-premium !mt-0 pr-11"${_scopeId}><button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500"${ssrRenderAttr("title", showPass2.value ? "Скрыть" : "Показать")}${_scopeId}><span class="text-[13px]"${_scopeId}>${ssrInterpolate(showPass2.value ? "🙈" : "👁")}</span></button></div>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.password_confirmation,
							class: "mt-1.5"
						}, null, _parent, _scopeId));
						_push(`</div><div class="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5"${_scopeId}><div class="flex items-center justify-between"${_scopeId}><label class="text-[13px] font-semibold"${_scopeId}>Домашняя зона</label><span class="text-[11px] font-bold bg-white border border-stone-200 rounded-full px-2.5 py-1"${_scopeId}>${ssrInterpolate(unref(form).home_radius_km)} км</span></div><p class="text-[11px] text-stone-500 leading-relaxed"${_scopeId}>Выбери район где живёшь/бываешь — пин видят только рядом. Адрес не храним как точный.</p><button type="button"${ssrIncludeBooleanAttr(locating.value) ? " disabled" : ""} class="w-full bg-white border border-stone-200 rounded-full py-2.5 text-xs font-semibold hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50"${_scopeId}>`);
						if (locating.value) _push(`<span class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"${_scopeId}></span>`);
						else _push(`<span${_scopeId}>📍</span>`);
						_push(` ${ssrInterpolate(unref(form).home_lat ? "Обновить моё место" : "Определить моё место")}</button>`);
						if (unref(form).home_address || addrLoading.value) {
							_push(`<div class="bg-white border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2"${_scopeId}><span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0 text-[11px]"${_scopeId}>◉</span><div class="min-w-0 flex-1"${_scopeId}><div class="text-xs font-semibold truncate"${_scopeId}>${ssrInterpolate(addrLoading.value ? "Определяем район…" : unref(form).home_address)}</div>`);
							if (unref(form).home_lat) _push(`<div class="text-[11px] text-stone-400 font-mono"${_scopeId}>${ssrInterpolate(unref(form).home_lat)}, ${ssrInterpolate(unref(form).home_lng)}</div>`);
							else _push(`<!---->`);
							_push(`</div></div>`);
						} else _push(`<!---->`);
						_push(`<div class="grid grid-cols-4 gap-1.5"${_scopeId}><!--[-->`);
						ssrRenderList([
							1,
							2,
							5,
							10
						], (r) => {
							_push(`<button type="button" class="${ssrRenderClass(["rounded-full py-2 text-xs font-semibold border", unref(form).home_radius_km === r ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"])}"${_scopeId}>${ssrInterpolate(r)} км</button>`);
						});
						_push(`<!--]--></div>`);
						_push(ssrRenderComponent(InputError_default, {
							message: unref(form).errors.home_lat,
							class: "mt-1"
						}, null, _parent, _scopeId));
						_push(`</div><button${ssrIncludeBooleanAttr(unref(form).processing) ? " disabled" : ""} class="w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2"${_scopeId}>Создать аккаунт <span${_scopeId}>→</span></button><div class="text-sm text-center text-stone-500"${_scopeId}>Уже есть? `);
						_push(ssrRenderComponent(unref(Link), {
							href: _ctx.route("login"),
							class: "font-semibold text-ink-900 hover:underline"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) _push(`Войти`);
								else return [createTextVNode("Войти")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(`</div><div class="text-[11px] text-stone-400 text-center bg-stone-50 border rounded-full px-3 py-2"${_scopeId}>🔒 Приватность по умолчанию · Размытие 200м</div></form>`);
					} else return [
						createVNode(unref(Head), { title: "Регистрация" }),
						createVNode("h1", { class: "text-[22px] font-black tracking-tight" }, "Создай аккаунт"),
						createVNode("p", { class: "text-sm text-stone-500 mt-1" }, "Выбери район, радиус и стань частью живой карты"),
						createVNode("form", {
							onSubmit: withModifiers(submit, ["prevent"]),
							class: "mt-6 space-y-4"
						}, [
							createVNode("div", null, [
								createVNode("label", { class: "text-[13px] font-semibold" }, "Имя / ник"),
								withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => unref(form).name = $event,
									type: "text",
									required: "",
									autofocus: "",
									autocomplete: "name",
									placeholder: "Роберт Дауни",
									class: "mt-1.5 input-premium"
								}, null, 8, ["onUpdate:modelValue"]), [[vModelText, unref(form).name]]),
								createVNode(InputError_default, {
									message: unref(form).errors.name,
									class: "mt-1.5"
								}, null, 8, ["message"])
							]),
							createVNode("div", null, [
								createVNode("label", { class: "text-[13px] font-semibold" }, "Email"),
								withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => unref(form).email = $event,
									type: "email",
									required: "",
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
									autocomplete: "new-password",
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
							createVNode("div", null, [
								createVNode("label", { class: "text-[13px] font-semibold" }, "Подтверди пароль"),
								createVNode("div", { class: "relative mt-1.5" }, [withDirectives(createVNode("input", {
									"onUpdate:modelValue": ($event) => unref(form).password_confirmation = $event,
									type: showPass2.value ? "text" : "password",
									required: "",
									placeholder: "••••••••",
									class: "input-premium !mt-0 pr-11"
								}, null, 8, ["onUpdate:modelValue", "type"]), [[vModelDynamic, unref(form).password_confirmation]]), createVNode("button", {
									type: "button",
									onClick: ($event) => showPass2.value = !showPass2.value,
									class: "absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500",
									title: showPass2.value ? "Скрыть" : "Показать"
								}, [createVNode("span", { class: "text-[13px]" }, toDisplayString(showPass2.value ? "🙈" : "👁"), 1)], 8, ["onClick", "title"])]),
								createVNode(InputError_default, {
									message: unref(form).errors.password_confirmation,
									class: "mt-1.5"
								}, null, 8, ["message"])
							]),
							createVNode("div", { class: "bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5" }, [
								createVNode("div", { class: "flex items-center justify-between" }, [createVNode("label", { class: "text-[13px] font-semibold" }, "Домашняя зона"), createVNode("span", { class: "text-[11px] font-bold bg-white border border-stone-200 rounded-full px-2.5 py-1" }, toDisplayString(unref(form).home_radius_km) + " км", 1)]),
								createVNode("p", { class: "text-[11px] text-stone-500 leading-relaxed" }, "Выбери район где живёшь/бываешь — пин видят только рядом. Адрес не храним как точный."),
								createVNode("button", {
									type: "button",
									onClick: detectLocation,
									disabled: locating.value,
									class: "w-full bg-white border border-stone-200 rounded-full py-2.5 text-xs font-semibold hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50"
								}, [locating.value ? (openBlock(), createBlock("span", {
									key: 0,
									class: "w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"
								})) : (openBlock(), createBlock("span", { key: 1 }, "📍")), createTextVNode(" " + toDisplayString(unref(form).home_lat ? "Обновить моё место" : "Определить моё место"), 1)], 8, ["disabled"]),
								unref(form).home_address || addrLoading.value ? (openBlock(), createBlock("div", {
									key: 0,
									class: "bg-white border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2"
								}, [createVNode("span", { class: "w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0 text-[11px]" }, "◉"), createVNode("div", { class: "min-w-0 flex-1" }, [createVNode("div", { class: "text-xs font-semibold truncate" }, toDisplayString(addrLoading.value ? "Определяем район…" : unref(form).home_address), 1), unref(form).home_lat ? (openBlock(), createBlock("div", {
									key: 0,
									class: "text-[11px] text-stone-400 font-mono"
								}, toDisplayString(unref(form).home_lat) + ", " + toDisplayString(unref(form).home_lng), 1)) : createCommentVNode("", true)])])) : createCommentVNode("", true),
								createVNode("div", { class: "grid grid-cols-4 gap-1.5" }, [(openBlock(), createBlock(Fragment, null, renderList([
									1,
									2,
									5,
									10
								], (r) => {
									return createVNode("button", {
										key: r,
										type: "button",
										onClick: ($event) => unref(form).home_radius_km = r,
										class: ["rounded-full py-2 text-xs font-semibold border", unref(form).home_radius_km === r ? "bg-ink-900 text-white border-ink-900" : "bg-white border-stone-200"]
									}, toDisplayString(r) + " км", 11, ["onClick"]);
								}), 64))]),
								createVNode(InputError_default, {
									message: unref(form).errors.home_lat,
									class: "mt-1"
								}, null, 8, ["message"])
							]),
							createVNode("button", {
								disabled: unref(form).processing,
								class: "w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
							}, [createTextVNode("Создать аккаунт "), createVNode("span", null, "→")], 8, ["disabled"]),
							createVNode("div", { class: "text-sm text-center text-stone-500" }, [createTextVNode("Уже есть? "), createVNode(unref(Link), {
								href: _ctx.route("login"),
								class: "font-semibold text-ink-900 hover:underline"
							}, {
								default: withCtx(() => [createTextVNode("Войти")]),
								_: 1
							}, 8, ["href"])]),
							createVNode("div", { class: "text-[11px] text-stone-400 text-center bg-stone-50 border rounded-full px-3 py-2" }, "🔒 Приватность по умолчанию · Размытие 200м")
						], 32)
					];
				}),
				_: 1
			}, _parent));
		};
	}
});
//#endregion
//#region resources/js/Pages/Auth/Register.vue
var _sfc_setup = Register_vue_vue_type_script_setup_true_lang_default.setup;
Register_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Auth/Register.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var Register_default = Register_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { Register_default as default };
