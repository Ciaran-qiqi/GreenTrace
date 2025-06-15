package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"backend/pkg/models"
)

// Storage 数据存储结构体
type Storage struct {
	mu   sync.RWMutex
	path string
	data []models.PriceInfo
}

// NewStorage 创建新的存储实例
func NewStorage() (*Storage, error) {
	// 创建data目录
	if err := os.MkdirAll("data", 0755); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %v", err)
	}

	path := filepath.Join("data", "carbon_prices.json")
	storage := &Storage{
		path: path,
		data: make([]models.PriceInfo, 0),
	}

	// 如果文件存在，加载历史数据
	if _, err := os.Stat(path); err == nil {
		if err := storage.load(); err != nil {
			return nil, fmt.Errorf("加载历史数据失败: %v", err)
		}
	}

	return storage, nil
}

// Save 保存价格信息
func (s *Storage) Save(priceInfo models.PriceInfo) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 添加到数据列表
	s.data = append(s.data, priceInfo)

	// 保存到文件
	return s.save()
}

// GetLatest 获取最新的价格信息
func (s *Storage) GetLatest() *models.PriceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.data) == 0 {
		return nil
	}
	return &s.data[len(s.data)-1]
}

// GetHistory 获取历史价格信息
func (s *Storage) GetHistory() []models.PriceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.data
}

// save 保存数据到文件
func (s *Storage) save() error {
	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化数据失败: %v", err)
	}

	if err := os.WriteFile(s.path, data, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %v", err)
	}

	return nil
}

// load 从文件加载数据
func (s *Storage) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return fmt.Errorf("读取文件失败: %v", err)
	}

	if err := json.Unmarshal(data, &s.data); err != nil {
		return fmt.Errorf("解析数据失败: %v", err)
	}

	return nil
}
