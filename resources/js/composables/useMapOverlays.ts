import { ref, computed } from 'vue'
import { usePins } from '@/composables/usePins'

export function useMapOverlays(flyTo: (lat: number, lng: number) => void, openPin: (p: any) => void) {
  const { store, selectedCategory } = usePins()
  const showLiveInfo = ref(false)
  const showMyPins = ref(false)
  const myPins = computed(() => (store.pins as any[]).filter((p: any) => p.is_owner))

  function handleMineClick() {
    selectedCategory.value = 'mine'
    showMyPins.value = true
  }

  function flyToPin(p: any) {
    showMyPins.value = false
    flyTo(p.latitude, p.longitude)
    setTimeout(() => openPin(p), 350)
  }

  return { showLiveInfo, showMyPins, myPins, handleMineClick, flyToPin }
}
