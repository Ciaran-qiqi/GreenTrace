// 测试API端点
const testAPI = async () => {
    try {
        console.log('Testing API endpoint...');
        const response = await fetch('https://greentrace-api.onrender.com/api/carbon-price');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (!data || !data.price) {
            throw new Error('Invalid response format - missing price field');
        }
        
        console.log('Price:', data.price);
        console.log('Price * 1e8:', Math.round(data.price * 1e8));
        console.log('API is working correctly!');
        
    } catch (error) {
        console.error('API Error:', error.message);
    }
};

// 运行测试
testAPI();