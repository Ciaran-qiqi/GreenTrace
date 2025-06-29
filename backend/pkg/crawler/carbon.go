package crawler

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"backend/pkg/models"

	"github.com/gocolly/colly/v2"
)

// CarbonCrawler carbon price crawler struct
type CarbonCrawler struct {
	collector *colly.Collector
}

// NewCarbonCrawler create new carbon price crawler instance
func NewCarbonCrawler() *CarbonCrawler {
	fmt.Println("Creating new crawler instance...") // Debug log
	c := colly.NewCollector(
		colly.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0"),
	)

	// Set request headers
	c.OnRequest(func(r *colly.Request) {
		fmt.Printf("Requesting URL: %s\n", r.URL) // Debug log
		r.Headers.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
		r.Headers.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
		r.Headers.Set("Connection", "keep-alive")
		r.Headers.Set("Cookie", "ASP.NET_SessionId=qvlmyeaya40rjqapintmgmmz; .ASPXAUTH=F835FBEBFC672871B65CB1206EC5A47C6A873F8A9D826E277FD919D95F377320E6D7CF615B49EBB7B9E116DF51DA5241F50E8EDEF0D8C691D4E6DF765F4CC6A7E68A2CB32FD7D1A73882EFC7347D54F7B897EE58B7D8BEE5DC46AA5DD6E30D3954E9A876; TEUsername=YJGxU4jwoxhMVeBKw+XSdAfnWs9YEFjwpBHyuBcG9fE=; TENickName=ciaranJames; TEUserInfo=9c7a3ae9-0bbe-4aea-9218-e2ad1f8fa9ae; TEName=ciaran James; TEUserEmail=ciaran.aicheng@gmail.com; TEServer=TEIIS")
	})

	// Add response handler
	c.OnResponse(func(r *colly.Response) {
		fmt.Printf("Received response, status code: %d\n", r.StatusCode) // Debug log
	})

	// Add error handler
	c.OnError(func(r *colly.Response, err error) {
		fmt.Printf("Request failed: %v\n", err) // Debug log
	})

	return &CarbonCrawler{
		collector: c,
	}
}

// FetchPrice get carbon price information
func (c *CarbonCrawler) FetchPrice() (*models.PriceInfo, error) {
	fmt.Println("Starting to fetch price info...") // Debug log
	var priceInfo *models.PriceInfo
	var err error

	c.collector.OnHTML("meta[content*='EU Carbon Permits']", func(e *colly.HTMLElement) {
		fmt.Println("Found price info meta tag") // Debug log
		content := e.Attr("content")
		fmt.Printf("Meta content: %s\n", content) // Debug log
		priceInfo, err = parsePriceInfo(content)
	})

	err = c.collector.Visit("https://tradingeconomics.com/commodity/carbon")
	if err != nil {
		fmt.Printf("Failed to visit webpage: %v\n", err) // Debug log
		return nil, err
	}

	if priceInfo == nil {
		fmt.Println("No price info found") // Debug log
		return nil, errors.New("No price info found")
	}

	fmt.Printf("Successfully parsed price info: %+v\n", priceInfo) // Debug log
	return priceInfo, nil
}

// parsePriceInfo parse price information
func parsePriceInfo(text string) (*models.PriceInfo, error) {
	fmt.Println("Starting to parse price info...") // Debug log
	// Price and date matching
	pricePattern := regexp.MustCompile(`(\d+\.\d+)\s+EUR\s+on\s+([A-Za-z]+\s+\d+,\s+\d{4})`)
	// Daily change matching (support up and down)
	dailyPattern := regexp.MustCompile(`(?:up|down)\s+(\d+\.\d+)%`)
	// Monthly change matching (support up and down)
	monthlyPattern := regexp.MustCompile(`(?:risen|fallen)\s+(\d+\.\d+)%`)
	// Yearly change matching (support up and down)
	yearlyPattern := regexp.MustCompile(`(?:up|down)\s+(\d+\.\d+)%\s+compared\s+to\s+the\s+same\s+time\s+last\s+year`)

	priceMatch := pricePattern.FindStringSubmatch(text)
	if len(priceMatch) < 3 {
		fmt.Println("Cannot match price and date") // Debug log
		return nil, errors.New("Cannot parse price info")
	}

	price, _ := strconv.ParseFloat(priceMatch[1], 64)
	fmt.Printf("Parsed price: %f, date: %s\n", price, priceMatch[2]) // Debug log

	info := &models.PriceInfo{
		Price:       price,
		Date:        priceMatch[2],
		LastUpdated: time.Now().Format(time.RFC3339),
	}

	// Parse daily change
	if dailyMatch := dailyPattern.FindStringSubmatch(text); len(dailyMatch) > 1 {
		info.DailyChange, _ = strconv.ParseFloat(dailyMatch[1], 64)
		// Convert to negative if down
		if strings.Contains(text, "down") {
			info.DailyChange = -info.DailyChange
		}
		fmt.Printf("Parsed daily change: %f%%\n", info.DailyChange) // Debug log
	}

	// Parse monthly change
	if monthlyMatch := monthlyPattern.FindStringSubmatch(text); len(monthlyMatch) > 1 {
		info.MonthlyChange, _ = strconv.ParseFloat(monthlyMatch[1], 64)
		// Convert to negative if fallen
		if strings.Contains(text, "fallen") {
			info.MonthlyChange = -info.MonthlyChange
		}
		fmt.Printf("Parsed monthly change: %f%%\n", info.MonthlyChange) // Debug log
	}

	// Parse yearly change
	if yearlyMatch := yearlyPattern.FindStringSubmatch(text); len(yearlyMatch) > 1 {
		info.YearlyChange, _ = strconv.ParseFloat(yearlyMatch[1], 64)
		// Convert to negative if down
		if strings.Contains(text, "down") {
			info.YearlyChange = -info.YearlyChange
		}
		fmt.Printf("Parsed yearly change: %f%%\n", info.YearlyChange) // Debug log
	}

	return info, nil
}
