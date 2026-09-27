import { useId, useState, useEffect } from 'react'

export function MenuButton({ children, primary, className = '', ...props }) {
  return (
    <button type='button' className={`menu-button ${primary ? 'primary' : ''} ${className}`} {...props}>
      <span className='menu-label'>{children}</span>
    </button>
  )
}

export function SettingsRange({ label, value, min = 0, max = 2, step = 0.05, onChange }) {
  const id = useId()
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  const percent = number => `${Math.round(number * 100)}%`
  return (
    <div className='menu-card menu-range'>
      <div className='menu-range-head'>
        <label className='menu-label' htmlFor={id}>
          {label}
        </label>
        <output htmlFor={id}>{percent(local)}</output>
      </div>
      <input
        id={id}
        type='range'
        min={min}
        max={max}
        step={step}
        value={local}
        aria-valuetext={percent(local)}
        style={{ '--level': `${((local - min) / (max - min)) * 100}%` }}
        onChange={event => {
          setLocal(event.target.valueAsNumber)
          onChange(event.target.valueAsNumber)
        }}
      />
      <div className='menu-range-scale' aria-hidden='true'>
        <span>{percent(min)}</span>
        <span>{percent(max)}</span>
      </div>
    </div>
  )
}

export function SettingsToggle({ label, value, onChange, disabled }) {
  return (
    <div className='menu-card'>
      <span className='menu-label'>{label}</span>
      <MenuButton aria-label={label} aria-pressed={!!value} disabled={disabled} onClick={() => onChange(!value)}>
        {value ? 'On' : 'Off'}
      </MenuButton>
    </div>
  )
}

export function SettingsSelect({ label, value, options, onChange }) {
  return (
    <label className='menu-card'>
      <span className='menu-label'>{label}</span>
      <select
        value={value}
        onChange={event => {
          const option = options.find(item => String(item.value) === event.target.value)
          if (option) onChange(option.value)
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SettingsText({ label, value, onChange, placeholder }) {
  const [draft, setDraft] = useState(value || '')
  useEffect(() => setDraft(value || ''), [value])
  return (
    <label className='menu-card'>
      <span className='menu-label'>{label}</span>
      <input
        type='text'
        value={draft}
        placeholder={placeholder}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
    </label>
  )
}
