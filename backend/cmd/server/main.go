package main

import (
	"log"
	"net/http"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"backend/pkg/crawler"
	"backend/pkg/logger"
	"backend/pkg/storage"
	"backend/pkg/types"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
)

// 全局变量
var (
	priceStorage storage.Storage
	priceMutex   sync.RWMutex
	lastUpdate   time.Time
	startTime    time.Time // 记录服务启动时间

	// 统计指标
	apiCalls    int64 // API调用次数
	updateCount int64 // 更新次数
	lastError   error // 最后一次错误
	errorCount  int64 // 错误次数

	// 监控指标
	apiLatency    []time.Duration // API响应时间
	latencyMutex  sync.RWMutex
	maxLatencyLen = 1000 // 保留最近1000次请求的延迟数据
)

// 更新价格信息
func updatePriceInfo() error {
	logger.InfoLogger.Println("开始更新价格信息...")
	crawler := crawler.NewCarbonCrawler()

	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		logger.ErrorLogger.Printf("获取价格信息失败: %v", err)
		atomic.AddInt64(&errorCount, 1)
		lastError = err
		return err
	}

	// 转换为 types.PriceInfo
	lastUpdated, _ := time.Parse(time.RFC3339, priceInfo.LastUpdated)
	priceInfoType := types.PriceInfo{
		Price:         priceInfo.Price,
		Date:          priceInfo.Date,
		DailyChange:   priceInfo.DailyChange,
		MonthlyChange: priceInfo.MonthlyChange,
		YearlyChange:  priceInfo.YearlyChange,
		LastUpdated:   lastUpdated,
	}

	// 保存到内存存储
	priceMutex.Lock()
	if err := priceStorage.Save(priceInfoType); err != nil {
		priceMutex.Unlock()
		logger.ErrorLogger.Printf("保存价格信息失败: %v", err)
		atomic.AddInt64(&errorCount, 1)
		lastError = err
		return err
	}
	lastUpdate = time.Now()
	priceMutex.Unlock()

	atomic.AddInt64(&updateCount, 1)
	logger.InfoLogger.Printf("价格信息已更新: 价格=%.2f, 日期=%s, 日涨跌幅=%.2f%%, 月涨跌幅=%.2f%%, 年涨跌幅=%.2f%%",
		priceInfo.Price,
		priceInfo.Date,
		priceInfo.DailyChange,
		priceInfo.MonthlyChange,
		priceInfo.YearlyChange)
	return nil
}

// 记录API延迟
func recordLatency(duration time.Duration) {
	latencyMutex.Lock()
	defer latencyMutex.Unlock()

	apiLatency = append(apiLatency, duration)
	if len(apiLatency) > maxLatencyLen {
		apiLatency = apiLatency[1:]
	}
}

// 计算延迟统计
func calculateLatencyStats() map[string]interface{} {
	latencyMutex.RLock()
	defer latencyMutex.RUnlock()

	if len(apiLatency) == 0 {
		return map[string]interface{}{
			"count": 0,
		}
	}

	var total time.Duration
	var max time.Duration
	var min = apiLatency[0]

	for _, d := range apiLatency {
		total += d
		if d > max {
			max = d
		}
		if d < min {
			min = d
		}
	}

	avg := total / time.Duration(len(apiLatency))

	return map[string]interface{}{
		"count":    len(apiLatency),
		"avg_ms":   avg.Milliseconds(),
		"max_ms":   max.Milliseconds(),
		"min_ms":   min.Milliseconds(),
		"total_ms": total.Milliseconds(),
	}
}

func main() {
	// 记录启动时间
	startTime = time.Now()

	// 初始化日志
	if err := logger.InitLogger(); err != nil {
		log.Fatalf("初始化日志失败: %v", err)
	}

	logger.InfoLogger.Println("程序启动...")

	// 初始化内存存储
	priceStorage = storage.NewMemoryStorage()
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

	// 健康检查接口
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// 监控指标接口
	r.GET("/metrics", func(c *gin.Context) {
		priceMutex.RLock()
		latestPrice := priceStorage.GetLatest()
		priceMutex.RUnlock()

		// 获取内存统计
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		c.JSON(200, gin.H{
			"timestamp": time.Now().Format(time.RFC3339),
			"system": gin.H{
				"uptime":     time.Since(startTime).String(),
				"version":    "1.0.0",
				"goVersion":  runtime.Version(),
				"goroutines": runtime.NumGoroutine(),
				"memory": gin.H{
					"alloc":       m.Alloc / 1024 / 1024,      // MB
					"totalAlloc":  m.TotalAlloc / 1024 / 1024, // MB
					"sys":         m.Sys / 1024 / 1024,        // MB
					"numGC":       m.NumGC,
					"heapObjects": m.HeapObjects,
					"heapAlloc":   m.HeapAlloc / 1024 / 1024, // MB
				},
				"cpu": gin.H{
					"numCPU": runtime.NumCPU(),
				},
			},
			"api": gin.H{
				"calls":     atomic.LoadInt64(&apiCalls),
				"errors":    atomic.LoadInt64(&errorCount),
				"lastError": lastError,
				"latency":   calculateLatencyStats(),
			},
			"data": gin.H{
				"lastUpdate":  lastUpdate.Format(time.RFC3339),
				"hasData":     latestPrice != nil,
				"updateCount": atomic.LoadInt64(&updateCount),
			},
		})
	})

	// API路由
	r.GET("/api/carbon-price", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("收到获取价格请求")
		priceMutex.RLock()
		priceInfo := priceStorage.GetLatest()
		priceMutex.RUnlock()

		if priceInfo == nil {
			logger.ErrorLogger.Println("暂无价格信息")
			atomic.AddInt64(&errorCount, 1)
			c.JSON(404, gin.H{"error": "暂无价格信息"})
			return
		}
		logger.InfoLogger.Printf("返回价格信息: %+v", priceInfo)
		c.JSON(200, priceInfo)
		recordLatency(time.Since(start))
	})

	r.GET("/api/carbon-price/history", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("收到获取历史记录请求")
		priceMutex.RLock()
		history := priceStorage.GetHistory()
		priceMutex.RUnlock()
		c.JSON(200, history)
		recordLatency(time.Since(start))
	})

	r.POST("/api/carbon-price/update", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("收到手动更新请求")
		if err := updatePriceInfo(); err != nil {
			logger.ErrorLogger.Printf("手动更新失败: %v", err)
			atomic.AddInt64(&errorCount, 1)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		priceMutex.RLock()
		priceInfo := priceStorage.GetLatest()
		priceMutex.RUnlock()
		logger.InfoLogger.Printf("手动更新成功: %+v", priceInfo)
		c.JSON(200, gin.H{
			"message": "价格信息已更新",
			"data":    priceInfo,
		})
		recordLatency(time.Since(start))
	})

	// 设置定时任务
	logger.InfoLogger.Println("正在设置定时任务...")
	c := cron.New()
	// 每12小时执行一次更新（每天0点和12点），注意周末停牌获取不到数据
	_, err := c.AddFunc("0 0,12 * * *", func() {
		logger.InfoLogger.Println("执行定时更新...")
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
	port := os.Getenv("PORT")
	if port == "" {
		port = "10000" // fallback
	}
	logger.InfoLogger.Printf("服务器即将启动在 :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		logger.ErrorLogger.Fatalf("启动服务器失败: %v", err)
	}
}
