// ===== ANIMATION URL HELPER =====
// Helper function to get animation URL based on configuration
function getAnimationUrl(animType) {
  const emoteKey = `${animType}Emote`
  console.log(`[pistol] Looking for ${animType} animation with key: ${emoteKey}`)
  console.log(`[pistol] ${emoteKey} value:`, props[emoteKey])

  if (props[emoteKey] && props[emoteKey].url) {
    const url = props[emoteKey].url
    console.log(`[pistol] ${animType} animation URL:`, url)

    // Validate URL to prevent crashes in VRM system
    try {
      // Check if URL is valid - support both asset:// and http:// URLs
      if (typeof url === 'string' && url.trim() && (url.startsWith('asset://') || url.startsWith('http'))) {
        console.log(`[pistol] Found valid ${animType} animation:`, url)
        return url
      } else {
        console.warn(`[pistol] Invalid ${animType} animation URL format:`, url)
      }
    } catch (error) {
      console.warn(`[pistol] Invalid ${animType} animation URL:`, url, error)
    }
  } else {
    console.log(`[pistol] No ${animType} animation configured`)
  }

  return null
}
