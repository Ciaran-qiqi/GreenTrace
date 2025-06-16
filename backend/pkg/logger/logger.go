package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"backend/configs"
)

var (
	InfoLogger  *log.Logger
	ErrorLogger *log.Logger
)

// InitLogger 初始化日志记录器
func InitLogger(config *configs.LoggerConfig) error {
	if config == nil {
		config = &configs.LoggerConfig{
			LogDir: "internal/logs",
		}
	}

	// 创建logs目录
	if err := os.MkdirAll(config.LogDir, 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %v", err)
	}

	// 生成日志文件名，格式：logs/carbon_2024-03-21.log
	logFile := filepath.Join(config.LogDir, fmt.Sprintf("carbon_%s.log", time.Now().Format("2006-01-02")))

	// 打开日志文件
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %v", err)
	}

	// 创建多输出写入器
	infoWriter := io.MultiWriter(os.Stdout, file)
	errorWriter := io.MultiWriter(os.Stderr, file)

	// 初始化日志记录器
	InfoLogger = log.New(infoWriter, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	ErrorLogger = log.New(errorWriter, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)

	// 记录初始化成功信息
	InfoLogger.Println("日志系统初始化成功")

	return nil
}
