import { computed, ref, watch } from "vue";
//#region resources/js/composables/useTheme.ts
var stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
var theme = ref(stored || "system");
var mql = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
var systemDark = ref(mql?.matches ?? false);
if (mql) mql.addEventListener("change", (e) => {
	systemDark.value = e.matches;
	if (theme.value === "system") apply();
});
function apply() {
	const isDark = theme.value === "dark" || theme.value === "system" && systemDark.value;
	if (typeof document !== "undefined") {
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.style.colorScheme = isDark ? "dark" : "light";
	}
}
if (typeof window !== "undefined") {
	apply();
	watch(theme, (v) => {
		localStorage.setItem("theme", v);
		apply();
	});
}
var isDark = computed(() => theme.value === "dark" || theme.value === "system" && systemDark.value);
function useTheme() {
	function setTheme(v) {
		theme.value = v;
	}
	function toggle() {
		theme.value = isDark.value ? "light" : "dark";
	}
	return {
		theme,
		isDark,
		setTheme,
		toggle,
		systemDark
	};
}
//#endregion
export { useTheme as t };
