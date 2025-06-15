package crawler

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"backend/pkg/models"

	"github.com/gocolly/colly/v2"
)

// CarbonCrawler 碳价格爬虫结构体
type CarbonCrawler struct {
	collector *colly.Collector
}

// NewCarbonCrawler 创建新的碳价格爬虫实例
func NewCarbonCrawler() *CarbonCrawler {
	fmt.Println("创建新的爬虫实例...") // 添加调试日志
	c := colly.NewCollector(
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0"),
	)

	// 设置请求头
	c.OnRequest(func(r *colly.Request) {
		fmt.Printf("正在请求URL: %s\n", r.URL) // 添加调试日志
		r.Headers.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		r.Headers.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
		r.Headers.Set("Connection", "keep-alive")
		r.Headers.Set("Cookie", "ASP.NET_SessionId=qvlmyeaya40rjqapintmgmmz; .ASPXAUTH=F835FBEBFC672871B65CB1206EC5A47C6A873F8A9D826E277FD919D95F377320E6D7CF615B49EBB7B9E116DF51DA5241F50E8EDEF0D8C691D4E6DF765F4CC6A7E68A2CB32FD7D1A73882EFC7347D54F7B897EE58B7D8BEE5DC46AA5DD6E30D3954E9A876; TEUsername=YJGxU4jwoxhMVeBKw+XSdAfnWs9YEFjwpBHyuBcG9fE=; TENickName=ciaranJames; TEUserInfo=9c7a3ae9-0bbe-4aea-9218-e2ad1f8fa9ae; TEName=ciaran James; TEUserEmail=ciaran.aicheng@gmail.com; TEServer=TEIIS")
	})

	// 添加响应处理
	c.OnResponse(func(r *colly.Response) {
		fmt.Printf("收到响应，状态码: %d\n", r.StatusCode) // 添加调试日志
	})

	// 添加错误处理
	c.OnError(func(r *colly.Response, err error) {
		fmt.Printf("请求失败: %v\n", err) // 添加调试日志
	})

	return &CarbonCrawler{
		collector: c,
	}
}

// FetchPrice 获取碳价格信息
func (c *CarbonCrawler) FetchPrice() (*models.PriceInfo, error) {
	fmt.Println("开始获取价格信息...") // 添加调试日志
	var priceInfo *models.PriceInfo
	var err error

	c.collector.OnHTML("meta[content*='EU Carbon Permits']", func(e *colly.HTMLElement) {
		fmt.Println("找到价格信息meta标签") // 添加调试日志
		content := e.Attr("content")
		fmt.Printf("meta内容: %s\n", content) // 添加调试日志
		priceInfo, err = parsePriceInfo(content)
	})

	err = c.collector.Visit("https://tradingeconomics.com/commodity/carbon")
	if err != nil {
		fmt.Printf("访问网页失败: %v\n", err) // 添加调试日志
		return nil, err
	}

	if priceInfo == nil {
		fmt.Println("未找到价格信息") // 添加调试日志
		return nil, errors.New("未找到价格信息")
	}

	fmt.Printf("成功解析价格信息: %+v\n", priceInfo) // 添加调试日志
	return priceInfo, nil
}

// parsePriceInfo 解析价格信息
func parsePriceInfo(text string) (*models.PriceInfo, error) {
	fmt.Println("开始解析价格信息...") // 添加调试日志
	// 价格和日期匹配
	pricePattern := regexp.MustCompile(`(\d+\.\d+)\s+EUR\s+on\s+([A-Za-z]+\s+\d+,\s+\d{4})`)
	// 日涨跌幅匹配
	dailyPattern := regexp.MustCompile(`up\s+(\d+\.\d+)%`)
	// 月涨跌幅匹配
	monthlyPattern := regexp.MustCompile(`risen\s+(\d+\.\d+)%`)
	// 年涨跌幅匹配
	yearlyPattern := regexp.MustCompile(`up\s+(\d+\.\d+)%\s+compared\s+to\s+the\s+same\s+time\s+last\s+year`)

	priceMatch := pricePattern.FindStringSubmatch(text)
	if len(priceMatch) < 3 {
		fmt.Println("无法匹配价格和日期") // 添加调试日志
		return nil, errors.New("无法解析价格信息")
	}

	price, _ := strconv.ParseFloat(priceMatch[1], 64)
	fmt.Printf("解析到价格: %f, 日期: %s\n", price, priceMatch[2]) // 添加调试日志

	info := &models.PriceInfo{
		Price:       price,
		Date:        priceMatch[2],
		LastUpdated: time.Now().Format(time.RFC3339),
	}

	// 解析日涨跌幅
	if dailyMatch := dailyPattern.FindStringSubmatch(text); len(dailyMatch) > 1 {
		info.DailyChange, _ = strconv.ParseFloat(dailyMatch[1], 64)
		fmt.Printf("解析到日涨跌幅: %f%%\n", info.DailyChange) // 添加调试日志
	}

	// 解析月涨跌幅
	if monthlyMatch := monthlyPattern.FindStringSubmatch(text); len(monthlyMatch) > 1 {
		info.MonthlyChange, _ = strconv.ParseFloat(monthlyMatch[1], 64)
		fmt.Printf("解析到月涨跌幅: %f%%\n", info.MonthlyChange) // 添加调试日志
	}

	// 解析年涨跌幅
	if yearlyMatch := yearlyPattern.FindStringSubmatch(text); len(yearlyMatch) > 1 {
		info.YearlyChange, _ = strconv.ParseFloat(yearlyMatch[1], 64)
		fmt.Printf("解析到年涨跌幅: %f%%\n", info.YearlyChange) // 添加调试日志
	}

	return info, nil
}
