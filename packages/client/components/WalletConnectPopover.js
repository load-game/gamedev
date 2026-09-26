import { UserIcon } from 'lucide-react'
import { PlayerPanel } from './PlayerPanel.js'

export function WalletConnectPopover({ world, auth, onClose, onSelect }) {
  const availability = auth?.providerAvailability || {
    ethereum: !!auth?.providerAvailable,
    solana: false,
  }

  const options = [
    {
      key: 'ethereum',
      label: 'Ethereum',
      available: !!availability.ethereum,
      selection: { chain: 'ethereum' },
    },
    {
      key: 'solana-mainnet',
      label: 'Solana',
      available: !!availability.solana,
      selection: { chain: 'solana', network: 'mainnet' },
    },
  ]

  return (
    <PlayerPanel
      world={world}
      title='Connect wallet!'
      icon={UserIcon}
      compact
      onClose={onClose}
      dismissible={!auth?.pending}
    >
      <div className='player-panel-stack'>
        {options.map(option => (
          <button
            key={option.key}
            type='button'
            className={`menu-button menu-label${option.key === 'ethereum' ? ' primary' : ''}`}
            disabled={auth?.pending || !option.available}
            onClick={() => onSelect?.(option.selection)}
          >
            {option.label}
            {!option.available && ' (Unavailable)'}
          </button>
        ))}
      </div>
    </PlayerPanel>
  )
}
