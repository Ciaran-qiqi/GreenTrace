/**
 * NFT Metadata Utility Functions
 * @description Handle NFT metadata fetching, parsing, and image extraction
 */

// IPFS gateway configuration
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

// NFT metadata interface
export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

/**
 * Convert IPFS URL to HTTP URL
 * @param ipfsUrl IPFS URL (ipfs://... or Qm...)
 * @returns HTTP accessible URL
 */
export function convertIpfsToHttp(ipfsUrl: string): string {
  if (!ipfsUrl) return '';

  // If already HTTP URL, return directly
  if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
    return ipfsUrl;
  }

  // Extract IPFS hash
  let hash = '';
  if (ipfsUrl.startsWith('ipfs://')) {
    hash = ipfsUrl.replace('ipfs://', '');
  } else if (ipfsUrl.startsWith('Qm') || ipfsUrl.startsWith('bafy')) {
    hash = ipfsUrl;
  } else {
    return ipfsUrl; // Unrecognized format, return as is
  }

  // Use the first IPFS gateway
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

/**
 * Fetch NFT metadata
 * @param tokenURI Token URI
 * @returns NFT metadata object
 */
export async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  if (!tokenURI) {
    console.warn('Token URI is empty');
    return null;
  }

  try {
    // Convert IPFS URL to HTTP URL
    const httpUrl = convertIpfsToHttp(tokenURI);
    console.log(`🎨 Fetching NFT metadata: ${httpUrl}`);

    // Try to fetch metadata
    const response = await fetch(httpUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Set timeout
      signal: AbortSignal.timeout(10000), // 10 seconds timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const metadata: NFTMetadata = await response.json();
    console.log('✅ NFT metadata fetched:', metadata);

    // Convert image URL to HTTP URL
    if (metadata.image) {
      metadata.image = convertIpfsToHttp(metadata.image);
    }

    return metadata;
  } catch (error) {
    console.error('❌ Failed to fetch NFT metadata:', error);
    return null;
  }
}

/**
 * Batch fetch NFT metadata
 * @param tokenURIs Array of Token URIs
 * @returns Array of metadata objects
 */
export async function fetchBatchNFTMetadata(tokenURIs: string[]): Promise<(NFTMetadata | null)[]> {
  console.log(`🎨 Start batch fetching ${tokenURIs.length} NFT metadata`);

  const promises = tokenURIs.map(async (tokenURI, index) => {
    try {
      // Add delay to avoid too frequent requests
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * index));
      }
      return await fetchNFTMetadata(tokenURI);
    } catch (error) {
      console.error(`Failed to fetch NFT metadata at index ${index}:`, error);
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  const metadata = results.map(result => 
    result.status === 'fulfilled' ? result.value : null
  );

  console.log(`✅ Batch fetch complete, success: ${metadata.filter(m => m !== null).length}/${tokenURIs.length}`);
  return metadata;
}

/**
 * Extract image URL from metadata
 * @param metadata NFT metadata
 * @returns Image URL or null
 */
export function extractImageUrl(metadata: NFTMetadata | null): string | null {
  if (!metadata) return null;
  return metadata.image || null;
}

/**
 * Generate default NFT image
 * @param tokenId Token ID
 * @returns Default image URL or data URL
 */
export function generateDefaultNFTImage(tokenId: string): string {
  // Can return a generated SVG or default image
  // Here returns a simple data URL, you can use more complex logic in real projects
  const emoji = getRandomGreenEmoji();
  
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#bg)"/>
      <text x="200" y="180" font-family="Arial" font-size="48" text-anchor="middle" fill="white" opacity="0.9">${emoji}</text>
      <text x="200" y="240" font-family="Arial" font-size="16" text-anchor="middle" fill="white" opacity="0.8">Green NFT</text>
      <text x="200" y="280" font-family="Arial" font-size="14" text-anchor="middle" fill="white" opacity="0.7">#${tokenId}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Get a random green-themed emoji
 */
function getRandomGreenEmoji(): string {
  const emojis = ['🌱', '🌿', '🍃', '🌳', '🌲', '🌴', '🌾', '🌵', '💚', '♻️'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

/**
 * Check if image URL is accessible
 * @param imageUrl Image URL
 * @returns Whether the image is accessible
 */
export async function isImageAccessible(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return false;
  
  try {
    const response = await fetch(imageUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 seconds timeout

    });
    return response.ok;
  } catch {
    return false;
  }
} 