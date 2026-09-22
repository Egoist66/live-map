import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { businessRegisterSchema } from '@/validation/schemas/business-register.schema'
import { route } from '@/route'

export const BUSINESS_LEGAL_FORM_OPTIONS = [
  { label: 'ООО — общество с ограниченной ответственностью', value: 'ooo' },
  { label: 'ИП — индивидуальный предприниматель', value: 'ip' },
  { label: 'ОДО — общество с дополнительной ответственностью', value: 'odo' },
  { label: 'ЗАО — закрытое акционерное общество', value: 'zao' },
  { label: 'Самозанятый', value: 'self_employed' },
  { label: 'Ремесленник', value: 'craft' },
  { label: 'Другое', value: 'other' },
]

/**
 * Форма регистрации компании по РБ (без дейтинга).
 *
 * Собирает реквизиты для проверки по УНП и создаёт сразу
 * бизнес-аккаунт: после регистрации ведёт в онбординг кабинета.
 *
 * @returns поля формы, ошибки и отправку
 * @example const form = useBusinessRegisterForm()
 */
export function useBusinessRegisterForm() {
  const showPass = ref(false)
  const showPass2 = ref(false)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

  const { defineField, handleSubmit, errors, values, isSubmitting, setErrors } = useForm({
    validationSchema: businessRegisterSchema,
    initialValues: {
      name: '',
      brand: null,
      email: '',
      password: '',
      password_confirmation: '',
      legal_form: 'ooo',
      unp: '',
      legal_address: '',
      phone: null,
      home_city: null,
    } as any,
  })

  const [name, nameAttrs] = defineField('name')
  const [brand] = defineField('brand')
  const [email, emailAttrs] = defineField('email')
  const [password, passwordAttrs] = defineField('password')
  const [passwordConfirmation, passwordConfirmationAttrs] = defineField('password_confirmation')
  const [legalForm] = defineField('legal_form')
  const [unp, unpAttrs] = defineField('unp')
  const [legalAddress, legalAddressAttrs] = defineField('legal_address')
  const [phone] = defineField('phone')
  const [homeCity] = defineField('home_city')

  const submit = handleSubmit(async (vals: any) => {
    const payload = {
      name: vals.name,
      brand: vals.brand ?? null,
      email: vals.email,
      password: vals.password,
      password_confirmation: vals.password_confirmation,
      signup_goal: 'business',
      account_type: 'business',
      legal_form: vals.legal_form,
      unp: vals.unp,
      legal_address: vals.legal_address,
      phone: vals.phone ?? null,
      home_city: vals.home_city ?? null,
      country: 'Беларусь',
      country_code: 'by',
    }

    router.post(route('register'), payload, {
      onError: (errs: Record<string, string>) => {
        setErrors(errs)
        const first = Object.values(errs)[0]
        if (first && toast) {
          toast.add({ severity: 'error', summary: 'Проверьте реквизиты', detail: String(first), life: 4500 })
        }
      },
    })
  })

  return {
    name,
    nameAttrs,
    brand,
    email,
    emailAttrs,
    password,
    passwordAttrs,
    passwordConfirmation,
    passwordConfirmationAttrs,
    legalForm,
    unp,
    unpAttrs,
    legalAddress,
    legalAddressAttrs,
    phone,
    homeCity,
    errors,
    values,
    showPass,
    showPass2,
    submit,
    isSubmitting,
    legalFormOptions: BUSINESS_LEGAL_FORM_OPTIONS,
  }
}
