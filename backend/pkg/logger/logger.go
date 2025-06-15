package logger

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	InfoLogger  *log.Logger
	ErrorLogger *log.Logger
)

// InitLogger 初始化日志记录器
func InitLogger() error {
	// 创建logs目录
	if err := os.MkdirAll("logs", 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %v", err)
	}

	// 生成日志文件名，格式：logs/carbon_2024-03-21.log
	logFile := filepath.Join("logs", fmt.Sprintf("carbon_%s.log", time.Now().Format("2006-01-02")))

	// 打开日志文件
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %v", err)
	}

	// 初始化日志记录器
	InfoLogger = log.New(file, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	ErrorLogger = log.New(file, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)

	// 同时输出到控制台
	InfoLogger.SetOutput(os.Stdout)
	ErrorLogger.SetOutput(os.Stderr)

	return nil
}
