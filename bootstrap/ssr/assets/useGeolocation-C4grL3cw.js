import { ref } from "vue";
//#region resources/js/composables/useGeolocation.ts
function useGeolocation(defaultCenter = [27.5615, 53.9022]) {
	const coords = ref({
		lat: defaultCenter[1],
		lng: defaultCenter[0]
	});
	const loading = ref(false);
	const error = ref(null);
	function requestGeolocation() {
		loading.value = true;
		return new Promise((resolve) => {
			if (!navigator.geolocation) {
				loading.value = false;
				resolve(coords.value);
				return;
			}
			navigator.geolocation.getCurrentPosition((pos) => {
				coords.value = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				};
				loading.value = false;
				resolve(coords.value);
			}, () => {
				error.value = "Геолокация отклонена, используем центр";
				loading.value = false;
				resolve(coords.value);
			}, {
				enableHighAccuracy: false,
				timeout: 5e3
			});
		});
	}
	return {
		coords,
		loading,
		error,
		requestGeolocation
	};
}
//#endregion
export { useGeolocation as t };
