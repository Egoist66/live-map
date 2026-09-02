import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.js";
import { t as InputError_default } from "./InputError-CNXrTt1h.js";
import { t as _plugin_vue_export_helper_default } from "./_plugin-vue_export-helper-BOaGB7Aw.js";
import { t as PrimaryButton_default } from "./PrimaryButton-BqgYZ7WE.js";
import { computed, createTextVNode, defineComponent, mergeProps, onBeforeUnmount, ref, unref, useSSRContext, watch, withCtx } from "vue";
import { Link, useForm, usePage } from "@inertiajs/vue3";
import { ssrIncludeBooleanAttr, ssrInterpolate, ssrLooseContain, ssrRenderAttr, ssrRenderAttrs, ssrRenderClass, ssrRenderComponent } from "vue/server-renderer";
//#region resources/js/Components/AvatarPreview.vue?vue&type=script&setup=true&lang.ts
var AvatarPreview_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "AvatarPreview",
	__ssrInlineRender: true,
	props: {
		src: {},
		name: {},
		open: { type: Boolean }
	},
	emits: ["close"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emit = __emit;
		function onKey(e) {
			if (e.key === "Escape") emit("close");
		}
		watch(() => props.open, (v) => {
			if (v) {
				document.body.style.overflow = "hidden";
				window.addEventListener("keydown", onKey);
			} else {
				document.body.style.overflow = "";
				window.removeEventListener("keydown", onKey);
			}
		});
		onBeforeUnmount(() => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", onKey);
		});
		return (_ctx, _push, _parent, _attrs) => {
			if (__props.open) _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" }, _attrs))} data-v-ae18947d><div class="absolute inset-0 bg-ink-900/70 dark:bg-black/80 backdrop-blur-sm" data-v-ae18947d></div><template><div class="relative" data-v-ae18947d><div class="relative bg-white dark:bg-zinc-900 rounded-[24px] p-2 shadow-float border border-white/20 dark:border-zinc-700 max-w-[92vw] max-h-[88vh] flex flex-col" data-v-ae18947d><img${ssrRenderAttr("src", __props.src)}${ssrRenderAttr("alt", __props.name || "avatar")} class="max-w-[80vw] sm:max-w-[420px] max-h-[70vh] w-auto h-auto rounded-[16px] object-cover bg-stone-100 dark:bg-zinc-800" data-v-ae18947d><div class="flex items-center justify-between gap-4 px-2 py-3" data-v-ae18947d><div class="min-w-0" data-v-ae18947d><div class="text-sm font-bold dark:text-white truncate" data-v-ae18947d>${ssrInterpolate(__props.name || "Фото профиля")}</div><div class="text-xs text-stone-500 dark:text-zinc-400" data-v-ae18947d>Нажми вне фото чтобы закрыть · Esc</div></div><a${ssrRenderAttr("href", __props.src)} target="_blank" class="shrink-0 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full hover:opacity-90 transition" data-v-ae18947d>Открыть</a></div><button class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft grid place-items-center hover:bg-stone-50 dark:hover:bg-zinc-700 transition text-stone-600 dark:text-zinc-300" data-v-ae18947d>✕</button></div></div></template></div>`);
			else _push(`<!---->`);
		};
	}
});
//#endregion
//#region resources/js/Components/AvatarPreview.vue
var _sfc_setup$1 = AvatarPreview_vue_vue_type_script_setup_true_lang_default.setup;
AvatarPreview_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Components/AvatarPreview.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var AvatarPreview_default = /*#__PURE__*/ _plugin_vue_export_helper_default(AvatarPreview_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-ae18947d"]]);
//#endregion
//#region resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.vue?vue&type=script&setup=true&lang.ts
var UpdateProfileInformationForm_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "UpdateProfileInformationForm",
	__ssrInlineRender: true,
	props: {
		mustVerifyEmail: { type: Boolean },
		status: {}
	},
	setup(__props) {
		const page = usePage();
		const user = computed(() => page.props.auth.user);
		const form = useForm({
			name: user.value.name,
			email: user.value.email,
			home_lat: user.value.home_lat || "",
			home_lng: user.value.home_lng || "",
			home_radius_km: user.value.home_radius_km || 2,
			is_anonymous_default: !!user.value.is_anonymous_default,
			plan: user.value.plan || "free"
		});
		watch(user, (u) => {
			form.name = u.name;
			form.email = u.email;
			form.home_lat = u.home_lat || "";
			form.home_lng = u.home_lng || "";
			form.home_radius_km = u.home_radius_km || 2;
			form.is_anonymous_default = !!u.is_anonymous_default;
			form.plan = u.plan || "free";
		});
		const avatarFile = ref(null);
		const previewUrl = ref(null);
		const uploading = ref(false);
		const avatarOk = ref(false);
		const showPreview = ref(false);
		const avatarSrc = computed(() => {
			if (previewUrl.value) return previewUrl.value;
			if (user.value.avatar_path) return `/storage/${user.value.avatar_path}`;
			return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.value.name)}&background=0F172A&color=fff&bold=true`;
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<section${ssrRenderAttrs(_attrs)}><header><h2 class="font-bold">Профиль и приватность</h2><p class="text-sm text-zinc-500 mt-1">Имя, почта, домашняя зона и режим анонимности по умолчанию.</p></header><div class="flex flex-col sm:flex-row items-start gap-5 mt-6 p-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl"><div class="relative shrink-0"><button class="group relative w-20 h-20 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"><img${ssrRenderAttr("src", avatarSrc.value)} class="w-full h-full object-cover group-hover:scale-105 transition duration-300"><span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">🔍 превью</span></button>`);
			if (avatarOk.value) _push(`<span class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">✓</span>`);
			else _push(`<!---->`);
			_push(`</div><div class="flex-1 min-w-0 w-full"><label class="text-sm font-semibold">Фото профиля</label><p class="text-xs text-zinc-500">JPG/PNG/WebP до 2МБ · сразу видно везде</p><div class="flex gap-2 mt-3"><label class="flex-1 cursor-pointer"><input type="file" accept="image/*" class="hidden"><span class="block text-sm border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 text-stone-600 dark:text-zinc-300 truncate">${ssrInterpolate(avatarFile.value ? avatarFile.value.name : "Выбери файл…")}</span></label><button type="button"${ssrIncludeBooleanAttr(!avatarFile.value || uploading.value) ? " disabled" : ""} class="bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 shrink-0 flex items-center gap-2">`);
			if (uploading.value) _push(`<span class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>`);
			else _push(`<!---->`);
			_push(` ${ssrInterpolate(uploading.value ? "Загрузка…" : "Загрузить")}</button></div>`);
			if (avatarOk.value) _push(`<div class="text-xs text-emerald-600 mt-1.5">✓ Фото обновлено — видно в шапке и на пинах</div>`);
			else _push(`<!---->`);
			_push(`</div></div><form class="mt-6 space-y-4"><div class="grid sm:grid-cols-2 gap-4"><div><label class="text-sm font-medium">Имя</label><input${ssrRenderAttr("value", unref(form).name)} type="text" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700" required>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.name,
				class: "mt-1"
			}, null, _parent));
			_push(`</div><div><label class="text-sm font-medium">Email</label><input${ssrRenderAttr("value", unref(form).email)} type="email" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700" required>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.email,
				class: "mt-1"
			}, null, _parent));
			_push(`</div></div><div class="bg-zinc-50 dark:bg-zinc-900 border rounded-xl p-4 space-y-3"><div class="flex items-center justify-between"><h4 class="text-sm font-bold">Домашняя зона</h4><button type="button" class="text-xs bg-black dark:bg-white dark:text-black text-white px-3 py-1 rounded-full">Моя геопозиция</button></div><div class="grid sm:grid-cols-3 gap-3"><div><label class="text-xs font-medium">Широта</label><input${ssrRenderAttr("value", unref(form).home_lat)} placeholder="55.75" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700">`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.home_lat,
				class: "mt-1"
			}, null, _parent));
			_push(`</div><div><label class="text-xs font-medium">Долгота</label><input${ssrRenderAttr("value", unref(form).home_lng)} placeholder="37.61" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700">`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.home_lng,
				class: "mt-1"
			}, null, _parent));
			_push(`</div><div><label class="text-xs font-medium">Радиус км</label><input${ssrRenderAttr("value", unref(form).home_radius_km)} type="number" min="1" max="20" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700">`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.home_radius_km,
				class: "mt-1"
			}, null, _parent));
			_push(`</div></div><p class="text-[11px] text-zinc-500">Не точный адрес — только зона интереса. Используется для уведомлений о пинах рядом.</p></div><label class="flex items-center gap-2 text-sm"><input type="checkbox"${ssrIncludeBooleanAttr(Array.isArray(unref(form).is_anonymous_default) ? ssrLooseContain(unref(form).is_anonymous_default, null) : unref(form).is_anonymous_default) ? " checked" : ""} class="rounded"> Создавать пины анонимно по умолчанию (без репутации)</label><div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4"><h4 class="text-sm font-black">Тариф — ${ssrInterpolate({
				free: "Бесплатный",
				pro: "Pro",
				business: "Бизнес"
			}[unref(form).plan])}</h4><p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Переключи тариф — вступают сразу. Оплата пока в демо-режиме.</p><div class="mt-3 grid sm:grid-cols-3 gap-2"><button type="button" class="${ssrRenderClass(["rounded-2xl border p-3 text-left transition", unref(form).plan === "free" ? "bg-ink-900 dark:bg-white dark:text-ink-900 text-white border-ink-900 dark:border-white shadow-soft" : "bg-stone-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100"])}"><div class="text-sm font-bold">Free</div><div class="text-xs opacity-70">3/день · 1км · 2ч</div><div class="text-xs font-bold mt-1">Бесплатно</div></button><button type="button" class="${ssrRenderClass(["rounded-2xl border p-3 text-left transition relative overflow-hidden", unref(form).plan === "pro" ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-600 shadow-lg dark:from-violet-500 dark:to-indigo-500" : "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-stone-900 dark:text-amber-100"])}">`);
			if (unref(form).plan === "pro") _push(`<span class="absolute top-2 right-2 text-[10px] bg-white/20 rounded-full px-2 py-0.5">выбран</span>`);
			else _push(`<!---->`);
			_push(`<div class="text-sm font-black">Pro</div><div class="text-xs opacity-80">Безлимит · 5км · 24ч</div><div class="text-xs font-bold mt-1">\$4.99 / мес</div></button><button type="button" class="${ssrRenderClass(["rounded-2xl border p-3 text-left transition", unref(form).plan === "business" ? "bg-ink-900 dark:bg-white dark:text-ink-900 text-white border-ink-900 dark:border-white shadow-soft" : "bg-stone-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100"])}"><div class="text-sm font-bold">Business</div><div class="text-xs opacity-70">Безлимит · 50км · 168ч</div><div class="text-xs font-bold mt-1">\$19.99 / мес</div></button></div>`);
			_push(ssrRenderComponent(InputError_default, {
				message: unref(form).errors.plan,
				class: "mt-2"
			}, null, _parent));
			_push(`</div>`);
			if (__props.mustVerifyEmail && user.value.email_verified_at === null) {
				_push(`<div class="text-sm bg-amber-50 border border-amber-200 rounded-xl p-3"> Почта не подтверждена. `);
				_push(ssrRenderComponent(unref(Link), {
					href: _ctx.route("verification.send"),
					method: "post",
					as: "button",
					class: "underline font-medium"
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Отправить письмо`);
						else return [createTextVNode("Отправить письмо")];
					}),
					_: 1
				}, _parent));
				if (__props.status === "verification-link-sent") _push(`<div class="text-green-700 mt-1">Письмо отправлено</div>`);
				else _push(`<!---->`);
				_push(`</div>`);
			} else _push(`<!---->`);
			_push(`<div class="flex items-center gap-3">`);
			_push(ssrRenderComponent(PrimaryButton_default, {
				disabled: unref(form).processing,
				class: "!bg-black dark:!bg-white dark:!text-ink-900 !rounded-full"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`Сохранить`);
					else return [createTextVNode("Сохранить")];
				}),
				_: 1
			}, _parent));
			if (unref(form).recentlySuccessful) _push(`<span class="text-sm text-green-600">Сохранено</span>`);
			else _push(`<!---->`);
			_push(`</div></form>`);
			_push(ssrRenderComponent(AvatarPreview_default, {
				src: avatarSrc.value,
				name: user.value.name,
				open: showPreview.value,
				onClose: ($event) => showPreview.value = false
			}, null, _parent));
			_push(`</section>`);
		};
	}
});
//#endregion
//#region resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.vue
var UpdateProfileInformationForm_exports = /* @__PURE__ */ __exportAll({ default: () => UpdateProfileInformationForm_default });
var _sfc_setup = UpdateProfileInformationForm_vue_vue_type_script_setup_true_lang_default.setup;
UpdateProfileInformationForm_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var UpdateProfileInformationForm_default = UpdateProfileInformationForm_vue_vue_type_script_setup_true_lang_default;
//#endregion
export { UpdateProfileInformationForm_exports as n, AvatarPreview_default as r, UpdateProfileInformationForm_default as t };
