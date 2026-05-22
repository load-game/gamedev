import { customAlphabet } from 'nanoid'

const ALPHABET = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * We use 10 character ids for a compact network-friendly identifier with a
 * low enough collision probability for runtime-created objects.
 */
export const uuid = customAlphabet(ALPHABET, 10)
