package main

import (
	"log"
	"sync"

	"backend/configs"
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
	logger.InfoLogger.Println("开始更新价格信息...")
	crawler := crawler.NewCarbonCrawler()

	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		logger.ErrorLogger.Printf("获取价格信息失败: %v", err)
		return err
	}

	// 保存到存储
	if err := priceStorage.Save(*priceInfo); err != nil {
		logger.ErrorLogger.Printf("保存价格信息失败: %v", err)
		return err
	}

	logger.InfoLogger.Printf("价格信息已更新: 价格=%.2f, 日期=%s, 日涨跌幅=%.2f%%, 月涨跌幅=%.2f%%, 年涨跌幅=%.2f%%",
		priceInfo.Price,
		priceInfo.Date,
		priceInfo.DailyChange,
		priceInfo.MonthlyChange,
		priceInfo.YearlyChange)
	return nil
}

func main() {
	// 初始化配置
	config := configs.NewConfig()

	// 初始化日志
	if err := logger.InitLogger(config.GetLoggerConfig()); err != nil {
		log.Fatalf("初始化日志失败: %v", err)
	}

	// 现在可以安全使用 logger
	logger.InfoLogger.Println("程序启动...")
	logger.InfoLogger.Println("配置初始化完成")

	// 初始化存储
	logger.InfoLogger.Println("正在初始化存储...")
	var err error
	priceStorage, err = storage.NewStorage(config.GetStorageConfig())
	if err != nil {
		logger.ErrorLogger.Fatalf("初始化存储失败: %v", err)
	}
	logger.InfoLogger.Println("存储初始化完成")

	// 创建Gin路由
	logger.InfoLogger.Println("正在创建Gin路由...")
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
		logger.InfoLogger.Println("收到获取价格请求")
		priceInfo := priceStorage.GetLatest()
		if priceInfo == nil {
			logger.ErrorLogger.Println("暂无价格信息")
			c.JSON(404, gin.H{"error": "暂无价格信息"})
			return
		}
		logger.InfoLogger.Printf("返回价格信息: %+v", priceInfo)
		c.JSON(200, priceInfo)
	})

	r.GET("/api/carbon-price/history", func(c *gin.Context) {
		logger.InfoLogger.Println("收到获取历史记录请求")
		history := priceStorage.GetHistory()
		c.JSON(200, history)
	})

	r.POST("/api/carbon-price/update", func(c *gin.Context) {
		logger.InfoLogger.Println("收到手动更新请求")
		if err := updatePriceInfo(); err != nil {
			logger.ErrorLogger.Printf("手动更新失败: %v", err)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		priceInfo := priceStorage.GetLatest()
		logger.InfoLogger.Printf("手动更新成功: %+v", priceInfo)
		c.JSON(200, gin.H{
			"message": "价格信息已更新",
			"data":    priceInfo,
		})
	})

	// 设置定时任务
	logger.InfoLogger.Println("正在设置定时任务...")
	c := cron.New()
	// 每12小时执行一次更新（每天0点和12点）
	_, err = c.AddFunc("0 0,12 * * 1-5", func() {
		logger.InfoLogger.Println("执行定时更新，注意周末停牌...")
		if err := updatePriceInfo(); err != nil {
			logger.ErrorLogger.Printf("定时更新失败: %v", err)
		}
	})
	if err != nil {
		logger.ErrorLogger.Fatalf("设置定时任务失败: %v", err)
	}
	c.Start()
	logger.InfoLogger.Println("定时任务设置完成")

	// 首次运行立即更新一次价格信息
	logger.InfoLogger.Println("开始首次更新...")
	if err := updatePriceInfo(); err != nil {
		logger.ErrorLogger.Printf("首次更新失败: %v", err)
	}

	// 启动服务器
	port := "5000"
	logger.InfoLogger.Printf("服务器即将启动在 http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		logger.ErrorLogger.Fatalf("启动服务器失败: %v", err)
	}
}
