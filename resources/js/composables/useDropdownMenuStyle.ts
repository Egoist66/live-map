export function useDropdownMenuStyle() {
  const optionClass = '!rounded-lg !px-3 !py-2.5 !text-sm !text-stone-800 dark:!text-zinc-100 hover:!bg-stone-100 dark:hover:!bg-white/10 focus:!bg-stone-100 dark:focus:!bg-white/10'
  const menuItemClass = 'group flex items-center gap-3 px-3 py-2.5 rounded-lg my-px !bg-transparent hover:!bg-stone-100 dark:hover:!bg-white/10 focus-within:!bg-stone-100 dark:focus-within:!bg-white/10'
  const menuPt = {
    root: { class: '!bg-white dark:!bg-[#0F121F]/95 dark:!backdrop-blur-xl !border !border-stone-200 dark:!border-white/10 !rounded-[20px] !shadow-float dark:!shadow-[0_24px_70px_-16px_rgba(0,0,0,0.8)] !overflow-hidden !p-0' },
    list: { class: '!bg-transparent !p-1.5 !m-0 !list-none !flex !flex-col !gap-0.5' },
    rootList: { class: '!bg-transparent !p-1.5 !m-0 !list-none !flex !flex-col !gap-0.5' },
    item: { class: '!bg-transparent' },
    itemContent: { class: '!bg-transparent hover:!bg-transparent focus:!bg-transparent focus-visible:!bg-transparent' },
    itemLink: { class: 'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer !text-sm !font-medium !text-stone-800 dark:!text-zinc-100 hover:!bg-stone-100 dark:hover:!bg-white/10 focus-visible:!bg-stone-100 dark:focus-visible:!bg-white/10 focus-visible:!outline-none transition' },
    itemIcon: { class: '!text-base !text-stone-500 dark:!text-zinc-400 shrink-0' },
    itemLabel: { class: 'flex-1 truncate' },
    separator: { class: '!border-stone-200 dark:!border-white/10 !mx-3 !my-1' },
  }
  const selectPt = {
    root: { class: '!rounded-xl !border-stone-200 dark:!border-white/10 !bg-white dark:!bg-[#0F121F]' },
    label: { class: '!text-sm !py-2.5 !text-stone-900 dark:!text-zinc-100 placeholder:!text-stone-400 dark:placeholder:!text-zinc-500' },
    dropdown: { class: '!w-9' },
    dropdownIcon: { class: '!text-xs !text-stone-400 dark:!text-zinc-500' },
    overlay: { class: '!rounded-xl !border !border-stone-200 dark:!border-white/10 !bg-white dark:!bg-[#0F121F] !shadow-xl !max-w-[calc(100vw-2rem)] !overflow-hidden' },
    listContainer: { class: '!bg-white dark:!bg-[#0F121F] !p-1.5' },
    list: { class: '!bg-white dark:!bg-[#0F121F] !flex !flex-col !gap-0.5' },
    option: { class: optionClass },
  }
  return { optionClass, menuItemClass, menuPt, selectPt }
}
