// Pinata IPFS upload utility functions

// Pinata API configuration
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

// Debug info
console.log('Pinata JWT config:', PINATA_JWT ? 'Configured' : 'Not configured');

// NFT metadata interface
export interface NFTMetadata {
  name: string;           // NFT name
  description: string;    // NFT description
  image: string;          // Image URL
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
  external_url?: string;  // External link
  animation_url?: string; // Animation URL
}

// Upload file to IPFS
export const uploadFileToIPFS = async (file: File): Promise<string> => {
  try {
    console.log('Start uploading file to IPFS...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasJWT: !!PINATA_JWT
    });

    if (!PINATA_JWT) {
      throw new Error('Pinata JWT token not configured');
    }

    const formData = new FormData();
    formData.append('file', file);

    console.log('Sending request to Pinata API...');
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    console.log('Pinata API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata API error response:', errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Upload successful, response data:', data);
    
    const ipfsUrl = `ipfs://${data.IpfsHash}`;
    console.log('Generated IPFS URL:', ipfsUrl);
    
    return ipfsUrl;
  } catch (error) {
    console.error('Failed to upload file to IPFS:', error);
    
    // Provide more detailed error info
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network connection failed, please check your network or try again later');
    }
    
    if (error instanceof Error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
    
    throw new Error('File upload failed, please try again');
  }
};

// Upload JSON metadata to IPFS
export const uploadMetadataToIPFS = async (metadata: NFTMetadata): Promise<string> => {
  try {
    console.log('Start uploading metadata to IPFS...', metadata);

    if (!PINATA_JWT) {
      throw new Error('Pinata JWT token not configured');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(metadata),
    });

    console.log('Metadata upload response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Metadata upload error response:', errorText);
      throw new Error(`Metadata upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Metadata upload successful, response data:', data);
    
    const ipfsUrl = `ipfs://${data.IpfsHash}`;
    console.log('Generated metadata IPFS URL:', ipfsUrl);
    
    return ipfsUrl;
  } catch (error) {
    console.error('Failed to upload metadata to IPFS:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network connection failed, please check your network or try again later');
    }
    
    if (error instanceof Error) {
      throw new Error(`Metadata upload failed: ${error.message}`);
    }
    
    throw new Error('Metadata upload failed, please try again');
  }
};

// Generate NFT metadata
export const generateNFTMetadata = (
  title: string,
  description: string,
  imageUrl: string,
  carbonReduction: number,
  createTime: number
): NFTMetadata => {
  return {
    name: title,
    description: description,
    image: imageUrl,
    attributes: [
      {
        trait_type: "Carbon Reduction",
        value: `${carbonReduction} tCO₂e`
      },
      {
        trait_type: "Created At",
        value: new Date(createTime * 1000).toISOString()
      },
      {
        trait_type: "Environmental Type",
        value: "Green Action"
      },
      {
        trait_type: "Certification Status",
        value: "Pending Audit"
      }
    ],
    external_url: "https://greentrace.xyz",
  };
};

// Validate file type and size
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPG, PNG, GIF, WebP images are supported'
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size cannot exceed 10MB'
    };
  }

  return { valid: true };
}; 