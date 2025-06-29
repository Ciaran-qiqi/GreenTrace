package main

import (
	"fmt"
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

// Global variables
var (
	priceStorage storage.Storage
	priceMutex   sync.RWMutex
	lastUpdate   time.Time
	startTime    time.Time // Service startup time

	// Statistics metrics
	apiCalls    int64 // API call count
	updateCount int64 // Update count
	lastError   error // Last error
	errorCount  int64 // Error count

	// Monitoring metrics
	apiLatency    []time.Duration // API response time
	latencyMutex  sync.RWMutex
	maxLatencyLen = 1000 // Keep recent 1000 request latency data
)

// Update price information
func updatePriceInfo() error {
	logger.InfoLogger.Println("Starting price update...")
	crawler := crawler.NewCarbonCrawler()

	priceInfo, err := crawler.FetchPrice()
	if err != nil {
		logger.ErrorLogger.Printf("Failed to get price info: %v", err)
		atomic.AddInt64(&errorCount, 1)
		lastError = err
		return err
	}

	// Convert to types.PriceInfo
	lastUpdated, _ := time.Parse(time.RFC3339, priceInfo.LastUpdated)
	priceInfoType := types.PriceInfo{
		Price:         priceInfo.Price,
		Date:          priceInfo.Date,
		DailyChange:   priceInfo.DailyChange,
		MonthlyChange: priceInfo.MonthlyChange,
		YearlyChange:  priceInfo.YearlyChange,
		LastUpdated:   lastUpdated,
	}

	// Save to memory storage
	priceMutex.Lock()
	if err := priceStorage.Save(priceInfoType); err != nil {
		priceMutex.Unlock()
		logger.ErrorLogger.Printf("Failed to save price info: %v", err)
		atomic.AddInt64(&errorCount, 1)
		lastError = err
		return err
	}
	lastUpdate = time.Now()
	priceMutex.Unlock()

	atomic.AddInt64(&updateCount, 1)
	logger.InfoLogger.Printf("Price info updated: price=%.2f, date=%s, daily_change=%.2f%%, monthly_change=%.2f%%, yearly_change=%.2f%%",
		priceInfo.Price,
		priceInfo.Date,
		priceInfo.DailyChange,
		priceInfo.MonthlyChange,
		priceInfo.YearlyChange)
	return nil
}

// Record API latency
func recordLatency(duration time.Duration) {
	latencyMutex.Lock()
	defer latencyMutex.Unlock()

	apiLatency = append(apiLatency, duration)
	if len(apiLatency) > maxLatencyLen {
		apiLatency = apiLatency[1:]
	}
}

// Calculate latency statistics
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
	// Record startup time
	startTime = time.Now()
	fmt.Println("=== Service startup begins ===")
	fmt.Printf("Go version: %s\n", runtime.Version())
	fmt.Printf("CPU cores: %d\n", runtime.NumCPU())

	// Initialize logger
	if err := logger.InitLogger(); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}

	// Initialize memory storage
	priceStorage = storage.NewMemoryStorage()
	fmt.Println("Storage initialization completed")

	// Create Gin router
	fmt.Println("Creating Gin router...")
	r := gin.Default()

	// Set CORS
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

	// Health check endpoint
	r.GET("/healthz", func(c *gin.Context) {
		fmt.Println("Received health check request")
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// Keep original /health endpoint for internal monitoring
	r.GET("/health", func(c *gin.Context) {
		priceMutex.RLock()
		latestPrice := priceStorage.GetLatest()
		priceMutex.RUnlock()

		status := "ok"
		if latestPrice == nil {
			status = "no_data"
		}

		c.JSON(200, gin.H{
			"status": status,
			"system": gin.H{
				"uptime":     time.Since(startTime).String(),
				"version":    "1.0.0",
				"goVersion":  runtime.Version(),
				"goroutines": runtime.NumGoroutine(),
			},
			"data": gin.H{
				"lastUpdate": lastUpdate.Format(time.RFC3339),
				"hasData":    latestPrice != nil,
			},
		})
	})

	// Monitoring metrics endpoint
	r.GET("/metrics", func(c *gin.Context) {
		priceMutex.RLock()
		latestPrice := priceStorage.GetLatest()
		priceMutex.RUnlock()

		// Get memory statistics
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

	// API routes
	r.GET("/api/carbon-price", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("Received price request")
		priceMutex.RLock()
		priceInfo := priceStorage.GetLatest()
		priceMutex.RUnlock()

		if priceInfo == nil {
			logger.ErrorLogger.Println("No price info available")
			atomic.AddInt64(&errorCount, 1)
			c.JSON(404, gin.H{"error": "No price info available"})
			return
		}
		logger.InfoLogger.Printf("Returning price info: %+v", priceInfo)
		c.JSON(200, priceInfo)
		recordLatency(time.Since(start))
	})

	r.GET("/api/carbon-price/history", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("Received history request")
		priceMutex.RLock()
		history := priceStorage.GetHistory()
		priceMutex.RUnlock()
		c.JSON(200, history)
		recordLatency(time.Since(start))
	})

	r.POST("/api/carbon-price/update", func(c *gin.Context) {
		start := time.Now()
		atomic.AddInt64(&apiCalls, 1)
		logger.InfoLogger.Println("Received manual update request")
		if err := updatePriceInfo(); err != nil {
			logger.ErrorLogger.Printf("Manual update failed: %v", err)
			atomic.AddInt64(&errorCount, 1)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		priceMutex.RLock()
		priceInfo := priceStorage.GetLatest()
		priceMutex.RUnlock()
		logger.InfoLogger.Printf("Manual update successful: %+v", priceInfo)
		c.JSON(200, gin.H{
			"message": "Price info updated",
			"data":    priceInfo,
		})
		recordLatency(time.Since(start))
	})

	// Set up scheduled tasks
	logger.InfoLogger.Println("Setting up scheduled tasks...")
	c := cron.New()
	// Update every 12 hours (daily at 0:00 and 12:00), note: no data on weekends
	_, err := c.AddFunc("0 0,12 * * *", func() {
		logger.InfoLogger.Println("Executing scheduled update...")
		if err := updatePriceInfo(); err != nil {
			logger.ErrorLogger.Printf("Scheduled update failed: %v", err)
		}
	})
	if err != nil {
		logger.ErrorLogger.Fatalf("Failed to set up scheduled task: %v", err)
	}
	c.Start()
	logger.InfoLogger.Println("Scheduled tasks setup completed")

	// Run initial update immediately
	logger.InfoLogger.Println("Starting initial update...")
	if err := updatePriceInfo(); err != nil {
		logger.ErrorLogger.Printf("Initial update failed: %v", err)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "10000" // fallback
		fmt.Println("Using default port 10000")
	} else {
		fmt.Printf("Using environment variable port: %s\n", port)
	}

	// Create custom HTTP server
	server := &http.Server{
		Addr:         "0.0.0.0:" + port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		fmt.Printf("HTTP server starting... Address: 0.0.0.0:%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Failed to start server: %v\n", err)
			fmt.Printf("Error type: %T\n", err)
			os.Exit(1)
		}
	}()

	// Wait for server to start
	fmt.Println("Waiting for server to start...")
	time.Sleep(1 * time.Second)

	// Test if server started successfully
	resp, err := http.Get(fmt.Sprintf("http://localhost:%s/healthz", port))
	if err != nil {
		fmt.Printf("Server startup test failed: %v\n", err)
	} else {
		fmt.Printf("Server startup test successful: %s\n", resp.Status)
		resp.Body.Close()
	}

	fmt.Println("=== Service startup completed ===")
	fmt.Printf("Startup time: %v\n", time.Since(startTime))

	// Keep main program running
	select {}
}
