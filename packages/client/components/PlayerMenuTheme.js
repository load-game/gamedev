import { css } from '@firebolt-dev/css'
import { useEffect, useState } from 'react'

let fontId = 0

export function useMenuTheme(world) {
  const [tokens, setTokens] = useState(() => world.ui.state.menuTheme)
  const [font, setFont] = useState(null)
  useEffect(() => {
    world.on('menu-theme', setTokens)
    return () => world.off('menu-theme', setTokens)
  }, [world])
  useEffect(() => {
    setFont(null)
    if (!tokens?.fontUrl || typeof FontFace === 'undefined') return
    let disposed = false
    const face = new FontFace(`PlayerMenu${++fontId}`, `url("${world.resolveURL(tokens.fontUrl)}")`)
    face
      .load()
      .then(() => {
        if (disposed) return
        document.fonts.add(face)
        setFont(face.family)
      })
      .catch(() => {})
    return () => {
      disposed = true
      document.fonts.delete(face)
    }
  }, [world, tokens?.fontUrl])
  const style = {}
  for (const [key, value] of Object.entries(tokens || {})) {
    if (key === 'fontUrl' || key === 'uppercase') continue
    const name = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    style[`--menu-${name}`] = typeof value === 'number' ? `${value}px` : value
  }
  if (tokens?.uppercase) style['--menu-case'] = 'uppercase'
  if (font) style['--menu-font'] = `"${font}", sans-serif`
  return style
}

export const menuStyles = css`
  font-family: var(--menu-font, inherit);
  color: var(--menu-text, #fff);
  text-transform: var(--menu-case, none);
  button,
  input,
  select {
    font-family: inherit;
    color: inherit;
    font-size: inherit;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--menu-text, #fff);
    outline-offset: 3px;
  }
  .menu-label {
    paint-order: stroke fill;
    -webkit-text-stroke: var(--menu-text-outline, 0px) var(--menu-outline, #000);
  }
  .menu-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 3.5rem;
    padding: 0.5rem 1rem calc(0.5rem + var(--menu-button-depth, 0px));
    border: var(--menu-border-width, 1px) solid var(--menu-outline, #3c4350);
    border-radius: var(--menu-radius, 6px);
    background: linear-gradient(var(--menu-secondary-top, #384150), var(--menu-secondary-bottom, #242b37));
    box-shadow: inset 0 calc(-1 * var(--menu-button-depth, 0px)) 0 var(--menu-secondary-shadow, #161d28);
    font-size: 1.375rem;
    text-transform: var(--menu-case, none);
  }
  .menu-button.primary,
  .menu-button[aria-pressed='true'] {
    background: linear-gradient(var(--menu-primary-top, #5787c2), var(--menu-primary-bottom, #335c90));
    box-shadow: inset 0 calc(-1 * var(--menu-button-depth, 0px)) 0 var(--menu-primary-shadow, #1d3a60);
  }
  .menu-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .menu-button:active:not(:disabled) {
    transform: translateY(2px);
  }
  .menu-icon-button {
    width: 3.5rem;
    height: 3.5rem;
    padding: 0.5rem;
  }
  .menu-icon-button svg {
    width: 1.65rem;
    height: 1.65rem;
    flex: none;
  }
  .menu-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background: var(--menu-card, #141923);
    border: 2px solid var(--menu-border, #303744);
    border-radius: var(--menu-radius, 6px);
    min-height: 4.5rem;
    font-size: 1.25rem;
  }
  .menu-card > .menu-label {
    flex: 1;
  }
  .menu-card .menu-button {
    min-height: 2.625rem;
    min-width: 9rem;
    font-size: 1.125rem;
  }
  .menu-card input[type='text'],
  .menu-card select {
    width: min(50%, 18rem);
    border: 2px solid var(--menu-outline, #303744);
    border-radius: var(--menu-radius, 6px);
    background: var(--menu-secondary-bottom, #242b37);
    padding: 0.65rem 0.75rem;
    min-height: 2.75rem;
    font-size: 1.125rem;
    text-align: center;
  }
  .menu-card select {
    cursor: pointer;
    text-transform: var(--menu-case, none);
  }
  .menu-card option {
    color: white;
    background: #202631;
  }
  .menu-range {
    display: block;
    padding: 1rem;
  }
  .menu-range-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }
  .menu-range input {
    appearance: none;
    display: block;
    width: 100%;
    height: 1rem;
    margin: 1.4rem 0 1rem;
    border: 2px solid var(--menu-muted, #aeb8c4);
    border-radius: 1rem;
    cursor: pointer;
    background: linear-gradient(
      to right,
      var(--menu-primary-bottom, #5787c2) 0 var(--level),
      var(--menu-muted, #465261) var(--level) 100%
    );
  }
  .menu-range input::-webkit-slider-thumb {
    appearance: none;
    width: 1.75rem;
    height: 1.75rem;
    border: 3px solid var(--menu-outline, #111);
    border-radius: 7px;
    background: var(--menu-text, #fff);
  }
  .menu-range input::-moz-range-thumb {
    width: 1.4rem;
    height: 1.4rem;
    border: 3px solid var(--menu-outline, #111);
    border-radius: 7px;
    background: var(--menu-text, #fff);
  }
  .menu-range-scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--menu-muted, #aeb8c4);
  }
  .menu-status {
    color: var(--menu-primary-top, #92c0fa);
  }
  .menu-spinner {
    animation: menu-spin 1s linear infinite;
  }
  @keyframes menu-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .menu-spinner {
      animation: none;
    }
  }
`
