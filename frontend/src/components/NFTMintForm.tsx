import { useState } from 'react';
import { uploadFileToIPFS, uploadMetadataToIPFS, validateFile } from '@/src/utils/pinata';
import { useContract } from '@/src/hooks/useContract';
import { ethers } from 'ethers';

// ERC20 代币合约 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)"
];

export function NFTMintForm() {
  const [formData, setFormData] = useState({
    title: '',
    details: '',
    carbonReduction: '',
    image: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [approving, setApproving] = useState(false);

  const { contract } = useContract();

  // 检查并授权代币
  const checkAndApproveToken = async () => {
    if (!contract) return false;
    try {
      // 获取代币合约地址
      const tokenAddress = await contract.carbonToken();
      console.log('代币合约地址:', tokenAddress);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      // 获取当前用户的地址
      const userAddress = await signer.getAddress();
      
      // 检查当前授权额度
      const currentAllowance = await tokenContract.allowance(userAddress, contract.address);
      const requiredAmount = ethers.utils.parseEther("1000"); // 设置一个较大的授权额度
      
      console.log('当前授权额度:', ethers.utils.formatEther(currentAllowance));
      console.log('所需授权额度:', ethers.utils.formatEther(requiredAmount));
      
      if (currentAllowance.lt(requiredAmount)) {
        setApproving(true);
        try {
          // 授权合约使用代币
          const tx = await tokenContract.approve(contract.address, requiredAmount);
          console.log('授权交易已发送:', tx.hash);
          await tx.wait();
          console.log('授权交易已确认');
          setApproving(false);
          return true;
        } catch (error) {
          console.error('授权代币失败:', error);
          setApproving(false);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('检查代币授权失败:', error);
      return false;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        validateFile(e.target.files[0]);
        setFormData(prev => ({
          ...prev,
          image: e.target.files![0]
        }));
        setError('');
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      // 检查并授权代币
      const isApproved = await checkAndApproveToken();
      if (!isApproved) {
        throw new Error('代币授权失败，请重试');
      }

      // 1. 上传图片到IPFS
      setUploadProgress(20);
      const imageUrl = await uploadFileToIPFS(formData.image!);
      setUploadProgress(50);
      
      // 2. 创建元数据对象
      const metadata = {
        name: formData.title,
        description: formData.details,
        image: imageUrl,
        attributes: [
          {
            trait_type: "碳减排量",
            value: formData.carbonReduction
          },
          {
            trait_type: "创建时间",
            value: new Date().toISOString()
          }
        ]
      };

      // 3. 上传元数据到IPFS
      setUploadProgress(70);
      const metadataUrl = await uploadMetadataToIPFS(metadata);
      setUploadProgress(90);
      
      // 4. 调用合约请求铸造NFT
      if (!contract) {
        throw new Error('合约未初始化');
      }
      const tx = await contract.requestMintNFT(
        formData.title,
        formData.details,
        formData.carbonReduction,
        metadataUrl
      );
      
      await tx.wait();
      setUploadProgress(100);
      
      // 重置表单
      setFormData({
        title: '',
        details: '',
        carbonReduction: '',
        image: null,
      });
      
      // 显示成功消息
      alert('NFT铸造申请已提交！');
    } catch (error) {
      console.error('Error minting NFT:', error);
      setError('铸造NFT时发生错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          故事标题
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          故事详情
        </label>
        <textarea
          value={formData.details}
          onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          碳减排量
        </label>
        <input
          type="number"
          value={formData.carbonReduction}
          onChange={(e) => setFormData(prev => ({ ...prev, carbonReduction: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          上传图片
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1 block w-full"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          支持 JPG, PNG 和 GIF 格式，最大 5MB
        </p>
      </div>

      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-green-600 h-2.5 rounded-full" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || approving}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
      >
        {approving ? '授权代币中...' : loading ? '处理中...' : '申请铸造NFT'}
      </button>
    </form>
  );
} 