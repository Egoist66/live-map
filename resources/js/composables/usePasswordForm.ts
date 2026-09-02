import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { updatePasswordSchema } from '@/validation/schemas/password.schema'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'

export function usePasswordForm() {
  const show1 = ref(false)
  const show2 = ref(false)
  const show3 = ref(false)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  const { defineField, handleSubmit, errors, values, resetForm, isSubmitting } = useForm({
    validationSchema: updatePasswordSchema,
    initialValues: { current_password: '', password: '', password_confirmation: '' } as any,
  })

  const [current_password, currentAttrs] = defineField('current_password')
  const [password, passwordAttrs] = defineField('password')
  const [password_confirmation, confirmationAttrs] = defineField('password_confirmation')

  const submit = handleSubmit((vals: any) => {
    router.put(route('password.update'), vals, {
      preserveScroll: true,
      onSuccess: () => { resetForm(); toast?.add({ severity: 'success', summary: 'Пароль обновлён', life: 2000 }) },
      onError: () => toast?.add({ severity: 'error', summary: 'Ошибка', life: 3000 }),
    })
  })

  return { current_password, currentAttrs, password, passwordAttrs, password_confirmation, confirmationAttrs, errors, values, show1, show2, show3, submit, isSubmitting, resetForm }
}
