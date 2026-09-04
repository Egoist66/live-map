export function useChatLayout() {
  const pageClass = 'mx-auto max-w-[1280px] w-full min-w-0 overflow-hidden overscroll-none p-0 lg:px-6 lg:py-4'
  const frameClass = 'flex flex-col lg:flex-row lg:gap-4 w-full min-w-0 overflow-hidden overscroll-contain bg-transparent'
  const sidebarCardClass = 'w-full lg:w-[360px] lg:min-w-[360px] flex-1 lg:flex-none min-h-0 lg:h-full lg:max-h-full bg-white dark:bg-zinc-900 rounded-none lg:rounded-2xl border-0 lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden max-w-full'
  const windowCardClass = 'flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-none lg:rounded-2xl border-0 lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden min-w-0 w-full max-w-full'

  return { pageClass, frameClass, sidebarCardClass, windowCardClass }
}
