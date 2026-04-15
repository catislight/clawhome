import { Select, type SelectOption } from '@/shared/ui/select'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type ChatModelSelectorProps = {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

function ChatModelSelector({
  value,
  options,
  onValueChange,
  placeholder,
  ariaLabel,
  disabled = false,
  className
}: ChatModelSelectorProps): React.JSX.Element {
  const { t } = useAppI18n()

  return (
    <Select
      value={value}
      options={options}
      onValueChange={onValueChange}
      placeholder={placeholder ?? t('chat.model.placeholderDefault')}
      ariaLabel={ariaLabel ?? t('chat.model.ariaSwitch')}
      disabled={disabled}
      className={cn('w-full max-w-[9rem]', className)}
      triggerClassName="h-7 rounded-[0.65rem] !border-0 !border-transparent !bg-transparent px-2.5 text-[11px] font-medium shadow-none hover:!border-transparent"
      contentClassName="left-0 right-auto top-auto bottom-[calc(100%+0.5rem)] min-w-[14rem] max-w-[14rem]"
    />
  )
}

export default ChatModelSelector
