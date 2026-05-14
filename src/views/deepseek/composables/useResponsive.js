import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MobileDetect from 'mobile-detect'

const BREAKPOINTS = {
  hideDesc: 1100,
  collapseSidebar: 1200,
  mobile: 768
}

export function useResponsive() {
  const viewportWidth = ref(window.innerWidth)
  const isMobile = ref(false)
  const isSidebarCollapsed = ref(false)
  const userToggledSidebar = ref(false)
  let resizeTimer = null

  const showTopDesc = computed(() => {
    return !isMobile.value && viewportWidth.value >= BREAKPOINTS.hideDesc
  })

  const updateViewportWidth = () => {
    if (resizeTimer) return
    resizeTimer = setTimeout(() => {
      viewportWidth.value = window.innerWidth
      clearTimeout(resizeTimer)
      resizeTimer = null
    }, 80)
  }

  watch(viewportWidth, (w) => {
    if (!userToggledSidebar.value) {
      isSidebarCollapsed.value = w < BREAKPOINTS.collapseSidebar
    }
    isMobile.value = w < BREAKPOINTS.mobile
  })

  const toggleSidebar = () => {
    userToggledSidebar.value = true
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  onMounted(() => {
    const md = new MobileDetect(window.navigator.userAgent)
    isMobile.value = !!md.mobile()
    window.addEventListener('resize', updateViewportWidth)
    updateViewportWidth()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewportWidth)
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
  })

  return { isMobile, isSidebarCollapsed, showTopDesc, toggleSidebar }
}
