export function createLogger(prefix, options = {}) {
  const { level = 'info', enableColors = true, timestamp = true, enableEmojis = true } = options

  const logLevels = { debug: 0, info: 1, warn: 2, error: 3 }
  const currentLogLevel = logLevels[level] || 1

  const colors = enableColors ? {
    reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m', green: '\x1b[32m'
  } : { reset: '', dim: '', red: '', yellow: '', blue: '', cyan: '', green: '' }

  const emojis = enableEmojis ? {
    debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅',
    network: '🌐', transaction: '💰', sync: '🔄'
  } : { debug: '', info: '', warn: '', error: '', success: '', network: '', transaction: '', sync: '' }

  function log(level, msg, args = [], customEmoji = null) {
    if (logLevels[level] < currentLogLevel) return

    const time = timestamp ? new Date().toISOString().slice(11, 23) : ''
    const emoji = customEmoji || emojis[level] || ''
    const colorCode = colors[level] || colors.blue
    const formattedPrefix = timestamp && time
      ? `${colors.dim}${time}${colors.reset} ${colorCode}[${prefix}]${colors.reset}`
      : `${colorCode}[${prefix}]${colors.reset}`

    const formattedArgs = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)
    console.log(formattedPrefix, `${emoji} ${msg}`, ...formattedArgs)
  }

  return {
    log: (msg, ...args) => log('info', msg, args),
    debug: (msg, ...args) => log('debug', msg, args),
    info: (msg, ...args) => log('info', msg, args),
    warn: (msg, ...args) => log('warn', msg, args),
    error: (msg, ...args) => log('error', msg, args),
    success: (msg, ...args) => log('info', msg, args, emojis.success),
    network: (msg, ...args) => log('info', msg, args, emojis.network),
    transaction: (msg, ...args) => log('info', msg, args, emojis.transaction)
  }
}

export const web3Logger = createLogger('Web3', {
  level: 'info',
  enableColors: true,
  timestamp: true,
  enableEmojis: true
})

export const evmLogger = createLogger('EVM', {
  level: 'info',
  enableColors: true,
  timestamp: true,
  enableEmojis: false
})

export const dojoLogger = createLogger('DojoSystem', {
  level: 'info',
  enableColors: true,
  timestamp: true,
  enableEmojis: true
})
