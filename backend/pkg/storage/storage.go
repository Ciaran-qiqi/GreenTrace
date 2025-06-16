package storage

import (
	"backend/pkg/types"
	"sync"
)

// Storage 定义存储接口
type Storage interface {
	Save(priceInfo types.PriceInfo) error
	GetLatest() *types.PriceInfo
	GetHistory() []types.PriceInfo
}

// MemoryStorage 内存存储实现
type MemoryStorage struct {
	latest  *types.PriceInfo
	history []types.PriceInfo
	mu      sync.RWMutex
}

// NewMemoryStorage 创建新的内存存储实例
func NewMemoryStorage() Storage {
	return &MemoryStorage{
		history: make([]types.PriceInfo, 0),
	}
}

// Save 保存价格信息到内存
func (ms *MemoryStorage) Save(priceInfo types.PriceInfo) error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	// 更新最新价格
	ms.latest = &priceInfo

	// 添加到历史记录
	ms.history = append(ms.history, priceInfo)

	// 只保留最近30天的数据
	if len(ms.history) > 30 {
		ms.history = ms.history[len(ms.history)-30:]
	}

	return nil
}

// GetLatest 获取最新价格信息
func (ms *MemoryStorage) GetLatest() *types.PriceInfo {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.latest
}

// GetHistory 获取历史价格信息
func (ms *MemoryStorage) GetHistory() []types.PriceInfo {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.history
}
