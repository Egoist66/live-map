import { ref } from 'vue'

/**
 * Цель анкеты из пресетов дейтинга.
 */
export type QuestionnaireGoal = 'love' | 'flirt' | 'friendship' | 'chat' | 'interests'

/**
 * Готовый шаблон анкеты для быстрого старта.
 */
export interface QuestionnaireTemplate {
  /** id для Select */
  id: string
  /** короткое название в дропдауне */
  label: string
  /** пояснение под названием */
  desc: string
  /** иконка primeicons */
  icon: string
  /** цель из пресетов */
  goal: QuestionnaireGoal
  /** своё уточнение цели (пусто — берётся пресет) */
  customGoal: string
  /** текст «о себе» */
  about: string
  /** интересы-теги */
  interests: string[]
}

/**
 * Пять человекопонятных реалистичных шаблонов: выбрал из дропдауна —
 * поля заполнились, осталось подправить под себя и сохранить.
 * Тексты спокойные, живые, без пошлости и пафоса — проходят модерацию.
 */
export const QUESTIONNAIRE_TEMPLATES: readonly QuestionnaireTemplate[] = [
  {
    id: 'serious',
    label: 'Серьёзные отношения',
    desc: 'Тёплая анкета для тех, кто ищет пару',
    icon: 'pi pi-heart-fill',
    goal: 'love',
    customGoal: '',
    about:
      'Привет! Я Артём, 29. Работаю инженером, по вечерам готовлю ужины и смотрю кино. ' +
      'Люблю weekend-поездки за город и долгие прогулки. Ищу девушку для серьёзных отношений — ' +
      'хочется вместе смеяться, поддерживать друг друга и строить планы.',
    interests: ['путешествия', 'кино', 'кулинария', 'прогулки', 'музыка'],
  },
  {
    id: 'flirt',
    label: 'Лёгкий флирт',
    desc: 'Игривая анкета для свиданий без напряга',
    icon: 'pi pi-sparkles',
    goal: 'flirt',
    customGoal: '',
    about:
      'Привет, я Мила! Обожаю красивый город вечером: кофе, набережная, разговоры до полуночи. ' +
      'Работаю дизайнером, танцую пару раз в неделю. Хочу лёгкого общения, флирта и классных ' +
      'свиданий — а там как пойдёт.',
    interests: ['танцы', 'кофе', 'кино', 'мода', 'прогулки'],
  },
  {
    id: 'friendship',
    label: 'Дружба и компания',
    desc: 'Для поиска своих людей и тусовок',
    icon: 'pi pi-users',
    goal: 'friendship',
    customGoal: 'Ищу компанию для настолок и кино',
    about:
      'Йо, я Денис! Переехал недавно и ищу компанию: настолки по пятницам, кино, покатушки на великах. ' +
      'По характеру лёгкий, люблю мемы и умные разговоры. Пиши — соберём движ!',
    interests: ['настолки', 'кино', 'велосипед', 'игры', 'мемы'],
  },
  {
    id: 'active',
    label: 'Активный образ жизни',
    desc: 'Спорт, походы и движ по интересам',
    icon: 'pi pi-bolt',
    goal: 'interests',
    customGoal: '',
    about:
      'Я Катя, бегаю по утрам и хожу в походы каждые пару недель. Ищу людей со схожим ритмом: ' +
      'совместные тренировки, зал, выезды на природу с палатками. Новичков подтяну — главное желание!',
    interests: ['спорт', 'походы', 'бег', 'путешествия', 'йога'],
  },
  {
    id: 'soul',
    label: 'Душевное общение',
    desc: 'Книги, разговоры и медленные вечера',
    icon: 'pi pi-book',
    goal: 'chat',
    customGoal: '',
    about:
      'Здравствуйте! Я Игорь, люблю книги, винил и разговоры по душам. Вечерами — чай и кино, ' +
      'по выходным — музеи и тихие кафе. Ищу собеседника, с которым можно говорить обо всём на свете.',
    interests: ['книги', 'музыка', 'кино', 'музеи', 'чай'],
  },
]

/**
 * Форма анкеты, в которую подставляется шаблон.
 */
export interface QuestionnaireTemplateTarget {
  goal: { value: string | null }
  customGoal: { value: string }
  about: { value: string }
  interests: { value: string[] }
  addInterest: (raw: string) => void
}

/**
 * Хук шаблонов анкеты: дропдаун быстрого заполнения.
 *
 * Компонент только рисует Select, вся подстановка — здесь.
 *
 * @returns список шаблонов, выбранный id и подстановку в форму
 * @example
 * const tpl = useQuestionnaireTemplates()
 * tpl.applyTemplate(q)
 */
export function useQuestionnaireTemplates() {
  const templates = QUESTIONNAIRE_TEMPLATES
  const selectedId = ref<string | null>(null)
  const applied = ref(false)

  /**
   * Подставить шаблон в поля анкеты (интересы — через addInterest,
   * чтобы сработали лимиты и нормализация формы).
   *
   * @param target форма из useDatingQuestionnaire
   * @param id id шаблона (по умолчанию — выбранный в дропдауне)
   * @returns true если шаблон найден и подставлен
   */
  function applyTemplate(target: QuestionnaireTemplateTarget, id?: string): boolean {
    const wanted = id ?? selectedId.value
    const found = templates.find((item) => item.id === wanted)

    if (!found) {
      return false
    }

    target.goal.value = found.goal
    target.customGoal.value = found.customGoal
    target.about.value = found.about
    target.interests.value = []

    for (const tag of found.interests) {
      target.addInterest(tag)
    }

    applied.value = true

    return true
  }

  /**
   * Выбрать шаблон из дропдауна и сразу подставить.
   *
   * @param target форма из useDatingQuestionnaire
   * @param id id шаблона из Select
   */
  function selectAndApply(target: QuestionnaireTemplateTarget, id: string | null): void {
    selectedId.value = id
    applied.value = false

    if (id) {
      applyTemplate(target, id)
    }
  }

  /**
   * Сбросить выбор дропдауна после сохранения: следующий визит
   * начинается с чистой формы, а не со старым «подставлен».
   */
  function resetSelection(): void {
    selectedId.value = null
    applied.value = false
  }

  return { templates, selectedId, applied, applyTemplate, selectAndApply, resetSelection }
}
