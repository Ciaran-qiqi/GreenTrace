package main

import (
	"fmt"
	"log"
	"sync"

	"backend/pkg/crawler"
	"backend/pkg/logger"
	"backend/pkg/storage"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
)

// 全局变量
var (
	priceStorage *storage.Storage
	priceMutex   sync.RWMutex
)

// 更新价格信息
func updatePriceInfo() error {
	fmt.Println("开始更新价格信息...") // 添加调试日志
	crawler := crawler.NewCarbonCrawler()
	fmt.Println("爬虫实例已创建") // 添加调试日志

	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		fmt.Printf("获取价格信息失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Printf("获取价格信息失败: %v", err)
		return err
	}

	fmt.Printf("成功获取价格信息: %+v\n", priceInfo) // 添加调试日志

	// 保存到存储
	if err := priceStorage.Save(*priceInfo); err != nil {
		fmt.Printf("保存价格信息失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Printf("保存价格信息失败: %v", err)
		return err
	}

	logger.InfoLogger.Printf("价格信息已更新: %+v", priceInfo)
	return nil
}

func main() {
	fmt.Println("程序启动...") // 添加调试日志

	// 初始化日志
	fmt.Println("正在初始化日志...") // 添加调试日志
	if err := logger.InitLogger(); err != nil {
		fmt.Printf("初始化日志失败: %v\n", err) // 添加调试日志
		log.Fatalf("初始化日志失败: %v", err)
	}
	fmt.Println("日志初始化完成") // 添加调试日志

	// 初始化存储
	fmt.Println("正在初始化存储...") // 添加调试日志
	var err error
	priceStorage, err = storage.NewStorage()
	if err != nil {
		fmt.Printf("初始化存储失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Fatalf("初始化存储失败: %v", err)
	}
	fmt.Println("存储初始化完成") // 添加调试日志

	// 创建Gin路由
	fmt.Println("正在创建Gin路由...") // 添加调试日志
	r := gin.Default()

	// 设置CORS
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// API路由
	r.GET("/api/carbon-price", func(c *gin.Context) {
		fmt.Println("收到获取价格请求") // 添加调试日志
		priceInfo := priceStorage.GetLatest()
		if priceInfo == nil {
			fmt.Println("暂无价格信息") // 添加调试日志
			c.JSON(404, gin.H{"error": "暂无价格信息"})
			return
		}
		fmt.Printf("返回价格信息: %+v\n", priceInfo) // 添加调试日志
		c.JSON(200, priceInfo)
	})

	r.GET("/api/carbon-price/history", func(c *gin.Context) {
		fmt.Println("收到获取历史记录请求") // 添加调试日志
		history := priceStorage.GetHistory()
		c.JSON(200, history)
	})

	r.POST("/api/carbon-price/update", func(c *gin.Context) {
		fmt.Println("收到手动更新请求") // 添加调试日志
		if err := updatePriceInfo(); err != nil {
			fmt.Printf("手动更新失败: %v\n", err) // 添加调试日志
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		priceInfo := priceStorage.GetLatest()
		c.JSON(200, gin.H{
			"message": "价格信息已更新",
			"data":    priceInfo,
		})
	})

	// 设置定时任务
	fmt.Println("正在设置定时任务...") // 添加调试日志
	c := cron.New()
	// 每12小时执行一次更新（每天0点和12点）
	_, err = c.AddFunc("0 0,12 * * *", func() {
		fmt.Println("执行定时更新...") // 添加调试日志
		logger.InfoLogger.Println("执行定时更新...")
		if err := updatePriceInfo(); err != nil {
			fmt.Printf("定时更新失败: %v\n", err) // 添加调试日志
			logger.ErrorLogger.Printf("更新失败: %v", err)
		}
	})
	if err != nil {
		fmt.Printf("设置定时任务失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Fatalf("设置定时任务失败: %v", err)
	}
	c.Start()
	fmt.Println("定时任务设置完成") // 添加调试日志

	// 首次运行立即更新一次价格信息
	fmt.Println("开始首次更新...") // 添加调试日志
	if err := updatePriceInfo(); err != nil {
		fmt.Printf("首次更新失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Printf("首次更新失败: %v", err)
	}

	// 启动服务器
	port := "5000"
	fmt.Printf("服务器即将启动在 http://localhost:%s\n", port) // 添加调试日志
	logger.InfoLogger.Printf("服务器运行在 http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("启动服务器失败: %v\n", err) // 添加调试日志
		logger.ErrorLogger.Fatalf("启动服务器失败: %v", err)
	}
}
