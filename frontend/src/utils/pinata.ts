// 上传文件到IPFS
export async function uploadFileToIPFS(file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
      },
      body: formData
    });

    const data = await response.json();
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    throw error;
  }
}

// 上传JSON元数据到IPFS
export async function uploadMetadataToIPFS(metadata: {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}) {
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
      },
      body: JSON.stringify(metadata)
    });

    const data = await response.json();
    return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading metadata to IPFS:', error);
    throw error;
  }
}

// 检查文件类型和大小
export function validateFile(file: File) {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    throw new Error('只支持 JPG, PNG 和 GIF 格式的图片');
  }

  if (file.size > maxSize) {
    throw new Error('图片大小不能超过 5MB');
  }
} 