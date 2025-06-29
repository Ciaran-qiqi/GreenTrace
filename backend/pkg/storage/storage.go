package storage

import (
	"backend/pkg/types"
	"sync"
)

// Storage defines storage interface
type Storage interface {
	Save(priceInfo types.PriceInfo) error
	GetLatest() *types.PriceInfo
	GetHistory() []types.PriceInfo
}

// MemoryStorage memory storage implementation
type MemoryStorage struct {
	latest  *types.PriceInfo
	history []types.PriceInfo
	mu      sync.RWMutex
}

// NewMemoryStorage create new memory storage instance
func NewMemoryStorage() Storage {
	return &MemoryStorage{
		history: make([]types.PriceInfo, 0),
	}
}

// Save save price info to memory
func (ms *MemoryStorage) Save(priceInfo types.PriceInfo) error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	// Update latest price
	ms.latest = &priceInfo

	// Add to history
	ms.history = append(ms.history, priceInfo)

	// Keep only recent 30 days data
	if len(ms.history) > 30 {
		ms.history = ms.history[len(ms.history)-30:]
	}

	return nil
}

// GetLatest get latest price info
func (ms *MemoryStorage) GetLatest() *types.PriceInfo {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.latest
}

// GetHistory get historical price info
func (ms *MemoryStorage) GetHistory() []types.PriceInfo {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.history
}
