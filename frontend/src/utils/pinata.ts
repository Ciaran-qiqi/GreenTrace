// Pinata IPFS 上传工具函数

// Pinata API 配置
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

// 调试信息
console.log('Pinata JWT配置:', PINATA_JWT ? '已配置' : '未配置');

// NFT元数据接口
export interface NFTMetadata {
  name: string;           // NFT名称
  description: string;    // NFT描述
  image: string;          // 图片URL
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
  external_url?: string;  // 外部链接
  animation_url?: string; // 动画URL
}

// 上传文件到IPFS
export const uploadFileToIPFS = async (file: File): Promise<string> => {
  try {
    console.log('开始上传文件到IPFS...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasJWT: !!PINATA_JWT
    });

    if (!PINATA_JWT) {
      throw new Error('Pinata JWT token未配置');
    }

    const formData = new FormData();
    formData.append('file', file);

    console.log('发送请求到Pinata API...');
    
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: formData,
    });

    console.log('Pinata API响应:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata API错误响应:', errorText);
      throw new Error(`上传失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('上传成功，返回数据:', data);
    
    const ipfsUrl = `ipfs://${data.IpfsHash}`;
    console.log('生成的IPFS URL:', ipfsUrl);
    
    return ipfsUrl;
  } catch (error) {
    console.error('上传文件到IPFS失败:', error);
    
    // 提供更详细的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('网络连接失败，请检查网络连接或稍后重试');
    }
    
    if (error instanceof Error) {
      throw new Error(`文件上传失败: ${error.message}`);
    }
    
    throw new Error('文件上传失败，请重试');
  }
};

// 上传JSON元数据到IPFS
export const uploadMetadataToIPFS = async (metadata: NFTMetadata): Promise<string> => {
  try {
    console.log('开始上传元数据到IPFS...', metadata);

    if (!PINATA_JWT) {
      throw new Error('Pinata JWT token未配置');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify(metadata),
    });

    console.log('元数据上传响应:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('元数据上传错误响应:', errorText);
      throw new Error(`元数据上传失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('元数据上传成功，返回数据:', data);
    
    const ipfsUrl = `ipfs://${data.IpfsHash}`;
    console.log('生成的元数据IPFS URL:', ipfsUrl);
    
    return ipfsUrl;
  } catch (error) {
    console.error('上传元数据到IPFS失败:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('网络连接失败，请检查网络连接或稍后重试');
    }
    
    if (error instanceof Error) {
      throw new Error(`元数据上传失败: ${error.message}`);
    }
    
    throw new Error('元数据上传失败，请重试');
  }
};

// 生成NFT元数据
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
        trait_type: "碳减排量",
        value: `${carbonReduction} tCO₂e`
      },
      {
        trait_type: "创建时间",
        value: new Date(createTime * 1000).toISOString()
      },
      {
        trait_type: "环保类型",
        value: "绿色行为"
      },
      {
        trait_type: "认证状态",
        value: "待审计"
      }
    ],
    external_url: "https://greentrace.xyz",
  };
};

// 验证文件类型和大小
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: '只支持 JPG, PNG, GIF, WebP 格式的图片'
    };
  }

  // 检查文件大小 (最大 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '文件大小不能超过 10MB'
    };
  }

  return { valid: true };
}; 