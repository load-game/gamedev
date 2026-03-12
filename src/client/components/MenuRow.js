import { css } from '@firebolt-dev/css'
import { GlobeIcon, HammerIcon, LoaderIcon, UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { editorTheme as theme } from './editor/editorTheme'
import { MicIcon, MicOffIcon } from './Icons'

const onboardingSteps = [
  { selector: '.editor-logo', text: 'Settings' },
  { selector: '.editor-explore', text: 'Explore worlds' },
  { selector: '.editor-user', text: 'Sign in and manage your world' },
  { selector: null, text: 'Sign in → create a world → go to your world → press Tab to open the editor → copy the SDK prompt to start building' },
]

function getInitialStep() {
  try {
    if (localStorage.getItem('onboarding-complete')) return null
  } catch {
    return null
  }
  return 0
}

function OnboardingTooltip({ step, onNext, onSkip, isSummary }) {
  const isLast = step === onboardingSteps.length - 1
  const def = onboardingSteps[step]

  return (
    <div
      css={css`
        position: absolute;
        ${isSummary
          ? 'top: calc(2.75rem + 0.625rem); left: 0;'
          : 'top: 100%; left: 0; margin-top: 0.625rem;'}
        width: ${isSummary ? '320px' : '220px'};
        background: ${theme.panelBg};
        border: 1px solid ${theme.border};
        border-radius: ${theme.radius};
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        padding: 0.75rem;
        z-index: 100;
        pointer-events: auto;
        &::before {
          content: '';
          position: absolute;
          top: -5px;
          left: 1rem;
          transform: rotate(45deg);
          width: 8px;
          height: 8px;
          background: ${theme.panelBg};
          border-left: 1px solid ${theme.border};
          border-top: 1px solid ${theme.border};
          ${isSummary ? 'display: none;' : ''}
        }
      `}
    >
      <div
        css={css`
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.8125rem;
          line-height: 1.4;
          margin-bottom: 0.625rem;
        `}
      >
        {def.text}
      </div>
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
        `}
      >
        <span
          css={css`
            color: rgba(255, 255, 255, 0.4);
            font-size: 0.6875rem;
            cursor: pointer;
            &:hover {
              color: rgba(255, 255, 255, 0.7);
            }
          `}
          onClick={onSkip}
        >
          Skip
        </span>
        <span
          css={css`
            color: rgba(255, 255, 255, 0.35);
            font-size: 0.6875rem;
          `}
        >
          {step + 1}/{onboardingSteps.length}
        </span>
        <span
          css={css`
            color: white;
            font-size: 0.75rem;
            cursor: pointer;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            &:hover {
              background: rgba(255, 255, 255, 0.2);
            }
          `}
          onClick={onNext}
        >
          {isLast ? 'Got it' : 'Next'}
        </span>
      </div>
    </div>
  )
}

function OnboardingTarget({ step, name, onNext, onSkip, children }) {
  const ref = useRef(null)
  const stepDef = onboardingSteps[step]
  const isActive = stepDef && stepDef.selector === '.' + name

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current.firstElementChild
    if (!el) return
    if (isActive) {
      el.classList.add('onboarding-highlight')
      return () => el.classList.remove('onboarding-highlight')
    }
  }, [isActive])

  return (
    <div
      ref={ref}
      css={css`
        position: relative;
      `}
    >
      {children}
      {isActive && <OnboardingTooltip step={step} onNext={onNext} onSkip={onSkip} />}
    </div>
  )
}

export function MenuRow({ world, open, onToggle, buildMode, auth, onUserClick, onExploreClick }) {
  const [onboardingStep, setOnboardingStep] = useState(getInitialStep)

  const dismissOnboarding = () => {
    setOnboardingStep(null)
    try {
      localStorage.setItem('onboarding-complete', '1')
    } catch {}
  }

  const advanceOnboarding = () => {
    if (onboardingStep >= onboardingSteps.length - 1) {
      dismissOnboarding()
    } else {
      setOnboardingStep(onboardingStep + 1)
    }
  }

  return (
    <div
      className='menu-row'
      css={css`
        position: absolute;
        top: calc(1rem + env(safe-area-inset-top));
        left: calc(1rem + env(safe-area-inset-left));
        display: flex;
        gap: 0.5rem;
        z-index: 10;
        pointer-events: auto;
        .onboarding-highlight {
          border-color: rgba(255, 255, 255, 0.35) !important;
          box-shadow: 0 0 8px rgba(255, 255, 255, 0.15) !important;
          background: rgba(255, 255, 255, 0.06) !important;
        }
      `}
    >
      <OnboardingTarget step={onboardingStep} name="editor-logo" onNext={advanceOnboarding} onSkip={dismissOnboarding}>
        <LogoBtn onClick={() => world.emit('open-menu')} />
      </OnboardingTarget>
      {buildMode && (
        <div
          className='editor-toolbar-toggle'
          css={css`
            width: 2.75rem;
            height: 2.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${open ? theme.panelBg : 'transparent'};
            border: 1px solid ${open ? 'rgba(255, 255, 255, 0.2)' : theme.border};
            border-radius: ${theme.radius};
            cursor: pointer;
            color: ${open ? 'white' : 'rgba(255, 255, 255, 0.6)'};
            &:hover {
              color: white;
              background: ${theme.bgHover};
            }
          `}
          onClick={onToggle}
        >
          <HammerIcon size='1.125rem' />
        </div>
      )}
      <OnboardingTarget step={onboardingStep} name="editor-explore" onNext={advanceOnboarding} onSkip={dismissOnboarding}>
        <ExploreBtn onClick={onExploreClick} />
      </OnboardingTarget>
      <MicBtn world={world} />
      <OnboardingTarget step={onboardingStep} name="editor-user" onNext={advanceOnboarding} onSkip={dismissOnboarding}>
        <UserBtn auth={auth} onClick={onUserClick} />
      </OnboardingTarget>
      {onboardingStep != null && onboardingSteps[onboardingStep].selector === null && (
        <OnboardingTooltip step={onboardingStep} onNext={advanceOnboarding} onSkip={dismissOnboarding} isSummary />
      )}
    </div>
  )
}

function LogoBtn({ onClick }) {
  return (
    <div
      className='editor-logo'
      css={css`
        width: 2.75rem;
        height: 2.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid ${theme.border};
        border-radius: ${theme.radius};
        cursor: pointer;
        &:hover {
          background: ${theme.bgHover};
        }
        img {
          width: 1.75rem;
          height: 1.75rem;
          object-fit: contain;
        }
      `}
      onClick={onClick}
    >
      <img src='/logo.png' />
    </div>
  )
}

function ExploreBtn({ onClick }) {
  return (
    <div
      className='editor-explore'
      css={css`
        width: 2.75rem;
        height: 2.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid ${theme.border};
        border-radius: ${theme.radius};
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        user-select: none;
        &:hover {
          background: ${theme.bgHover};
        }
      `}
      onClick={() => onClick?.()}
    >
      <GlobeIcon size='1.1rem' />
    </div>
  )
}

function MicBtn({ world }) {
  const [livekit, setLivekit] = useState(() => world.livekit.status)
  useEffect(() => {
    const onStatus = status => setLivekit({ ...status })
    world.livekit.on('status', onStatus)
    return () => world.livekit.off('status', onStatus)
  }, [])
  if (!livekit.available) return null
  const toggle = async () => {
    try {
      await world.livekit.setMicrophoneEnabled(!livekit.mic)
    } catch (err) {
      if (err?.message === 'muted_by_moderator') {
        world.emit('toast', 'You are muted by a moderator.')
      }
    }
  }
  return (
    <div
      className='editor-mic'
      css={css`
        width: 2.75rem;
        height: 2.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${livekit.mic ? 'rgba(255,255,255,0.15)' : 'transparent'};
        border: 1px solid ${livekit.mic ? 'rgba(255,255,255,0.4)' : theme.border};
        border-radius: ${theme.radius};
        color: ${livekit.mic ? 'white' : 'rgba(255, 255, 255, 0.6)'};
        cursor: pointer;
        user-select: none;
        &:hover {
          background: ${theme.bgHover};
          color: white;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}
      onClick={toggle}
    >
      {livekit.connecting ? (
        <LoaderIcon size='1.1rem' className='spinning' />
      ) : livekit.mic ? (
        <MicIcon size='1.1rem' />
      ) : (
        <MicOffIcon size='1.1rem' />
      )}
    </div>
  )
}

function UserBtn({ auth, onClick }) {
  const pending = !!auth?.pending
  return (
    <div
      className='editor-user'
      css={css`
        width: 2.75rem;
        height: 2.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid ${theme.border};
        border-radius: ${theme.radius};
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        user-select: none;
        position: relative;
        &:hover {
          background: ${theme.bgHover};
        }
      `}
      onClick={() => onClick?.()}
    >
      {pending ? <LoaderIcon size='1.1rem' /> : <UserIcon size='1.1rem' />}
    </div>
  )
}
