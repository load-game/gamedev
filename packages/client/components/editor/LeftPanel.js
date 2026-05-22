import { css } from '@firebolt-dev/css'
import { useEffect, useState } from 'react'
import { editorTheme as theme } from './editorTheme.js'
import { CollapsibleSection } from './CollapsibleSection.js'
import { World } from '../sidebar/World.js'
import { Add } from '../sidebar/Add.js'
import { Apps } from '../sidebar/Apps.js'
import { isTouch } from '../../utils.js'
import { MouseLeftIcon } from '../MouseLeftIcon.js'
import { MouseRightIcon } from '../MouseRightIcon.js'
import { MouseWheelIcon } from '../MouseWheelIcon.js'
import { buttons, propToLabel } from '../../../plugins/controls/buttons.js'

export function LeftPanel({ world }) {
  return (
    <div
      className='left-panel'
      css={css`
        width: ${theme.leftPanelWidth};
        background: ${theme.panelBg};
        border-right: 1px solid ${theme.panelBorder};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        pointer-events: auto;
        .left-panel-sections {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .left-panel-world {
          overflow-y: auto;
        }
        .left-panel-add {
          overflow-y: auto;
        }
        .left-panel-apps {
          overflow-y: auto;
        }
        .sidebarpane {
          width: 100%;
        }
      `}
    >
      <div className='left-panel-sections noscrollbar'>
        <CollapsibleSection label='World'>
          <div className='left-panel-world noscrollbar'>
            <WorldInline world={world} />
          </div>
        </CollapsibleSection>
        <CollapsibleSection label='Library' defaultOpen>
          <div className='left-panel-add noscrollbar'>
            <AddInline world={world} />
          </div>
        </CollapsibleSection>
        <CollapsibleSection label='Objects' defaultOpen>
          <div className='left-panel-apps noscrollbar'>
            <AppsInline world={world} />
          </div>
        </CollapsibleSection>
        <KeybindsSection world={world} />
      </div>
    </div>
  )
}

function WorldInline({ world }) {
  return <World world={world} hidden={false} />
}

function AddInline({ world }) {
  return <Add world={world} hidden={false} />
}

function AppsInline({ world }) {
  return <Apps world={world} hidden={false} />
}

function KeybindsSection({ world }) {
  const [showActions, setShowActions] = useState(() => world.prefs.actions)
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.actions) setShowActions(changes.actions.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  if (isTouch) return null
  if (!showActions) return null
  return (
    <CollapsibleSection label='Keybinds' defaultOpen>
      <div
        className='editor-actions'
        css={css`
          padding: 0.5rem 0.75rem;
          .editor-actions-inner {
            transform: scale(0.8);
            pointer-events: none;
          }
        `}
      >
        <div className='editor-actions-inner'>
          <Actions world={world} />
        </div>
      </div>
    </CollapsibleSection>
  )
}

function Actions({ world }) {
  const [actions, setActions] = useState(() => world.controls.actions)
  useEffect(() => {
    world.on('actions', setActions)
    return () => world.off('actions', setActions)
  }, [])
  return (
    <div
      className='actions'
      css={css`
        display: flex;
        flex-direction: column;
        justify-content: center;
        .actions-item {
          display: flex;
          align-items: flex-start;
          margin: 0 0 0.5rem;
          &-icon {
            flex: 0 0 auto;
            width: 2.25em;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          &-label {
            margin-left: 0.5em;
            line-height: 1.2;
            white-space: normal;
            max-width: 12em;
            paint-order: stroke fill;
            -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
          }
        }
      `}
    >
      {actions.map(action => (
        <div className='actions-item' key={action.id}>
          <div className='actions-item-icon'>{getActionIcon(action)}</div>
          <div className='actions-item-label'>{action.label}</div>
        </div>
      ))}
    </div>
  )
}

function getActionIcon(action) {
  if (action.type === 'custom') return <ActionPill label={action.btn} />
  if (action.type === 'controlLeft') return <ActionPill label='Ctrl' />
  if (action.type === 'mouseLeft') return <ActionIcon icon={MouseLeftIcon} />
  if (action.type === 'mouseRight') return <ActionIcon icon={MouseRightIcon} />
  if (action.type === 'mouseWheel') return <ActionIcon icon={MouseWheelIcon} />
  if (buttons.has(action.type)) return <ActionPill label={propToLabel[action.type]} />
  return <ActionPill label='?' />
}

function ActionPill({ label }) {
  return (
    <div
      css={css`
        border: 0.0625rem solid white;
        border-radius: 0.25rem;
        background: rgba(0, 0, 0, 0.1);
        padding: 0.125rem 0.3125rem;
        font-size: 0.75em;
        line-height: 1;
        height: 1.25em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        paint-order: stroke fill;
        -webkit-text-stroke: 0.25rem rgba(0, 0, 0, 0.2);
      `}
    >
      {label}
    </div>
  )
}

function ActionIcon({ icon: Icon }) {
  return (
    <div
      css={css`
        line-height: 0;
        svg {
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8));
        }
      `}
    >
      <Icon size='1.5rem' />
    </div>
  )
}
