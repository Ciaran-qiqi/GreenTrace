package configs

import (
	"os"
	"path/filepath"
)

// Config 全局配置结构体
type Config struct {
	// 基础路径配置
	BaseDir string // 项目根目录
	DataDir string // 数据存储目录
	LogDir  string // 日志存储目录
}

// NewConfig 创建新的配置实例
func NewConfig() *Config {
	// 获取项目根目录
	baseDir, err := os.Getwd()
	if err != nil {
		baseDir = "."
	}

	// 创建默认配置
	config := &Config{
		BaseDir: baseDir,
		DataDir: filepath.Join(baseDir, "internal", "data"),
		LogDir:  filepath.Join(baseDir, "internal", "logs"),
	}

	// 从环境变量读取配置（如果存在）
	if dataDir := os.Getenv("GREENTRACE_DATA_DIR"); dataDir != "" {
		config.DataDir = dataDir
	}
	if logDir := os.Getenv("GREENTRACE_LOG_DIR"); logDir != "" {
		config.LogDir = logDir
	}

	// 确保目录存在
	os.MkdirAll(config.DataDir, 0755)
	os.MkdirAll(config.LogDir, 0755)

	return config
}

// GetLoggerConfig 获取日志配置
func (c *Config) GetLoggerConfig() *LoggerConfig {
	return &LoggerConfig{
		LogDir: c.LogDir,
	}
}

// GetStorageConfig 获取存储配置
func (c *Config) GetStorageConfig() *StorageConfig {
	return &StorageConfig{
		DataDir: c.DataDir,
	}
}

// LoggerConfig 日志配置
type LoggerConfig struct {
	LogDir string
}

// StorageConfig 存储配置
type StorageConfig struct {
	DataDir string
}
