import { useConfirm } from 'primevue/useconfirm'

export function useAppConfirm() {
  const confirm = useConfirm()

  function confirmDelete(message: string, header = 'Удалить пин?'): Promise<boolean> {
    return new Promise((resolve) => {
      confirm.require({
        header,
        message,
        icon: 'pi pi-trash',
        acceptLabel: 'Удалить',
        rejectLabel: 'Отмена',
        accept: () => resolve(true),
        reject: () => resolve(false),
      })
    })
  }

  return { confirmDelete }
}
